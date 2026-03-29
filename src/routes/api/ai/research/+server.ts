import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';

/**
 * POST /api/ai/research
 * Body: { topic: string }
 *
 * Stub — returns 501 until AI integration is implemented.
 * When implemented, this will call the AI service to research a topic
 * and return a markdown note body.
 */
export const POST: RequestHandler = async () => {
	return json({ error: 'AI research not yet implemented' }, { status: 501 });
};
