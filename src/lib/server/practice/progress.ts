/**
 * Practice progress — server helper layer
 *
 * Provides load and upsert helpers for per-user practice progress.
 * Tutor messages and provider-specific state are intentionally excluded.
 */

import { db } from '$lib/server/db/index.js';
import { practiceProgress } from '$lib/server/db/schema.js';
import type { PracticeProgress } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';

// ── Valid status values ───────────────────────────────────────────────────────

export const VALID_STATUSES = ['not_started', 'in_progress', 'completed', 'skipped'] as const;
export type ProgressStatus = (typeof VALID_STATUSES)[number];

export function isValidStatus(value: unknown): value is ProgressStatus {
	return typeof value === 'string' && (VALID_STATUSES as readonly string[]).includes(value);
}

// ── Input shape ───────────────────────────────────────────────────────────────

export interface UpsertProgressInput {
	userId: string;
	problemId: string;
	status: ProgressStatus;
	attempts?: number;
	notes?: string;
	codeSnapshot?: string | null;
}

// ── Load helper ───────────────────────────────────────────────────────────────

/**
 * Load the progress row for a given user and problem.
 * Returns `null` if no row exists yet.
 */
export async function loadProgress(
	userId: string,
	problemId: string
): Promise<PracticeProgress | null> {
	const rows = await db
		.select()
		.from(practiceProgress)
		.where(and(eq(practiceProgress.userId, userId), eq(practiceProgress.problemId, problemId)))
		.limit(1);

	return rows[0] ?? null;
}

// ── Upsert helper ─────────────────────────────────────────────────────────────

/**
 * Upsert the progress row for a given user and problem.
 *
 * Completion timestamp rules:
 * - Set `completedAt` to now when status first becomes `completed`.
 * - Preserve an existing `completedAt` if the status stays `completed`.
 * - Clear `completedAt` when the user explicitly moves out of `completed` status.
 */
export async function upsertProgress(input: UpsertProgressInput): Promise<PracticeProgress> {
	const now = new Date();

	const existing = await loadProgress(input.userId, input.problemId);

	// Determine completedAt
	let completedAt: Date | null;
	if (input.status === 'completed') {
		// Preserve existing completedAt if it was already completed; otherwise set now
		completedAt = existing?.completedAt ?? now;
	} else {
		// Moving out of completed clears the timestamp
		completedAt = null;
	}

	if (existing) {
		const updated = await db
			.update(practiceProgress)
			.set({
				status: input.status,
				attempts: input.attempts !== undefined ? input.attempts : existing.attempts,
				notes: input.notes !== undefined ? input.notes : existing.notes,
				codeSnapshot: input.codeSnapshot !== undefined ? input.codeSnapshot : existing.codeSnapshot,
				completedAt,
				updatedAt: now
			})
			.where(eq(practiceProgress.id, existing.id))
			.returning();

		return updated[0];
	}

	const inserted = await db
		.insert(practiceProgress)
		.values({
			userId: input.userId,
			problemId: input.problemId,
			status: input.status,
			attempts: input.attempts ?? 0,
			notes: input.notes ?? '',
			codeSnapshot: input.codeSnapshot ?? null,
			completedAt,
			updatedAt: now
		})
		.returning();

	return inserted[0];
}

// ── Validate request body ─────────────────────────────────────────────────────

export interface ProgressValidationError {
	field: string;
	message: string;
}

export interface ValidatedProgressInput {
	problemId: string;
	status: ProgressStatus;
	attempts?: number;
	notes?: string;
	codeSnapshot?: string | null;
}

/**
 * Validate a raw JSON request body for `POST /api/practice/progress`.
 * Returns either validated fields or a list of field-level errors.
 */
export function validateProgressInput(
	raw: unknown
): { ok: true; input: ValidatedProgressInput } | { ok: false; errors: ProgressValidationError[] } {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return {
			ok: false,
			errors: [{ field: 'body', message: 'Request body must be a JSON object' }]
		};
	}

	const obj = raw as Record<string, unknown>;
	const errors: ProgressValidationError[] = [];

	if (!obj.problemId || typeof obj.problemId !== 'string' || !obj.problemId.trim()) {
		errors.push({ field: 'problemId', message: 'problemId is required' });
	}

	if (!isValidStatus(obj.status)) {
		errors.push({
			field: 'status',
			message: `status must be one of: ${VALID_STATUSES.join(', ')}`
		});
	}

	if (obj.attempts !== undefined) {
		if (typeof obj.attempts !== 'number' || !Number.isInteger(obj.attempts) || obj.attempts < 0) {
			errors.push({ field: 'attempts', message: 'attempts must be a non-negative integer' });
		}
	}

	if (obj.notes !== undefined && typeof obj.notes !== 'string') {
		errors.push({ field: 'notes', message: 'notes must be a string' });
	}

	if (
		obj.codeSnapshot !== undefined &&
		obj.codeSnapshot !== null &&
		typeof obj.codeSnapshot !== 'string'
	) {
		errors.push({ field: 'codeSnapshot', message: 'codeSnapshot must be a string or null' });
	}

	if (errors.length > 0) return { ok: false, errors };

	return {
		ok: true,
		input: {
			problemId: (obj.problemId as string).trim(),
			status: obj.status as ProgressStatus,
			attempts: obj.attempts !== undefined ? (obj.attempts as number) : undefined,
			notes: obj.notes !== undefined ? (obj.notes as string) : undefined,
			codeSnapshot:
				obj.codeSnapshot !== undefined ? (obj.codeSnapshot as string | null) : undefined
		}
	};
}
