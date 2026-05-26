import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { validateManualImport, upsertPracticeProblem } from '$lib/server/practice/import.js';

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = await locals.auth();
	if (!session?.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return json({ error: 'Request body must be valid JSON.' }, { status: 400 });
	}

	const validation = validateManualImport(raw);
	if (!validation.ok) {
		return json(
			{
				error: 'Validation failed',
				details: validation.errors
			},
			{ status: 400 }
		);
	}

	let result;
	try {
		result = await upsertPracticeProblem(validation.problem, 'import');
	} catch (err) {
		console.error('[practice/import] DB upsert error:', err);
		return json({ error: 'Failed to save the practice problem.' }, { status: 500 });
	}

	return json({
		problem: result.problem,
		created: result.created
	});
};
