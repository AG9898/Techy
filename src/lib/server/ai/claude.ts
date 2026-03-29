import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import { RESEARCH_SYSTEM_PROMPT, NOTE_GENERATION_SYSTEM_PROMPT } from './prompts.js';

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
