import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';

export interface Citation {
	title: string;
	url: string;
}

export interface ResearchContext {
	summary: string;
	citations: Citation[];
}

export type TopicCache = Record<string, ResearchContext>;

/** Derive a stable cache key from a user message (lowercase, trimmed, capped at 120 chars). */
export function topicKey(text: string): string {
	const t = text.trim().toLowerCase();
	return t.length <= 120 ? t : t.slice(0, 120);
}

/**
 * Perform live web research on a topic using Anthropic's built-in web search tool.
 * Returns a normalised summary and citation list derived from search results.
 */
export async function performResearch(topic: string): Promise<ResearchContext> {
	const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

	const response = await client.messages.create({
		model: 'claude-opus-4-6',
		max_tokens: 1024,
		tools: [{ type: 'web_search_20250305', name: 'web_search' }],
		messages: [
			{
				role: 'user',
				content: `Research this technology topic and summarise the key facts, current status, and notable sources. Be concise.\n\n${topic}`
			}
		]
	});

	const citations: Citation[] = [];
	let summary = '';

	for (const block of response.content) {
		if (block.type === 'text') {
			summary += block.text;
		} else if (block.type === 'web_search_tool_result') {
			// block.content is WebSearchToolResultBlockContent = WebSearchToolResultError | Array<WebSearchResultBlock>
			if (Array.isArray(block.content)) {
				for (const result of block.content) {
					if (result.type === 'web_search_result' && result.url && result.title) {
						citations.push({ title: result.title, url: result.url });
					}
				}
			}
		}
	}

	return { summary: summary.trim(), citations };
}
