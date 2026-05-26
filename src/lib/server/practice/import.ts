/**
 * Practice problem ingestion — normalized write path
 *
 * Validates an incoming problem shape (from either manual JSON import or the
 * LeetCode daily-fetch boundary) and upserts it into `practice_problems`.
 *
 * Both ingestion paths funnel through `upsertPracticeProblem` so every stored
 * row has the same normalized shape regardless of origin.
 */

import { db } from '$lib/server/db/index.js';
import { practiceProblems } from '$lib/server/db/schema.js';
import type { PracticeProblem } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';

// ── Shared normalized problem shape ──────────────────────────────────────────

export interface NormalizedProblem {
	source: string;
	sourceSlug: string | null;
	sourceUrl: string;
	title: string;
	difficulty: string | null;
	dailyDate: string | null; // ISO date string "YYYY-MM-DD" or null
	promptMarkdown: string;
	examples: unknown | null;
	constraints: unknown | null;
	topicTags: string[];
}

// ── Manual import input schema ────────────────────────────────────────────────

export interface ManualImportInput {
	source: string;
	sourceSlug?: string;
	sourceUrl: string;
	title: string;
	difficulty?: string;
	dailyDate?: string;
	promptMarkdown: string;
	examples?: unknown;
	constraints?: unknown;
	topicTags?: string[];
}

export interface ImportValidationError {
	field: string;
	message: string;
}

/** Validate a raw manual import body and return a normalized problem. */
export function validateManualImport(
	raw: unknown
): { ok: true; problem: NormalizedProblem } | { ok: false; errors: ImportValidationError[] } {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return { ok: false, errors: [{ field: 'body', message: 'Request body must be a JSON object' }] };
	}

	const obj = raw as Record<string, unknown>;
	const errors: ImportValidationError[] = [];

	if (!obj.source || typeof obj.source !== 'string' || !obj.source.trim()) {
		errors.push({ field: 'source', message: 'source is required' });
	}
	if (!obj.sourceUrl || typeof obj.sourceUrl !== 'string' || !obj.sourceUrl.trim()) {
		errors.push({ field: 'sourceUrl', message: 'sourceUrl is required' });
	}
	if (!obj.title || typeof obj.title !== 'string' || !obj.title.trim()) {
		errors.push({ field: 'title', message: 'title is required' });
	}
	if (!obj.promptMarkdown || typeof obj.promptMarkdown !== 'string' || !obj.promptMarkdown.trim()) {
		errors.push({ field: 'promptMarkdown', message: 'promptMarkdown is required' });
	}

	if (errors.length > 0) return { ok: false, errors };

	const input = obj as unknown as ManualImportInput;

	return {
		ok: true,
		problem: {
			source: (input.source as string).trim(),
			sourceSlug: input.sourceSlug ? String(input.sourceSlug).trim() : null,
			sourceUrl: (input.sourceUrl as string).trim(),
			title: (input.title as string).trim(),
			difficulty: input.difficulty ? String(input.difficulty).trim() : null,
			dailyDate: input.dailyDate ? String(input.dailyDate).trim() : null,
			promptMarkdown: (input.promptMarkdown as string).trim(),
			examples: input.examples !== undefined ? input.examples : null,
			constraints: input.constraints !== undefined ? input.constraints : null,
			topicTags: Array.isArray(input.topicTags)
				? input.topicTags.map((t) => String(t).trim()).filter(Boolean)
				: []
		}
	};
}

// ── Normalized upsert path ────────────────────────────────────────────────────

export interface UpsertResult {
	problem: PracticeProblem;
	created: boolean;
}

/**
 * Upsert a normalized practice problem.
 *
 * Matching strategy:
 * 1. If `sourceSlug` is provided, match on `(source, sourceSlug)`.
 * 2. Else if `dailyDate` is provided, match on `(source, dailyDate)`.
 * 3. Otherwise always insert a new row.
 *
 * When a match is found the row is updated to reflect the latest fetched/imported
 * data; otherwise a new row is inserted.
 */
export async function upsertPracticeProblem(
	normalized: NormalizedProblem,
	origin: 'fetch' | 'import'
): Promise<UpsertResult> {
	const now = new Date();
	const timestampField = origin === 'fetch' ? { fetchedAt: now } : { importedAt: now };

	// Attempt to find an existing row
	let existing: PracticeProblem | undefined;

	if (normalized.sourceSlug) {
		const rows = await db
			.select()
			.from(practiceProblems)
			.where(
				and(
					eq(practiceProblems.source, normalized.source),
					eq(practiceProblems.sourceSlug, normalized.sourceSlug)
				)
			)
			.limit(1);
		existing = rows[0];
	} else if (normalized.dailyDate) {
		const rows = await db
			.select()
			.from(practiceProblems)
			.where(
				and(
					eq(practiceProblems.source, normalized.source),
					eq(practiceProblems.dailyDate, normalized.dailyDate)
				)
			)
			.limit(1);
		existing = rows[0];
	}

	if (existing) {
		const updated = await db
			.update(practiceProblems)
			.set({
				sourceUrl: normalized.sourceUrl,
				title: normalized.title,
				difficulty: normalized.difficulty,
				dailyDate: normalized.dailyDate,
				promptMarkdown: normalized.promptMarkdown,
				examples: normalized.examples,
				constraints: normalized.constraints,
				topicTags: normalized.topicTags,
				updatedAt: now,
				...timestampField
			})
			.where(eq(practiceProblems.id, existing.id))
			.returning();

		return { problem: updated[0], created: false };
	}

	const inserted = await db
		.insert(practiceProblems)
		.values({
			source: normalized.source,
			sourceSlug: normalized.sourceSlug,
			sourceUrl: normalized.sourceUrl,
			title: normalized.title,
			difficulty: normalized.difficulty,
			dailyDate: normalized.dailyDate,
			promptMarkdown: normalized.promptMarkdown,
			examples: normalized.examples,
			constraints: normalized.constraints,
			topicTags: normalized.topicTags,
			...timestampField
		})
		.returning();

	return { problem: inserted[0], created: true };
}
