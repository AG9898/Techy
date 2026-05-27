import { db } from '$lib/server/db/index.js';
import { practiceProblems, practiceProgress } from '$lib/server/db/schema.js';
import { isPracticeSchemaUnavailableError } from '$lib/server/practice/schema-availability.js';
import { desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ locals }) => {
	const session = await locals.auth();
	const userId = session!.user!.id!;

	// Load recent problems ordered by most recent daily date or created date
	let recentRows: {
		id: string;
		title: string;
		source: string;
		sourceUrl: string;
		difficulty: string | null;
		dailyDate: string | null;
		createdAt: Date;
	}[];

	try {
		recentRows = await db
			.select({
				id: practiceProblems.id,
				title: practiceProblems.title,
				source: practiceProblems.source,
				sourceUrl: practiceProblems.sourceUrl,
				difficulty: practiceProblems.difficulty,
				dailyDate: practiceProblems.dailyDate,
				createdAt: practiceProblems.createdAt
			})
			.from(practiceProblems)
			.orderBy(desc(practiceProblems.createdAt))
			.limit(20);
	} catch (err) {
		if (!isPracticeSchemaUnavailableError(err)) throw err;
		console.error('[practice] Practice database tables are missing. Run migrations.');
		return {
			dailyProblem: null,
			recentProblems: [],
			stats: { completed: 0, inProgress: 0, streakDays: 0 }
		};
	}

	if (recentRows.length === 0) {
		return {
			dailyProblem: null,
			recentProblems: [],
			stats: { completed: 0, inProgress: 0, streakDays: 0 }
		};
	}

	// Load progress rows for this user
	const progressRows = await db
		.select({
			problemId: practiceProgress.problemId,
			status: practiceProgress.status,
			completedAt: practiceProgress.completedAt
		})
		.from(practiceProgress)
		.where(eq(practiceProgress.userId, userId));

	const progressByProblemId = new Map(progressRows.map((p) => [p.problemId, p]));

	// Determine daily problem: most recent with a dailyDate, or most recent overall
	const today = new Date().toISOString().slice(0, 10);
	const dailyRow =
		recentRows.find((r) => r.dailyDate === today) ??
		recentRows.find((r) => r.dailyDate != null) ??
		recentRows[0];

	const dailyProblemFull = dailyRow
		? await db
				.select()
				.from(practiceProblems)
				.where(eq(practiceProblems.id, dailyRow.id))
				.limit(1)
				.then((rows) => rows[0] ?? null)
		: null;

	// Build recent list with progress status
	const recentProblems = recentRows.map((r) => {
		const prog = progressByProblemId.get(r.id);
		return {
			id: r.id,
			title: r.title,
			source: r.source,
			sourceUrl: r.sourceUrl,
			difficulty: r.difficulty,
			dailyDate: r.dailyDate ? String(r.dailyDate) : null,
			status: (prog?.status ?? 'not_started') as
				| 'not_started'
				| 'in_progress'
				| 'completed'
				| 'skipped',
			completedAt: prog?.completedAt ? prog.completedAt.toISOString() : null
		};
	});

	// Compute stats
	let completed = 0;
	let inProgress = 0;
	for (const p of progressRows) {
		if (p.status === 'completed') completed++;
		else if (p.status === 'in_progress') inProgress++;
	}

	// Simple streak: consecutive days with at least one completed problem
	const completedDates = progressRows
		.filter((p) => p.status === 'completed' && p.completedAt)
		.map((p) => p.completedAt!.toISOString().slice(0, 10))
		.sort()
		.reverse();

	let streakDays = 0;
	if (completedDates.length > 0) {
		const uniqueDates = [...new Set(completedDates)];
		let checkDate = new Date(today);
		for (const d of uniqueDates) {
			const checkStr = checkDate.toISOString().slice(0, 10);
			if (d === checkStr) {
				streakDays++;
				checkDate.setDate(checkDate.getDate() - 1);
			} else {
				break;
			}
		}
	}

	return {
		dailyProblem: dailyProblemFull,
		recentProblems,
		stats: { completed, inProgress, streakDays }
	};
};
