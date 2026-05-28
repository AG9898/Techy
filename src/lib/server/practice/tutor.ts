/**
 * Practice tutor — transient OpenRouter tutoring prompt
 *
 * Builds a narrow practice-specific tutoring prompt and calls OpenRouter.
 * No conversation rows, no message rows, no transcript persistence.
 * All tutor exchanges are runtime-only and are discarded after the response.
 */

import OpenAI from 'openai';
import { env } from '$env/dynamic/private';
import { OPENROUTER_FREE_MODELS } from '$lib/server/ai/models.js';
import { db } from '$lib/server/db/index.js';
import { practiceProblems } from '$lib/server/db/schema.js';
import type { PracticeProblem } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// ── Hint level ────────────────────────────────────────────────────────────────

export const VALID_HINT_LEVELS = ['nudge', 'pattern', 'approach', 'review', 'solve'] as const;
export type HintLevel = (typeof VALID_HINT_LEVELS)[number];

export function isValidHintLevel(value: unknown): value is HintLevel {
	return typeof value === 'string' && (VALID_HINT_LEVELS as readonly string[]).includes(value);
}

// ── Input / output shapes ─────────────────────────────────────────────────────

export interface TutorInput {
	problemId: string;
	message: string;
	code?: string;
	hintLevel?: HintLevel;
}

export interface TutorResult {
	reply: string;
	model: string;
}

export interface TutorValidationError {
	field: string;
	message: string;
}

// ── Request validation ────────────────────────────────────────────────────────

export function validateTutorInput(
	raw: unknown
): { ok: true; input: TutorInput } | { ok: false; errors: TutorValidationError[] } {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return {
			ok: false,
			errors: [{ field: 'body', message: 'Request body must be a JSON object' }]
		};
	}

	const obj = raw as Record<string, unknown>;
	const errors: TutorValidationError[] = [];

	if (!obj.problemId || typeof obj.problemId !== 'string' || !obj.problemId.trim()) {
		errors.push({ field: 'problemId', message: 'problemId is required' });
	}

	if (!obj.message || typeof obj.message !== 'string' || !obj.message.trim()) {
		errors.push({ field: 'message', message: 'message is required' });
	}

	if (obj.code !== undefined && typeof obj.code !== 'string') {
		errors.push({ field: 'code', message: 'code must be a string when provided' });
	}

	if (obj.hintLevel !== undefined && !isValidHintLevel(obj.hintLevel)) {
		errors.push({
			field: 'hintLevel',
			message: `hintLevel must be one of: ${VALID_HINT_LEVELS.join(', ')}`
		});
	}

	if (errors.length > 0) return { ok: false, errors };

	return {
		ok: true,
		input: {
			problemId: (obj.problemId as string).trim(),
			message: (obj.message as string).trim(),
			code: obj.code !== undefined ? (obj.code as string) : undefined,
			hintLevel: obj.hintLevel !== undefined ? (obj.hintLevel as HintLevel) : undefined
		}
	};
}

// ── Problem loader ────────────────────────────────────────────────────────────

/**
 * Load a practice problem by ID. Returns `null` if not found.
 */
export async function loadProblem(problemId: string): Promise<PracticeProblem | null> {
	const rows = await db
		.select()
		.from(practiceProblems)
		.where(eq(practiceProblems.id, problemId))
		.limit(1);
	return rows[0] ?? null;
}

// ── System prompt builder ─────────────────────────────────────────────────────

