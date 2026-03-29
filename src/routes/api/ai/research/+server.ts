import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { researchTopic as claudeResearch } from '$lib/server/ai/claude.js';
import { researchTopic as chatgptResearch } from '$lib/server/ai/chatgpt.js';

/**
 * POST /api/ai/research
 * Body: { topic: string, provider?: 'claude' | 'chatgpt' }
 * Returns: { body: string }
 */
export const POST: RequestHandler = async ({ request }) => {
	let topic: string;
	let provider: string;
	try {
		const data = await request.json();
		topic = data?.topic;
		provider = data?.provider ?? 'claude';
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (!topic || typeof topic !== 'string' || topic.trim() === '') {
		return json({ error: 'Missing or empty "topic" field' }, { status: 400 });
	}

	if (provider !== 'claude' && provider !== 'chatgpt') {
		return json({ error: 'Invalid provider — must be "claude" or "chatgpt"' }, { status: 400 });
	}

	try {
		const body =
			provider === 'chatgpt'
				? await chatgptResearch(topic.trim())
				: await claudeResearch(topic.trim());
		return json({ body });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);

		if (message.includes('401') || message.includes('invalid_api_key') || message.includes('authentication')) {
			return json({ error: 'Invalid or missing API key' }, { status: 401 });
		}
		if (message.includes('429') || message.includes('rate_limit')) {
			return json({ error: 'Rate limit exceeded — try again later' }, { status: 429 });
		}

		console.error('[/api/ai/research]', err);
		return json({ error: 'AI research failed' }, { status: 500 });
	}
};
