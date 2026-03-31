import OpenAI from 'openai';
import { env } from '$env/dynamic/private';
import {
	RESEARCH_SYSTEM_PROMPT,
	NOTE_GENERATION_SYSTEM_PROMPT,
	NOTE_RECOMMENDATIONS_SYSTEM_PROMPT,
	buildRespondSystemPrompt
} from './prompts.js';
import type { ConversationMessage, AssistantRespondResult, NoteProposal } from './claude.js';
import type { ResearchContext } from '$lib/server/assistant/research.js';

/**
 * Research a technology topic using GPT and return a markdown note body.
 * @param topic - The technology or concept to research
 * @returns Markdown string for use as a note body
 */
export async function researchTopic(topic: string): Promise<string> {
	const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

	const response = await client.chat.completions.create({
		model: 'gpt-4o',
		max_tokens: 1024,
		messages: [
			{ role: 'system', content: RESEARCH_SYSTEM_PROMPT },
			{ role: 'user', content: topic }
		]
	});

	const content = response.choices[0]?.message?.content;
	if (!content) {
		throw new Error('Unexpected empty response from OpenAI API');
	}
	return content;
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
	const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

	const userMessage = `Topic: ${topic}

Existing note topics (do NOT suggest these):
${existingTopics.join(', ')}`;

	const response = await client.chat.completions.create({
		model: 'gpt-4o',
		max_tokens: 256,
		messages: [
			{ role: 'system', content: NOTE_RECOMMENDATIONS_SYSTEM_PROMPT },
			{ role: 'user', content: userMessage }
		]
	});

	const content = response.choices[0]?.message?.content;
	if (!content) {
		throw new Error('Unexpected empty response from OpenAI API');
	}

	let parsed: string[];
	try {
		parsed = JSON.parse(content) as string[];
	} catch {
		throw new Error('OpenAI returned invalid JSON for recommendations');
	}

	if (!Array.isArray(parsed) || parsed.length !== 3 || !parsed.every((t) => typeof t === 'string')) {
		throw new Error('OpenAI recommendations response has unexpected shape');
	}

	return parsed;
}

/**
 * Generate a structured note from a topic name using GPT.
 * @param topic - The technology or concept to generate a note for
 * @returns Markdown string including frontmatter
 */
export async function generateNote(topic: string): Promise<string> {
	const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

	const response = await client.chat.completions.create({
		model: 'gpt-4o',
		max_tokens: 2048,
		messages: [
			{ role: 'system', content: NOTE_GENERATION_SYSTEM_PROMPT },
			{ role: 'user', content: `Generate a structured note about: ${topic}` }
		]
	});

	const content = response.choices[0]?.message?.content;
	if (!content) {
		throw new Error('Unexpected empty response from OpenAI API');
	}
	return content;
}

/**
 * Unified conversation endpoint for OpenAI — returns a conversational reply and an optional note proposal.
 * @param messages - Full conversation transcript
 * @param mode - "chat" | "create" | "update"
 * @param model - A server-approved OpenAI model ID
 * @param currentNoteBody - Saved note body for update mode comparison
 */
export async function respondConversation(
	messages: ConversationMessage[],
	mode: 'chat' | 'create' | 'update',
	model: string,
	researchContext?: ResearchContext,
	noteTitles?: string[],
	currentNoteBody?: string
): Promise<AssistantRespondResult> {
	const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
	const systemPrompt = buildRespondSystemPrompt(mode, researchContext, noteTitles, currentNoteBody);

	const response = await client.chat.completions.create({
		model,
		max_tokens: 4096,
		response_format: { type: 'json_object' },
		messages: [
			{ role: 'system', content: systemPrompt },
			...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
		]
	});

	const text = response.choices[0]?.message?.content;
	if (!text) {
		throw new Error('Unexpected empty response from OpenAI API');
	}

	let parsed: {
		content?: string;
		citations?: { title: string; url: string }[];
		proposal?: NoteProposal | null;
	};
	try {
		parsed = JSON.parse(text) as typeof parsed;
	} catch {
		return { assistantMessage: { content: text, citations: [] }, proposal: null };
	}

	if (typeof parsed.content !== 'string' || !parsed.content) {
		throw new Error('OpenAI response missing content field');
	}

	return {
		assistantMessage: {
			content: parsed.content,
			citations: Array.isArray(parsed.citations) ? parsed.citations : []
		},
		proposal: parsed.proposal ?? null
	};
}