function buildTutorSystemPrompt(problem: PracticeProblem, hintLevel: HintLevel): string {
	const topicContext =
		problem.topicTags && problem.topicTags.length > 0
			? `\nRelevant topic tags: ${problem.topicTags.join(', ')}.`
			: '';

	const difficultyContext = problem.difficulty ? `\nDifficulty: ${problem.difficulty}.` : '';

	const problemBlock = [
		'--- PROBLEM ---',
		`Title: ${problem.title}`,
		`Source: ${problem.source}${difficultyContext}${topicContext}`,
		'',
		problem.promptMarkdown
	].join('\n');

	if (hintLevel === 'solve') {
		return [
			'You are an expert software engineer providing a complete, well-explained solution to a coding problem.',
			'',
			'Your response must:',
			'1. State the core insight or key observation that unlocks the solution.',
			'2. Explain the chosen algorithm and data structures, and why they fit.',
			'3. Write the full working solution in clean, idiomatic code.',
			'4. Walk through the code step by step — explain what each meaningful block does and why.',
			'5. State the time and space complexity with a brief justification.',
			'6. Call out any important edge cases and how the solution handles them.',
			'',
			'Format: use clear headings and fenced code blocks. Be thorough but not verbose.',
			'',
			problemBlock
		].join('\n');
	}

	const hintInstructions: Record<Exclude<HintLevel, 'solve'>, string> = {
		nudge: 'Give the learner a single small nudge — point out what to think about next without revealing the approach or any code.',
		pattern: 'Identify the core algorithmic pattern (e.g. two-pointer, sliding window, BFS, dynamic programming) and briefly explain why it fits this problem. Do not write solution code.',
		approach: 'Walk through the high-level approach step by step. Explain the logic and trade-offs clearly. Write pseudocode only if it meaningfully aids understanding. Do not write complete solution code.',
		review: "Review the learner's submitted code for correctness, edge-case handling, and time/space complexity. Point out any bugs or improvements. You may show small corrected snippets for specific issues, but do not rewrite the full solution."
	};

	return [
		'You are a concise, Socratic coding tutor helping a developer practise algorithmic problem-solving.',
		'Your role is to guide understanding, not to hand over solutions.',
		'',
		`Current task: ${hintInstructions[hintLevel]}`,
		'',
		'Rules:',
		'- Never reveal a complete working solution.',
		'- Keep responses short and focused (under 300 words unless "review" demands more).',
		'- Prefer questions that prompt the learner to think before giving direct answers.',
		'- Use plain language. Avoid jargon unless you immediately explain it.',
		'- Do not invent constraints or examples not present in the problem.',
		'',
		problemBlock
	].join('\n');
}

// ── Tutor call ────────────────────────────────────────────────────────────────

/**
 * Call the OpenRouter tutor for a single transient practice turn.
 *
 * - No conversation rows are created.
 * - No message rows are appended.
 * - The caller owns session validation; this function only owns the AI call.
 */
export async function callTutor(
	problem: PracticeProblem,
	input: TutorInput
): Promise<TutorResult> {
	if (!env.OPENROUTER_API_KEY) {
		throw new Error('OPENROUTER_API_KEY is not configured');
	}

	const hintLevel: HintLevel = input.hintLevel ?? 'nudge';

	const client = new OpenAI({
		apiKey: env.OPENROUTER_API_KEY,
		baseURL: OPENROUTER_BASE_URL
	});

	const userContent = buildUserContent(input.message, input.code);
	const messages = [
		{ role: 'system' as const, content: buildTutorSystemPrompt(problem, hintLevel) },
		{ role: 'user' as const, content: userContent }
	];
	const maxTokens = hintLevel === 'solve' ? 2400 : 800;

	// Sequential fallback: OpenRouter's `models` array doesn't retry on upstream 429s.
	let completion;
	let lastError: unknown;
	for (const model of OPENROUTER_FREE_MODELS) {
		try {
			completion = await client.chat.completions.create({ model, messages, max_tokens: maxTokens });
			break;
		} catch (err) {
			lastError = err;
			if (err instanceof OpenAI.RateLimitError) continue;
			throw err;
		}
	}
	if (!completion) throw lastError;

	const content = completion.choices[0]?.message?.content;
	const reply = typeof content === 'string' ? content.trim() : '';

	if (!reply) {
		throw new Error('Unexpected empty response from OpenRouter tutor');
	}

	return { reply, model: completion.model ?? OPENROUTER_FREE_MODELS[0] };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildUserContent(message: string, code?: string): string {
	if (!code || !code.trim()) {
		return message;
	}
	return `${message}\n\n\`\`\`\n${code.trim()}\n\`\`\``;
}
