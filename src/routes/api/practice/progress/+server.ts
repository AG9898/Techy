import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import {
	validateProgressInput,
	upsertProgress
} from '$lib/server/practice/progress.js';
import { db } from '$lib/server/db/index.js';
import { practiceProblems } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return json({ error: 'Request body must be valid JSON.' }, { status: 400 });
	}

	const validation = validateProgressInput(raw);
	if (!validation.ok) {
		return json({ error: 'Validation failed', details: validation.errors }, { status: 400 });
	}

	const { problemId, status, attempts, notes, codeSnapshot } = validation.input;

	// Verify problem exists
	const problemRows = await db
		.select({ id: practiceProblems.id })
		.from(practiceProblems)
		.where(eq(practiceProblems.id, problemId))
		.limit(1);

	if (problemRows.length === 0) {
		return json({ error: 'Practice problem not found.' }, { status: 404 });
	}

	let progress;
	try {
		progress = await upsertProgress({
			userId: session.user.id,
			problemId,
			status,
			attempts,
			notes,
			codeSnapshot
		});
	} catch (err) {
		console.error('[practice/progress] DB upsert error:', err);
		return json({ error: 'Failed to save progress.' }, { status: 500 });
	}

	return json({
		progress: {
			problemId: progress.problemId,
			status: progress.status,
			attempts: progress.attempts,
			notes: progress.notes,
			codeSnapshot: progress.codeSnapshot,
			completedAt: progress.completedAt ? progress.completedAt.toISOString() : null,
			updatedAt: progress.updatedAt.toISOString()
		}
	});
};
