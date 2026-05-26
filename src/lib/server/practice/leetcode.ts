/**
 * LeetCode daily challenge fetch boundary — unofficial, fragile, opt-in only.
 *
 * This module MUST:
 *   - be guarded by `LEETCODE_DAILY_FETCH_ENABLED`
 *   - run only server-side, never in client code
 *   - use no LeetCode credentials or browser automation
 *   - fail closed with a typed error when disabled, unavailable, or when the
 *     upstream shape has changed
 *
 * See ADR-025 for the decision rationale and known trade-offs.
 */

import { env } from '$env/dynamic/private';
import type { NormalizedProblem } from './import.js';

// ── Typed errors ──────────────────────────────────────────────────────────────

export class LeetCodeFetchDisabledError extends Error {
	readonly code = 'FETCH_DISABLED' as const;
	constructor() {
		super(
			'LeetCode daily fetch is disabled. Set LEETCODE_DAILY_FETCH_ENABLED=true to enable it.'
		);
		this.name = 'LeetCodeFetchDisabledError';
	}
}

export class LeetCodeFetchUpstreamError extends Error {
	readonly code = 'UPSTREAM_ERROR' as const;
	constructor(message: string) {
		super(message);
		this.name = 'LeetCodeFetchUpstreamError';
	}
}

// ── Unofficial LeetCode GraphQL endpoint ─────────────────────────────────────

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';

const DAILY_CHALLENGE_QUERY = `
  query questionOfToday {
    activeDailyCodingChallengeQuestion {
      date
      link
      question {
        questionId
        titleSlug
        title
        difficulty
        content
        topicTags {
          name
          slug
        }
        exampleTestcases
        constraints: content
      }
    }
  }
`;

// ── Raw upstream shape (loose — may change without notice) ────────────────────

interface LeetCodeTag {
	name: string;
	slug: string;
}

interface LeetCodeQuestion {
	questionId: string;
	titleSlug: string;
	title: string;
	difficulty: string;
	content: string;
	topicTags: LeetCodeTag[];
	exampleTestcases: string;
}

interface LeetCodeDailyChallenge {
	date: string;
	link: string;
	question: LeetCodeQuestion;
}

interface LeetCodeGraphQLResponse {
	data?: {
		activeDailyCodingChallengeQuestion?: LeetCodeDailyChallenge;
	};
	errors?: { message: string }[];
}

// ── Normalizer ────────────────────────────────────────────────────────────────

/**
 * Map the raw LeetCode GraphQL response to Techy's normalized problem shape.
 * Throws `LeetCodeFetchUpstreamError` if any required field is absent.
 */
function normalizeResponse(raw: LeetCodeGraphQLResponse): NormalizedProblem {
	if (raw.errors?.length) {
		throw new LeetCodeFetchUpstreamError(
			`LeetCode GraphQL error: ${raw.errors.map((e) => e.message).join('; ')}`
		);
	}

	const challenge = raw.data?.activeDailyCodingChallengeQuestion;
	if (!challenge) {
		throw new LeetCodeFetchUpstreamError(
			'LeetCode response did not include activeDailyCodingChallengeQuestion'
		);
	}

	const q = challenge.question;
	if (!q || !q.title || !q.titleSlug || !q.content) {
		throw new LeetCodeFetchUpstreamError(
			'LeetCode response is missing required question fields (title, titleSlug, or content)'
		);
	}

	const sourceUrl = challenge.link
		? `https://leetcode.com${challenge.link}`
		: `https://leetcode.com/problems/${q.titleSlug}/`;

	// Strip HTML tags from content for the prompt markdown
	// We keep a minimal strip so the stored markdown is readable without a full HTML parser.
	const promptMarkdown = htmlToMarkdown(q.content);

	const topicTags = Array.isArray(q.topicTags) ? q.topicTags.map((t) => t.name) : [];

	return {
		source: 'leetcode',
		sourceSlug: q.titleSlug,
		sourceUrl,
		title: q.title,
		difficulty: q.difficulty || null,
		dailyDate: challenge.date || null,
		promptMarkdown,
		examples: q.exampleTestcases ? { raw: q.exampleTestcases } : null,
		constraints: null,
		topicTags
	};
}

/**
 * Minimal HTML-to-text conversion for LeetCode problem content.
 * Does not depend on a full HTML parser — replaces common tags with their
 * Markdown equivalents and strips the rest.
 */
function htmlToMarkdown(html: string): string {
	return html
		.replace(/<pre>([\s\S]*?)<\/pre>/gi, (_, inner) => `\`\`\`\n${inner.trim()}\n\`\`\``)
		.replace(/<code>([\s\S]*?)<\/code>/gi, (_, inner) => `\`${inner}\``)
		.replace(/<strong>([\s\S]*?)<\/strong>/gi, (_, inner) => `**${inner}**`)
		.replace(/<em>([\s\S]*?)<\/em>/gi, (_, inner) => `_${inner}_`)
		.replace(/<li>([\s\S]*?)<\/li>/gi, (_, inner) => `- ${inner.trim()}`)
		.replace(/<p>([\s\S]*?)<\/p>/gi, (_, inner) => `${inner.trim()}\n\n`)
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

// ── Public fetch function ─────────────────────────────────────────────────────

/**
 * Fetch the current LeetCode daily challenge and return a normalized problem.
 *
 * Throws `LeetCodeFetchDisabledError` when the feature flag is not set.
 * Throws `LeetCodeFetchUpstreamError` when the fetch or parse fails.
 */
export async function fetchLeetCodeDaily(): Promise<NormalizedProblem> {
	const enabled = env.LEETCODE_DAILY_FETCH_ENABLED;
	if (!enabled || enabled !== 'true') {
		throw new LeetCodeFetchDisabledError();
	}

	let response: Response;
	try {
		response = await fetch(LEETCODE_GRAPHQL_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': 'Mozilla/5.0 (compatible; Techy/1.0; personal-use)',
				Referer: 'https://leetcode.com/'
			},
			body: JSON.stringify({ query: DAILY_CHALLENGE_QUERY }),
			signal: AbortSignal.timeout(10_000)
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new LeetCodeFetchUpstreamError(`LeetCode fetch failed: ${message}`);
	}

	if (!response.ok) {
		throw new LeetCodeFetchUpstreamError(
			`LeetCode returned HTTP ${response.status} ${response.statusText}`
		);
	}

	let body: LeetCodeGraphQLResponse;
	try {
		body = (await response.json()) as LeetCodeGraphQLResponse;
	} catch {
		throw new LeetCodeFetchUpstreamError('LeetCode response body was not valid JSON');
	}

	return normalizeResponse(body);
}
