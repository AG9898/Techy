import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import {
	RESEARCH_SYSTEM_PROMPT,
	NOTE_GENERATION_SYSTEM_PROMPT,
	ASSISTANT_QUERY_SYSTEM_PROMPT
} from './prompts.js';

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
