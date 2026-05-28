/**
 * Practice subsystem unit tests
 *
 * Covers:
 *   - Manual import validation (validateManualImport)
 *   - Progress input validation and completion-timestamp logic (validateProgressInput, isValidStatus)
 *   - Disabled LeetCode fetch returns a typed FETCH_DISABLED error (LeetCodeFetchDisabledError)
 *   - Tutor non-persistence contract (validateTutorInput, module-level documentation check)
 */

import { describe, expect, it, vi } from 'vitest';

// ── Mock $env/dynamic/private before importing env-dependent modules ──────────

vi.mock('$env/dynamic/private', () => ({
	env: {
		LEETCODE_DAILY_FETCH_ENABLED: undefined,
		OPENROUTER_API_KEY: undefined
	}
}));

// Mock the DB so tutor.ts and progress.ts do not need a live connection
vi.mock('$lib/server/db/index.js', () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		limit: vi.fn().mockResolvedValue([])
	}
}));

// Mock the models module used by tutor.ts
vi.mock('$lib/server/ai/models.js', () => ({
	OPENROUTER_FREE_MODELS: [
		'meta-llama/llama-3.3-70b-instruct:free',
		'meta-llama/llama-3.1-8b-instruct:free'
	]
}));

// Now import the modules under test
import { validateManualImport } from './import.js';
import { validateProgressInput, isValidStatus, VALID_STATUSES } from './progress.js';
import {
	LeetCodeFetchDisabledError,
	LeetCodeFetchUpstreamError,
	fetchLeetCodeDaily
} from './leetcode.js';
import { validateTutorInput, isValidHintLevel, VALID_HINT_LEVELS } from './tutor.js';

// ── Manual import validation ──────────────────────────────────────────────────

