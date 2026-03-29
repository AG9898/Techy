import OpenAI from 'openai';
import { env } from '$env/dynamic/private';
import { RESEARCH_SYSTEM_PROMPT, NOTE_GENERATION_SYSTEM_PROMPT } from './prompts.js';

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
