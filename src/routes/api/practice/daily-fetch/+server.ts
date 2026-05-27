import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import {
	fetchLeetCodeDaily,
	LeetCodeFetchDisabledError,
	LeetCodeFetchUpstreamError
} from '$lib/server/practice/leetcode.js';
import { upsertPracticeProblem } from '$lib/server/practice/import.js';
import {
	isPracticeSchemaUnavailableError,
	practiceSchemaUnavailableMessage
} from '$lib/server/practice/schema-availability.js';

export const POST: RequestHandler = async ({ locals }) => {
	const session = await locals.auth();
	if (!session?.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let normalized;
	try {
		normalized = await fetchLeetCodeDaily();
	} catch (err) {
		if (err instanceof LeetCodeFetchDisabledError) {
			return json(
				{ error: 'LeetCode daily fetch is disabled on this server.' },
				{ status: 503 }
			);
		}
		if (err instanceof LeetCodeFetchUpstreamError) {
			return json(
				{ error: 'Failed to fetch LeetCode daily challenge. Try manual import instead.' },
				{ status: 502 }
			);
		}
		// Unexpected error — log server-side, return generic 502
		console.error('[practice/daily-fetch] Unexpected error:', err);
		return json(
			{ error: 'An unexpected error occurred fetching the daily challenge.' },
			{ status: 502 }
		);
	}

	let result;
	try {
		result = await upsertPracticeProblem(normalized, 'fetch');
	} catch (err) {
		if (isPracticeSchemaUnavailableError(err)) {
			return json({ error: practiceSchemaUnavailableMessage() }, { status: 503 });
		}
		console.error('[practice/daily-fetch] DB upsert error:', err);
		return json({ error: 'Failed to save the daily challenge.' }, { status: 500 });
	}

	return json({
		problem: result.problem,
		source: 'leetcode' as const,
		fetchedAt: new Date().toISOString(),
		created: result.created
	});
};
