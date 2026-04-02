import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { isValidProviderModel } from '$lib/server/ai/models.js';
import { respondConversation as respondWithClaude } from '$lib/server/ai/claude.js';
import { respondConversation as respondWithOpenAI } from '$lib/server/ai/chatgpt.js';
import type { ConversationMessage } from '$lib/server/ai/claude.js';
import { performResearch, topicKey } from '$lib/server/assistant/research.js';
import type { TopicCache } from '$lib/server/assistant/research.js';
import { resolveAssistantRouting } from '$lib/server/assistant/routing.js';
import type {
	DeleteTargetPromptContext,
	RelatedNotePromptContext
} from '$lib/server/ai/prompts.js';
import { db } from '$lib/server/db/index.js';
import { notes } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { CANONICAL_NOTE_CATEGORIES } from '$lib/utils/note-taxonomy.js';

const MAX_PROMPT_TAGS = 40;
const TOPIC_LEARNING_PROMPT_PATTERNS = [
	/^\s*(what is|what are)\b/i,
	/^\s*(tell me about|teach me about|learn about)\b/i,
	/^\s*(explain|describe|overview of|give me an overview of)\b/i
];

function collectPromptTags(tagSets: string[][]): string[] {
	const counts = new Map<string, number>();

	for (const tags of tagSets) {
		for (const tag of tags) {
			const normalized = tag.trim().toLowerCase();
			if (!normalized) continue;
			counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
		}
	}

	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, MAX_PROMPT_TAGS)
		.map(([tag]) => tag);
}

/**
 * POST /api/assistant/respond
 *
 * Unified assistant endpoint. Accepts a conversation, provider/model choice, and optional routing override.
 * Performs live web research before calling the LLM, using the per-conversation topicCache
 * to avoid re-researching the same topic within a session.
 * Returns a conversational reply plus an optional structured note proposal.
 */
