import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';

/**
 * POST /api/ai/generate-note
 * Body: { topic: string, provider?: 'claude' | 'chatgpt' }
 *
 * Stub — returns 501 until AI integration is implemented.
 * When implemented, this will call the configured AI provider to generate
 * a full note from a topic name and insert it into the database.
 */
export const POST: RequestHandler = async () => {
	return json({ error: 'AI note generation not yet implemented' }, { status: 501 });
};
