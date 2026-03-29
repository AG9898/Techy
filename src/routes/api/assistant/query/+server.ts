import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { notes } from '$lib/server/db/schema.js';
import { ilike, sql } from 'drizzle-orm';
import { queryAssistant } from '$lib/server/ai/claude.js';

const noteFields = {
	id: notes.id,
	title: notes.title,
	slug: notes.slug,
	body: notes.body,
	aliases: notes.aliases
};

/**
 * POST /api/assistant/query
 * Body: { query: string }
 *
 * Resolves a natural-language request to an existing note (by title or alias),
 * then returns a Claude-grounded summary, possible gap suggestions, and 3 new topic ideas.
 */
export const POST: RequestHandler = async ({ request }) => {
	let query: string;
	try {
		const data = await request.json();
		query = data?.query;
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (!query || typeof query !== 'string' || query.trim() === '') {
		return json({ error: 'Missing or empty "query" field' }, { status: 400 });
	}
	query = query.trim();
	const queryLower = query.toLowerCase();

	// 1. Exact title match (case-insensitive)
	let candidates = await db.select(noteFields).from(notes).where(sql`LOWER(${notes.title}) = ${queryLower}`).limit(1);

	// 2. Exact alias match (case-insensitive)
	if (!candidates.length) {
		candidates = await db
			.select(noteFields)
			.from(notes)
			.where(
				sql`EXISTS (SELECT 1 FROM UNNEST(${notes.aliases}) AS a WHERE LOWER(a) = ${queryLower})`
			)
			.limit(1);
	}

	// 3. Title appears in query (e.g. "tell me about SvelteKit" → note titled "SvelteKit")
	if (!candidates.length) {
		candidates = await db
			.select(noteFields)
			.from(notes)
			.where(sql`LOWER(${queryLower}) LIKE '%' || LOWER(${notes.title}) || '%'`)
			.limit(1);
	}

	// 4. Alias appears in query
	if (!candidates.length) {
		candidates = await db
			.select(noteFields)
			.from(notes)
			.where(
				sql`EXISTS (SELECT 1 FROM UNNEST(${notes.aliases}) AS a WHERE LOWER(${queryLower}) LIKE '%' || LOWER(a) || '%')`
			)
			.limit(1);
	}

	// 5. Partial title match (fallback)
	if (!candidates.length) {
		candidates = await db
			.select(noteFields)
			.from(notes)
			.where(ilike(notes.title, `%${query}%`))
			.limit(1);
	}

	if (!candidates.length) {
		return json({ error: `No note found matching "${query}"` }, { status: 404 });
	}

	const matched = candidates[0];

	// Load all existing titles and aliases for newTopicIdeas de-duplication
	const allNotes = await db.select({ title: notes.title, aliases: notes.aliases }).from(notes);
	const existingTopics = [
		...allNotes.map((n) => n.title),
		...allNotes.flatMap((n) => n.aliases)
	].filter(Boolean);

	let aiResult;
	try {
		aiResult = await queryAssistant(
			{ title: matched.title, body: matched.body },
			query,
			existingTopics
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (
			message.includes('401') ||
			message.includes('invalid_api_key') ||
			message.includes('authentication')
		) {
			return json({ error: 'Invalid or missing ANTHROPIC_API_KEY' }, { status: 401 });
		}
		if (message.includes('429') || message.includes('rate_limit')) {
			return json({ error: 'Rate limit exceeded — try again later' }, { status: 429 });
		}
		console.error('[/api/assistant/query]', err);
		return json({ error: 'Assistant query failed' }, { status: 500 });
	}

	return json({
		matchedNote: {
			id: matched.id,
			title: matched.title,
			slug: matched.slug,
			url: `/notes/${matched.slug}`
		},
		summary: aiResult.summary,
		possibleGaps: aiResult.possibleGaps ?? [],
		newTopicIdeas: aiResult.newTopicIdeas ?? []
	});
};