export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return json({ error: 'Request body must be a JSON object' }, { status: 400 });
	}

	const { messages, mode, override, provider, model, topicCache, noteId } = body as Record<
		string,
		unknown
	>;

	// Validate messages
	if (!Array.isArray(messages) || messages.length === 0) {
		return json({ error: 'messages must be a non-empty array' }, { status: 400 });
	}

	for (const msg of messages) {
		if (
			typeof msg !== 'object' ||
			msg === null ||
			((msg as Record<string, unknown>).role !== 'user' &&
				(msg as Record<string, unknown>).role !== 'assistant') ||
			typeof (msg as Record<string, unknown>).content !== 'string'
		) {
			return json(
				{ error: 'Each message must have role ("user" | "assistant") and content (string)' },
				{ status: 400 }
			);
		}
	}

	if (override !== undefined && override !== 'chat' && override !== 'create' && override !== 'update') {
		return json({ error: 'override must be "chat", "create", or "update"' }, { status: 400 });
	}

	if (mode !== undefined && mode !== 'chat' && mode !== 'create' && mode !== 'update') {
		return json({ error: 'mode must be "chat", "create", or "update"' }, { status: 400 });
	}

	// Validate provider/model
	if (typeof provider !== 'string' || typeof model !== 'string') {
		return json({ error: 'provider and model must be strings' }, { status: 400 });
	}

	if (!isValidProviderModel(provider, model)) {
		return json(
			{ error: `Invalid provider/model combination: ${provider}/${model}` },
			{ status: 400 }
		);
	}

	const typedMessages = messages as ConversationMessage[];

	// Load existing notes for context injection, note matching, and patch resolution.
	const allNotes = await db
		.select({ id: notes.id, title: notes.title, slug: notes.slug, aliases: notes.aliases, tags: notes.tags })
		.from(notes);
	const noteTitles = allNotes.map((n) => n.title);
	const titleToId = new Map(allNotes.map((n) => [n.title, n.id]));
	const existingTags = collectPromptTags(allNotes.map((note) => note.tags));
	const selectedNote =
		typeof noteId === 'string' && noteId
			? allNotes.find((note) => note.id === noteId) ?? null
			: null;
	const routing = resolveAssistantRouting({
		messages: typedMessages,
		override,
		legacyMode: mode,
		noteId,
		notes: allNotes
	});

	let currentNoteTitle: string | undefined;
	let currentNoteBody: string | undefined;
	let relatedNote: RelatedNotePromptContext | undefined;
	if (routing.resolvedMode === 'update') {
		if (typeof noteId === 'string' && noteId && !allNotes.some((note) => note.id === noteId)) {
			return json({ error: `Note not found: ${noteId}` }, { status: 400 });
		}

		if (!routing.noteId) {
			return json(
				{ error: 'Update routing requires either a selected note or a strong note match' },
				{ status: 400 }
			);
		}

		const noteRow = await db
			.select({ title: notes.title, body: notes.body })
			.from(notes)
			.where(eq(notes.id, routing.noteId))
			.limit(1);
		if (!noteRow.length) {
			return json({ error: `Note not found: ${routing.noteId}` }, { status: 400 });
		}
		currentNoteTitle = noteRow[0].title;
		currentNoteBody = noteRow[0].body;
	} else if (routing.resolvedMode === 'chat' && routing.matchedNote) {
		const noteRow = await db
			.select({ title: notes.title, body: notes.body })
			.from(notes)
			.where(eq(notes.id, routing.matchedNote.id))
			.limit(1);
		if (noteRow.length) {
			relatedNote = {
				title: noteRow[0].title,
				body: noteRow[0].body,
				matchType: routing.matchedNote.matchType
			};
		}
	}

	const deleteTarget = resolveDeleteTarget({
		latestUserMessage: routing.latestUserMessage,
		selectedNote,
		matchedNote: routing.matchedNote
	});

	// Resolve the per-conversation topic cache from the client
	const cache: TopicCache =
		typeof topicCache === 'object' && topicCache !== null && !Array.isArray(topicCache)
			? (topicCache as TopicCache)
			: {};

	// In update mode, always research the selected note title rather than the user's free-form request.
	// This keeps "review this note" style prompts grounded on the chosen note.
	const rawTopic =
		routing.resolvedMode === 'update'
			? (currentNoteTitle ?? '')
			: routing.latestUserMessage;
	const key = topicKey(rawTopic);

	// Look up or perform live web research; always research for both modes so
	// create-note and compare/update flows are grounded in current information.
	let researchContext = cache[key];
	if (!researchContext && rawTopic) {
		try {
			researchContext = await performResearch(rawTopic);
			cache[key] = researchContext;
		} catch (err) {
			// Research failure is non-fatal — proceed without context
			console.warn('[/api/assistant/respond] research failed:', err);
		}
	}

	try {
		let result;
		if (provider === 'anthropic') {
			result = await respondWithClaude(
				typedMessages,
				routing.resolvedMode,
				model,
				researchContext,
				CANONICAL_NOTE_CATEGORIES,
				existingTags,
				noteTitles,
				currentNoteTitle,
				currentNoteBody,
				relatedNote,
				deleteTarget,
				shouldOfferCreateProposal(routing.latestUserMessage, routing.matchedNote)
			);
		} else {
			result = await respondWithOpenAI(
				typedMessages,
				routing.resolvedMode,
				model,
				researchContext,
				CANONICAL_NOTE_CATEGORIES,
				existingTags,
				noteTitles,
				currentNoteTitle,
				currentNoteBody,
				relatedNote,
				deleteTarget,
				shouldOfferCreateProposal(routing.latestUserMessage, routing.matchedNote)
			);
		}

		// Attach server-side metadata to any create_note or update_note proposal draft
		if (
			(result.proposal?.type === 'create_note' || result.proposal?.type === 'update_note') &&
			result.proposal.draft
		) {
			result.proposal.draft.aiGenerated = true;
			result.proposal.draft.aiModel = model;
			result.proposal.draft.aiPrompt = routing.latestUserMessage;
		}

		// Normalize update proposals against the selected note so commit always has the DB target.
		// Keep the canonical saved title stable even if the model drifts on casing or wording.
		if (result.proposal?.type === 'update_note' && currentNoteTitle && routing.noteId) {
			result.proposal.noteId = routing.noteId;
			result.proposal.noteTitle = currentNoteTitle;
			if (result.proposal.draft) {
				result.proposal.draft.title = currentNoteTitle;
			}
		}

		// Resolve linkedNotePatches: LLM proposes by title — map to { noteId, title, updatedBody }
		// Drop any patches whose title doesn't match an existing note (LLM may hallucinate titles)
		if (result.proposal?.type === 'create_note' && result.proposal.linkedNotePatches?.length) {
			result.proposal.linkedNotePatches = result.proposal.linkedNotePatches
				.map((patch) => {
					const noteId = titleToId.get(patch.title);
					return noteId ? { noteId, title: patch.title, updatedBody: patch.updatedBody } : null;
				})
				.filter(
					(p): p is { noteId: string; title: string; updatedBody: string } => p !== null
				);
		}

		// Merge research citations into the assistant message (deduplicated by URL)
		if (researchContext?.citations?.length) {
			const existingUrls = new Set(result.assistantMessage.citations.map((c) => c.url));
			const newCitations = researchContext.citations.filter((c) => !existingUrls.has(c.url));
			result.assistantMessage.citations = [...result.assistantMessage.citations, ...newCitations];
		}

		return json({
			assistantMessage: result.assistantMessage,
			proposal: result.proposal ?? null,
			topicCache: cache,
			routing
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (
			message.includes('401') ||
			message.includes('invalid_api_key') ||
			message.includes('authentication') ||
			message.includes('Incorrect API key') ||
			message.includes('No auth credentials')
		) {
			return json({ error: 'Invalid or missing provider API key' }, { status: 401 });
		}
		if (
			message.includes('429') ||
			message.includes('rate_limit') ||
			message.includes('Rate limit')
		) {
			return json({ error: 'Provider rate limit exceeded — try again later' }, { status: 429 });
		}
		console.error('[/api/assistant/respond]', err);
		return json({ error: 'Assistant request failed' }, { status: 500 });
	}
};

const EXPLICIT_DELETE_INTENT_PATTERNS = [
	/\bdelete\b/,
	/\bremove\b/,
	/\berase\b/,
	/\bdiscard\b/,
	/\bget rid of\b/
];

function resolveDeleteTarget({
	latestUserMessage,
	selectedNote,
	matchedNote
}: {
	latestUserMessage: string;
	selectedNote: { id: string; title: string } | null;
	matchedNote: { id: string; title: string; matchType: 'selected' | 'title' | 'alias' } | null;
}): DeleteTargetPromptContext | null {
	const normalizedMessage = latestUserMessage.trim().toLowerCase();
	if (!normalizedMessage || !EXPLICIT_DELETE_INTENT_PATTERNS.some((pattern) => pattern.test(normalizedMessage))) {
		return null;
	}

	if (selectedNote) {
		return {
			noteId: selectedNote.id,
			title: selectedNote.title,
			matchType: 'selected'
		};
	}

	if (matchedNote) {
		return {
			noteId: matchedNote.id,
			title: matchedNote.title,
			matchType: matchedNote.matchType
		};
	}

	return null;
}

function shouldOfferCreateProposal(
	latestUserMessage: string,
	matchedNote: { id: string } | null
): boolean {
	return !matchedNote && TOPIC_LEARNING_PROMPT_PATTERNS.some((pattern) => pattern.test(latestUserMessage));
}
