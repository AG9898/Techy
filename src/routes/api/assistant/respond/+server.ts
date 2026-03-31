import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { isValidProviderModel } from '$lib/server/ai/models.js';
import { respondConversation as respondWithClaude } from '$lib/server/ai/claude.js';
import { respondConversation as respondWithOpenAI } from '$lib/server/ai/chatgpt.js';
import type { ConversationMessage } from '$lib/server/ai/claude.js';
import { performResearch, topicKey } from '$lib/server/assistant/research.js';
import type { TopicCache } from '$lib/server/assistant/research.js';
import { db } from '$lib/server/db/index.js';
import { notes } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * POST /api/assistant/respond
 *
 * Unified assistant endpoint. Accepts a conversation, provider/model choice, and mode.
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

	const { messages, mode, provider, model, topicCache, noteId } = body as Record<string, unknown>;

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

	// Validate mode
	if (mode !== 'chat' && mode !== 'create' && mode !== 'update') {
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

	// Validate noteId for update mode
	let currentNoteBody: string | undefined;
	if (mode === 'update') {
		if (typeof noteId !== 'string' || !noteId) {
			return json({ error: 'noteId is required for mode "update"' }, { status: 400 });
		}
		const noteRow = await db
			.select({ body: notes.body })
			.from(notes)
			.where(eq(notes.id, noteId))
			.limit(1);
		if (!noteRow.length) {
			return json({ error: `Note not found: ${noteId}` }, { status: 400 });
		}
		currentNoteBody = noteRow[0].body;
	}

	const typedMessages = messages as ConversationMessage[];

	// Load existing notes for context injection and patch resolution
	const allNotes = await db.select({ id: notes.id, title: notes.title }).from(notes);
	const noteTitles = allNotes.map((n) => n.title);
	const titleToId = new Map(allNotes.map((n) => [n.title, n.id]));

	// Resolve the per-conversation topic cache from the client
	const cache: TopicCache =
		typeof topicCache === 'object' && topicCache !== null && !Array.isArray(topicCache)
			? (topicCache as TopicCache)
			: {};

	// Derive the research topic from the last user message
	const lastUserMsg = [...typedMessages].reverse().find((m) => m.role === 'user');
	const rawTopic = lastUserMsg?.content ?? '';
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
				mode,
				model,
				researchContext,
				noteTitles,
				currentNoteBody
			);
		} else {
			result = await respondWithOpenAI(
				typedMessages,
				mode,
				model,
				researchContext,
				noteTitles,
				currentNoteBody
			);
		}

		// Attach server-side metadata to any create_note or update_note proposal draft
		if (
			(result.proposal?.type === 'create_note' || result.proposal?.type === 'update_note') &&
			result.proposal.draft
		) {
			const lastMsg = [...typedMessages].reverse().find((m) => m.role === 'user');
			result.proposal.draft.aiGenerated = true;
			result.proposal.draft.aiModel = model;
			result.proposal.draft.aiPrompt = lastMsg?.content ?? '';
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
			topicCache: cache
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
