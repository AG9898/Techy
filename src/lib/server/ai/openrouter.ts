import OpenAI from 'openai';
import { env } from '$env/dynamic/private';
import { buildRespondSystemPrompt } from './prompts.js';
import type { ResearchContext } from '$lib/server/assistant/research.js';
import type {
	ConversationMessage,
	AssistantRespondResult,
	NoteProposal
} from './claude.js';
import type { DeleteTargetPromptContext, RelatedNotePromptContext } from './prompts.js';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Unified conversation endpoint for OpenRouter — returns a conversational reply and an optional note proposal.
 * @param messages - Full conversation transcript
 * @param mode - "chat" | "create" | "update"
 * @param model - A server-approved OpenRouter model ID
 * @param currentNoteTitle - Selected note title for update mode grounding
 * @param currentNoteBody - Saved note body for update mode comparison
 */
export async function respondConversation(
	messages: ConversationMessage[],
	mode: 'chat' | 'create' | 'update',
	model: string,
	researchContext?: ResearchContext,
	canonicalCategories?: readonly string[],
	existingTags?: string[],
	noteTitles?: string[],
	currentNoteTitle?: string,
	currentNoteBody?: string,
	relatedNote?: RelatedNotePromptContext,
	deleteTarget?: DeleteTargetPromptContext | null
): Promise<AssistantRespondResult> {
	if (!env.OPENROUTER_API_KEY) {
		throw new Error('Missing OPENROUTER_API_KEY');
	}

	const client = new OpenAI({
		apiKey: env.OPENROUTER_API_KEY,
		baseURL: OPENROUTER_BASE_URL
	});

	const systemPrompt = buildRespondSystemPrompt({
		mode,
		researchContext,
		canonicalCategories,
		existingTags,
		noteTitles,
		currentNoteTitle,
		currentNoteBody,
		relatedNote,
		deleteTarget
	});

	const completion = await client.chat.completions.create({
		model,
		messages: [
			{ role: 'system', content: systemPrompt },
			...messages.map((message) => ({ role: message.role, content: message.content }))
		],
		max_tokens: mode === 'chat' ? 1400 : 4096
	});

	const content = completion.choices[0]?.message?.content;
	const text = typeof content === 'string' ? content.trim() : '';
	if (!text) {
		throw new Error('Unexpected empty response from OpenRouter API');
	}

	return parseRespondResponse(text);
}

function parseRespondResponse(text: string): AssistantRespondResult {
	for (const candidate of getJsonCandidates(text)) {
		try {
			const parsed = JSON.parse(candidate) as {
				content?: string;
				citations?: { title: string; url: string }[];
				proposal?: NoteProposal | null;
			};

			if (typeof parsed.content !== 'string' || !parsed.content) {
				continue;
			}

			return {
				assistantMessage: {
					content: parsed.content,
					citations: Array.isArray(parsed.citations) ? parsed.citations : []
				},
				proposal: parsed.proposal ?? null
			};
		} catch {
			continue;
		}
	}

	return { assistantMessage: { content: text, citations: [] }, proposal: null };
}

function getJsonCandidates(text: string): string[] {
	const trimmed = text.trim();
	const candidates = new Set<string>();

	if (trimmed) {
		candidates.add(trimmed);
	}

	const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
	if (fencedMatch?.[1]) {
		candidates.add(fencedMatch[1].trim());
	}

	const firstObject = extractFirstJsonObject(trimmed);
	if (firstObject) {
		candidates.add(firstObject);
	}

	return [...candidates];
}

function extractFirstJsonObject(text: string): string | null {
	let start = -1;
	let depth = 0;
	let inString = false;
	let escaped = false;

	for (let i = 0; i < text.length; i += 1) {
		const char = text[i];

		if (start === -1) {
			if (char === '{') {
				start = i;
				depth = 1;
			}
			continue;
		}

		if (escaped) {
			escaped = false;
			continue;
		}

		if (char === '\\') {
			escaped = true;
			continue;
		}

		if (char === '"') {
			inString = !inString;
			continue;
		}

		if (inString) continue;

		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) {
				return text.slice(start, i + 1).trim();
			}
		}
	}

	return null;
}