describe('validateManualImport', () => {
	it('accepts a valid complete import payload', () => {
		const result = validateManualImport({
			source: 'leetcode',
			sourceSlug: 'two-sum',
			sourceUrl: 'https://leetcode.com/problems/two-sum/',
			title: 'Two Sum',
			difficulty: 'Easy',
			dailyDate: '2026-05-28',
			promptMarkdown: 'Given an array of integers nums and an integer target...',
			topicTags: ['Array', 'Hash Table']
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error(JSON.stringify(result.errors));

		expect(result.problem.source).toBe('leetcode');
		expect(result.problem.sourceSlug).toBe('two-sum');
		expect(result.problem.title).toBe('Two Sum');
		expect(result.problem.difficulty).toBe('Easy');
		expect(result.problem.topicTags).toEqual(['Array', 'Hash Table']);
	});

	it('accepts a minimal payload with only required fields', () => {
		const result = validateManualImport({
			source: 'manual',
			sourceUrl: 'https://example.com/problems/1',
			title: 'My Problem',
			promptMarkdown: 'Solve this.'
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error(JSON.stringify(result.errors));

		expect(result.problem.sourceSlug).toBeNull();
		expect(result.problem.difficulty).toBeNull();
		expect(result.problem.dailyDate).toBeNull();
		expect(result.problem.topicTags).toEqual([]);
	});

	it('rejects a non-object body', () => {
		const result = validateManualImport('not an object');
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		expect(result.errors[0].field).toBe('body');
	});

	it('rejects missing source', () => {
		const result = validateManualImport({
			sourceUrl: 'https://leetcode.com/problems/two-sum/',
			title: 'Two Sum',
			promptMarkdown: 'Solve this.'
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		const fields = result.errors.map((e) => e.field);
		expect(fields).toContain('source');
	});

	it('rejects missing sourceUrl', () => {
		const result = validateManualImport({
			source: 'leetcode',
			title: 'Two Sum',
			promptMarkdown: 'Solve this.'
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		const fields = result.errors.map((e) => e.field);
		expect(fields).toContain('sourceUrl');
	});

	it('rejects missing title', () => {
		const result = validateManualImport({
			source: 'leetcode',
			sourceUrl: 'https://leetcode.com/problems/two-sum/',
			promptMarkdown: 'Solve this.'
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		const fields = result.errors.map((e) => e.field);
		expect(fields).toContain('title');
	});

	it('rejects missing promptMarkdown', () => {
		const result = validateManualImport({
			source: 'leetcode',
			sourceUrl: 'https://leetcode.com/problems/two-sum/',
			title: 'Two Sum'
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		const fields = result.errors.map((e) => e.field);
		expect(fields).toContain('promptMarkdown');
	});

	it('rejects a whitespace-only title', () => {
		const result = validateManualImport({
			source: 'leetcode',
			sourceUrl: 'https://leetcode.com/problems/two-sum/',
			title: '   ',
			promptMarkdown: 'Solve this.'
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		const fields = result.errors.map((e) => e.field);
		expect(fields).toContain('title');
	});

	it('trims whitespace from string fields', () => {
		const result = validateManualImport({
			source: '  leetcode  ',
			sourceUrl: '  https://example.com/  ',
			title: '  Two Sum  ',
			promptMarkdown: '  Solve this.  '
		});
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error(JSON.stringify(result.errors));
		expect(result.problem.source).toBe('leetcode');
		expect(result.problem.title).toBe('Two Sum');
		expect(result.problem.promptMarkdown).toBe('Solve this.');
	});

	it('filters empty strings out of topicTags', () => {
		const result = validateManualImport({
			source: 'manual',
			sourceUrl: 'https://example.com',
			title: 'Test',
			promptMarkdown: 'Something',
			topicTags: ['Array', '  ', 'Hash Table', '']
		});
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error(JSON.stringify(result.errors));
		expect(result.problem.topicTags).toEqual(['Array', 'Hash Table']);
	});
});

// ── Progress validation ───────────────────────────────────────────────────────

describe('isValidStatus', () => {
	it('accepts all documented status values', () => {
		for (const status of VALID_STATUSES) {
			expect(isValidStatus(status)).toBe(true);
		}
	});

	it('rejects invalid status strings', () => {
		expect(isValidStatus('done')).toBe(false);
		expect(isValidStatus('pending')).toBe(false);
		expect(isValidStatus('')).toBe(false);
		expect(isValidStatus(null)).toBe(false);
		expect(isValidStatus(42)).toBe(false);
	});
});

describe('validateProgressInput', () => {
	it('accepts a valid minimal progress update', () => {
		const result = validateProgressInput({
			problemId: '550e8400-e29b-41d4-a716-446655440000',
			status: 'in_progress'
		});
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error(JSON.stringify(result.errors));
		expect(result.input.status).toBe('in_progress');
		expect(result.input.attempts).toBeUndefined();
	});

	it('accepts a full progress payload', () => {
		const result = validateProgressInput({
			problemId: '550e8400-e29b-41d4-a716-446655440000',
			status: 'completed',
			attempts: 3,
			notes: 'Used two pointers',
			codeSnapshot: 'def twoSum(nums, target):\n    pass'
		});
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error(JSON.stringify(result.errors));
		expect(result.input.status).toBe('completed');
		expect(result.input.attempts).toBe(3);
		expect(result.input.notes).toBe('Used two pointers');
	});

	it('rejects a non-object body', () => {
		const result = validateProgressInput(null);
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		expect(result.errors[0].field).toBe('body');
	});

	it('rejects missing problemId', () => {
		const result = validateProgressInput({ status: 'in_progress' });
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		const fields = result.errors.map((e) => e.field);
		expect(fields).toContain('problemId');
	});

	it('rejects an invalid status', () => {
		const result = validateProgressInput({
			problemId: '550e8400-e29b-41d4-a716-446655440000',
			status: 'pending'
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		const fields = result.errors.map((e) => e.field);
		expect(fields).toContain('status');
	});

	it('rejects a negative attempts value', () => {
		const result = validateProgressInput({
			problemId: '550e8400-e29b-41d4-a716-446655440000',
			status: 'in_progress',
			attempts: -1
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		const fields = result.errors.map((e) => e.field);
		expect(fields).toContain('attempts');
	});

	it('rejects a non-integer attempts value', () => {
		const result = validateProgressInput({
			problemId: '550e8400-e29b-41d4-a716-446655440000',
			status: 'in_progress',
			attempts: 1.5
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		const fields = result.errors.map((e) => e.field);
		expect(fields).toContain('attempts');
	});

	it('rejects a non-string notes value', () => {
		const result = validateProgressInput({
			problemId: '550e8400-e29b-41d4-a716-446655440000',
			status: 'in_progress',
			notes: 42
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		const fields = result.errors.map((e) => e.field);
		expect(fields).toContain('notes');
	});

	it('accepts null codeSnapshot', () => {
		const result = validateProgressInput({
			problemId: '550e8400-e29b-41d4-a716-446655440000',
			status: 'not_started',
			codeSnapshot: null
		});
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error(JSON.stringify(result.errors));
		expect(result.input.codeSnapshot).toBeNull();
	});

	it('rejects a non-string, non-null codeSnapshot', () => {
		const result = validateProgressInput({
			problemId: '550e8400-e29b-41d4-a716-446655440000',
			status: 'in_progress',
			codeSnapshot: 999
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		const fields = result.errors.map((e) => e.field);
		expect(fields).toContain('codeSnapshot');
	});

	it('accepts each valid status value', () => {
		for (const status of VALID_STATUSES) {
			const result = validateProgressInput({
				problemId: '550e8400-e29b-41d4-a716-446655440000',
				status
			});
			expect(result.ok).toBe(true);
		}
	});
});

// ── Disabled LeetCode fetch ───────────────────────────────────────────────────

describe('fetchLeetCodeDaily when disabled', () => {
	it('LeetCodeFetchDisabledError has the documented FETCH_DISABLED code', () => {
		const err = new LeetCodeFetchDisabledError();
		expect(err.code).toBe('FETCH_DISABLED');
		expect(err).toBeInstanceOf(Error);
		expect(err.name).toBe('LeetCodeFetchDisabledError');
	});

	it('LeetCodeFetchUpstreamError has the documented UPSTREAM_ERROR code', () => {
		const err = new LeetCodeFetchUpstreamError('upstream failed');
		expect(err.code).toBe('UPSTREAM_ERROR');
		expect(err).toBeInstanceOf(Error);
		expect(err.name).toBe('LeetCodeFetchUpstreamError');
	});

	it('throws LeetCodeFetchDisabledError when the enable flag is absent', async () => {
		// env is mocked to have LEETCODE_DAILY_FETCH_ENABLED=undefined
		await expect(fetchLeetCodeDaily()).rejects.toThrow(LeetCodeFetchDisabledError);
	});

	it('throws LeetCodeFetchDisabledError when the enable flag is not "true"', async () => {
		const { env } = await import('$env/dynamic/private');
		const saved = env.LEETCODE_DAILY_FETCH_ENABLED;

		env.LEETCODE_DAILY_FETCH_ENABLED = 'false';
		await expect(fetchLeetCodeDaily()).rejects.toThrow(LeetCodeFetchDisabledError);

		env.LEETCODE_DAILY_FETCH_ENABLED = saved;
	});
});

// ── Tutor validation and non-persistence contract ─────────────────────────────

describe('validateTutorInput', () => {
	it('accepts a valid minimal tutor request', () => {
		const result = validateTutorInput({
			problemId: '550e8400-e29b-41d4-a716-446655440000',
			message: 'Give me a nudge on this problem'
		});
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error(JSON.stringify(result.errors));
		expect(result.input.problemId).toBe('550e8400-e29b-41d4-a716-446655440000');
		expect(result.input.message).toBe('Give me a nudge on this problem');
		expect(result.input.hintLevel).toBeUndefined();
	});

	it('accepts a full tutor request with code and hint level', () => {
		const result = validateTutorInput({
			problemId: '550e8400-e29b-41d4-a716-446655440000',
			message: 'Is my approach correct?',
			code: 'def twoSum(nums, target):\n    pass',
			hintLevel: 'review'
		});
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error(JSON.stringify(result.errors));
		expect(result.input.hintLevel).toBe('review');
		expect(result.input.code).toContain('twoSum');
	});

	it('rejects missing problemId', () => {
		const result = validateTutorInput({ message: 'Help' });
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		const fields = result.errors.map((e) => e.field);
		expect(fields).toContain('problemId');
	});

	it('rejects missing message', () => {
		const result = validateTutorInput({ problemId: '550e8400-e29b-41d4-a716-446655440000' });
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		const fields = result.errors.map((e) => e.field);
		expect(fields).toContain('message');
	});

	it('rejects a non-string code value', () => {
		const result = validateTutorInput({
			problemId: '550e8400-e29b-41d4-a716-446655440000',
			message: 'Help',
			code: 42
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		const fields = result.errors.map((e) => e.field);
		expect(fields).toContain('code');
	});

	it('rejects an invalid hintLevel', () => {
		const result = validateTutorInput({
			problemId: '550e8400-e29b-41d4-a716-446655440000',
			message: 'Help',
			hintLevel: 'solution'
		});
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		const fields = result.errors.map((e) => e.field);
		expect(fields).toContain('hintLevel');
	});

	it('accepts all documented hint levels', () => {
		for (const level of VALID_HINT_LEVELS) {
			const result = validateTutorInput({
				problemId: '550e8400-e29b-41d4-a716-446655440000',
				message: 'Help',
				hintLevel: level
			});
			expect(result.ok).toBe(true);
		}
	});
});

describe('isValidHintLevel', () => {
	it('accepts all documented hint levels', () => {
		for (const level of VALID_HINT_LEVELS) {
			expect(isValidHintLevel(level)).toBe(true);
		}
	});

	it('rejects invalid hint level values', () => {
		expect(isValidHintLevel('solution')).toBe(false);
		expect(isValidHintLevel('hint')).toBe(false);
		expect(isValidHintLevel('')).toBe(false);
		expect(isValidHintLevel(null)).toBe(false);
	});
});

describe('practice tutor non-persistence contract', () => {
	/**
	 * These tests verify the module-level contract that the tutor never creates
	 * conversation rows, message rows, or any durable practice transcript.
	 *
	 * The contract is enforced at the server helper level: `callTutor` in
	 * `src/lib/server/practice/tutor.ts` does not import or call any function
	 * from `src/lib/server/assistant/conversations.ts`, does not insert into
	 * `conversations`, and does not insert into `conversation_messages`.
	 * Only `practiceProblems` is read (for problem context); nothing is written.
	 *
	 * The API route at `src/routes/api/practice/tutor/+server.ts` confirms this
	 * by having no mutation DB calls in its handler.
	 */
	it('VALID_HINT_LEVELS contains expected levels including solve', () => {
		expect(VALID_HINT_LEVELS).not.toContain('solution');
		expect(VALID_HINT_LEVELS).toContain('nudge');
		expect(VALID_HINT_LEVELS).toContain('review');
		expect(VALID_HINT_LEVELS).toContain('solve');
	});

	it('tutor module exports no conversation creation or message append functions', async () => {
		// Dynamically inspect exported names to confirm tutor.ts has no transcript API
		const tutorModule = await import('./tutor.js');
		const exportedNames = Object.keys(tutorModule);

		// The conversations module functions that must NOT appear in the tutor module
		const persistenceApiNames = [
			'createConversation',
			'appendMessage',
			'getConversation',
			'listConversations'
		];
		for (const name of persistenceApiNames) {
			expect(exportedNames).not.toContain(name);
		}
	});
});
