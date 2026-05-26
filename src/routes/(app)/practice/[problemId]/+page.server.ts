import { db } from '$lib/server/db/index.js';
import { practiceProblems } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { loadProgress } from '$lib/server/practice/progress.js';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ params, locals }) => {
	const session = await locals.auth();
	const userId = session!.user!.id!;

	const rows = await db
		.select()
		.from(practiceProblems)
		.where(eq(practiceProblems.id, params.problemId))
		.limit(1);

	if (rows.length === 0) {
		error(404, 'Problem not found');
	}

	const problem = rows[0];
	const progressRow = await loadProgress(userId, problem.id);

	const progress = {
		status: (progressRow?.status ?? 'not_started') as
			| 'not_started'
			| 'in_progress'
			| 'completed'
			| 'skipped',
		attempts: progressRow?.attempts ?? 0,
		notes: progressRow?.notes ?? '',
		codeSnapshot: progressRow?.codeSnapshot ?? null,
		completedAt: progressRow?.completedAt ? progressRow.completedAt.toISOString() : null,
		updatedAt: progressRow?.updatedAt ? progressRow.updatedAt.toISOString() : null
	};

	return { problem, progress };
};
