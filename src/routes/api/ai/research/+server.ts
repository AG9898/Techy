import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { researchTopic } from '$lib/ai/claude.js';

/**
 * POST /api/ai/research
 * Body: { topic: string }
 * Returns: { body: string }
 */
export const POST: RequestHandler = async ({ request }) => {
	let topic: string;
	try {
		const data = await request.json();
		topic = data?.topic;
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (!topic || typeof topic !== 'string' || topic.trim() === '') {
		return json({ error: 'Missing or empty "topic" field' }, { status: 400 });
	}

	try {
		const body = await researchTopic(topic.trim());
		return json({ body });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);

		if (message.includes('401') || message.includes('invalid_api_key') || message.includes('authentication')) {
			return json({ error: 'Invalid or missing ANTHROPIC_API_KEY' }, { status: 401 });
		}
		if (message.includes('429') || message.includes('rate_limit')) {
			return json({ error: 'Rate limit exceeded — try again later' }, { status: 429 });
		}

		console.error('[/api/ai/research]', err);
		return json({ error: 'AI research failed' }, { status: 500 });
	}
};
