import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import {
	RESEARCH_SYSTEM_PROMPT,
	NOTE_GENERATION_SYSTEM_PROMPT,
	ASSISTANT_QUERY_SYSTEM_PROMPT,
	NOTE_RECOMMENDATIONS_SYSTEM_PROMPT,
	RESPOND_SYSTEM_PROMPT_CHAT,
	RESPOND_SYSTEM_PROMPT_CREATE
} from './prompts.js';

// ── Shared types for the unified respond endpoint ────────────────────────────

export interface ConversationMessage {
	role: 'user' | 'assistant';
	content: string;
}

export interface NoteDraft {
	title: string;
	body: string;
	tags: string[];
	aliases: string[];
	category: string;
	status: 'stub' | 'growing' | 'mature';
	aiGenerated?: boolean;
	aiModel?: string;
	aiPrompt?: string;
}

export interface NoteProposal {
	type: 'create_note' | 'update_note' | 'delete_note';
	draft?: NoteDraft;
	linkedNotePatches?: { noteId: string; title: string; updatedBody: string }[];
}

export interface AssistantRespondResult {
	assistantMessage: {
		content: string;
		citations: { title: string; url: string }[];
	};
	proposal: NoteProposal | null;
}

export interface AssistantQueryResult {
	summary: string;
	possibleGaps: string[];
	newTopicIdeas: string[];
}

/**
 * Research a technology topic and return a markdown note body.
 * @param topic - The technology or concept to research
 * @returns Markdown string for use as a note body
 */
export async function researchTopic(topic: string): Promise<string> {
	const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

	const message = await client.messages.create({
		model: 'claude-opus-4-6',
		max_tokens: 1024,
		system: RESEARCH_SYSTEM_PROMPT,
		messages: [{ role: 'user', content: topic }]
	});

	const block = message.content[0];
	if (block.type !== 'text') {
		throw new Error('Unexpected response type from Claude API');
	}
	return block.text;
}

/**
 * Generate a structured note from a topic name.
 * @param topic - The technology or concept to generate a note for
 * @returns Markdown string including frontmatter
 */
export async function generateNote(topic: string): Promise<string> {
	const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

	const message = await client.messages.create({
		model: 'claude-opus-4-6',
		max_tokens: 2048,
		system: NOTE_GENERATION_SYSTEM_PROMPT,
		messages: [{ role: 'user', content: `Generate a structured note about: ${topic}` }]
	});

	const block = message.content[0];
	if (block.type !== 'text') {
		throw new Error('Unexpected response type from Claude API');
	}
	return block.text;
}

/**
 * Get 3 next-note topic recommendations for a generated note, de-duplicated against existing topics.
 * @param topic - The topic of the note that was just generated
 * @param existingTopics - All current note titles and aliases (for de-duplication)
 */
export async function getNextNoteRecommendations(
	topic: string,
	existingTopics: string[]
): Promise<string[]> {
	const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

	const userMessage = `Topic: ${topic}

Existing note topics (do NOT suggest these):
${existingTopics.join(', ')}`;

	const message = await client.messages.create({
		model: 'claude-opus-4-6',
		max_tokens: 256,
		system: NOTE_RECOMMENDATIONS_SYSTEM_PROMPT,
		messages: [{ role: 'user', content: userMessage }]
	});

	const block = message.content[0];
	if (block.type !== 'text') {
		throw new Error('Unexpected response type from Claude API');
	}

	let parsed: string[];
	try {
		parsed = JSON.parse(block.text) as string[];
	} catch {
		throw new Error('Claude returned invalid JSON for recommendations');
	}

	if (!Array.isArray(parsed) || parsed.length !== 3 || !parsed.every((t) => typeof t === 'string')) {
		throw new Error('Claude recommendations response has unexpected shape');
	}

	return parsed;
}

/**
 * Query the assistant about an existing note and return a grounded summary with suggestions.
 * @param note - The matched note (title + body)
 * @param userQuery - The original natural-language user query
 * @param existingTopics - All current note titles and aliases (for de-duplication)
 */
export async function queryAssistant(
	note: { title: string; body: string },
	userQuery: string,
	existingTopics: string[]
): Promise<AssistantQueryResult> {
	const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

	const userMessage = `User query: ${userQuery}

Note title: ${note.title}
Note content:
${note.body}

Existing note topics (do NOT suggest these as newTopicIdeas):
${existingTopics.join(', ')}`;

	const message = await client.messages.create({
		model: 'claude-opus-4-6',
		max_tokens: 1024,
		system: ASSISTANT_QUERY_SYSTEM_PROMPT,
		messages: [{ role: 'user', content: userMessage }]
	});

	const block = message.content[0];
	if (block.type !== 'text') {
		throw new Error('Unexpected response type from Claude API');
	}

	let parsed: AssistantQueryResult;
	try {
		parsed = JSON.parse(block.text) as AssistantQueryResult;
	} catch {
		throw new Error('Claude returned invalid JSON response');
	}

	if (
		typeof parsed.summary !== 'string' ||
		!Array.isArray(parsed.possibleGaps) ||
		!Array.isArray(parsed.newTopicIdeas)
	) {
		throw new Error('Claude response missing required fields');
	}

	return parsed;
}

/**
 * Unified conversation endpoint — returns a conversational reply and an optional note proposal.
 * @param messages - Full conversation transcript
 * @param mode - "chat" for conversation only, "create" for note proposal generation
 * @param model - A server-approved Anthropic model ID
 */
export async function respondConversation(
	messages: ConversationMessage[],
	mode: 'chat' | 'create',
	model: string
): Promise<AssistantRespondResult> {
	const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
	const systemPrompt = mode === 'create' ? RESPOND_SYSTEM_PROMPT_CREATE : RESPOND_SYSTEM_PROMPT_CHAT;

	const message = await client.messages.create({
		model,
		max_tokens: 4096,
		system: systemPrompt,
		messages: messages.map((m) => ({ role: m.role, content: m.content }))
	});

	const block = message.content[0];
	if (block.type !== 'text') {
		throw new Error('Unexpected response type from Anthropic API');
	}

	return parseRespondResponse(block.text);
}

function parseRespondResponse(text: string): AssistantRespondResult {
	let parsed: {
		content?: string;
		citations?: { title: string; url: string }[];
		proposal?: NoteProposal | null;
	};
	try {
		parsed = JSON.parse(text) as typeof parsed;
	} catch {
		// Fallback: treat the entire response as plain conversational content
		return { assistantMessage: { content: text, citations: [] }, proposal: null };
	}

	if (typeof parsed.content !== 'string' || !parsed.content) {
		throw new Error('Assistant response missing content field');
	}

	return {
		assistantMessage: {
			content: parsed.content,
			citations: Array.isArray(parsed.citations) ? parsed.citations : []
		},
		proposal: parsed.proposal ?? null
	};
}
