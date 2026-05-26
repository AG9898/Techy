import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import {
	validateTutorInput,
	loadProblem,
	callTutor
} from '$lib/server/practice/tutor.js';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Guard: ensure the key is configured before going further
	if (!env.OPENROUTER_API_KEY) {
		return json(
			{ error: 'OpenRouter is not configured. Set OPENROUTER_API_KEY to enable the tutor.' },
			{ status: 503 }
		);
	}

	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return json({ error: 'Request body must be valid JSON.' }, { status: 400 });
	}

	const validation = validateTutorInput(raw);
	if (!validation.ok) {
		return json({ error: 'Validation failed', details: validation.errors }, { status: 400 });
	}

	const { input } = validation;

	// Load and verify the problem exists (ownership check: problems are global, not user-scoped)
	const problem = await loadProblem(input.problemId);
	if (!problem) {
		return json({ error: 'Practice problem not found.' }, { status: 404 });
	}

	try {
		const result = await callTutor(problem, input);
		return json(result);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);

		// Surface configuration errors as 503
		if (message.includes('OPENROUTER_API_KEY')) {
			return json({ error: 'OpenRouter is unavailable or unconfigured.' }, { status: 503 });
		}

		console.error('[practice/tutor] OpenRouter error:', err);
		return json({ error: 'Tutor request failed.' }, { status: 503 });
	}
};
