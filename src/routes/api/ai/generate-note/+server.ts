import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { generateNote } from '$lib/server/ai/claude.js';
import { parseFrontmatter } from '$lib/utils/frontmatter.js';
import { slugify } from '$lib/utils/slugify.js';
import { extractWikilinks } from '$lib/utils/wikilinks.js';
import { db } from '$lib/server/db/index.js';
import { notes, noteLinks } from '$lib/server/db/schema.js';
import { eq, or } from 'drizzle-orm';

/**
 * POST /api/ai/generate-note
 * Body: { topic: string, provider?: 'claude' | 'chatgpt' }
 *
 * Generates a full note from a topic prompt via Claude, inserts it into the DB,
 * syncs [[wikilinks]], and returns the created note metadata.
 */
export const POST: RequestHandler = async ({ request }) => {
	let topic: string;
	try {
		const data = await request.json();
		topic = data?.topic;
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (!topic || typeof topic !== 'string' || topic.trim() === '') {
		return json({ error: 'Missing or empty "topic" field' }, { status: 400 });
	}
	topic = topic.trim();

	let markdown: string;
	try {
		markdown = await generateNote(topic);
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
		console.error('[/api/ai/generate-note]', err);
		return json({ error: 'AI note generation failed' }, { status: 500 });
	}

	// Parse frontmatter from the AI-generated markdown
	const parsed = parseFrontmatter(markdown);
	const title = parsed?.title ?? topic;
	const body = parsed?.body ?? markdown;
	const tags = parsed?.tags ?? [];
	const aliases = parsed?.aliases ?? [];
	const category = parsed?.category ?? null;
	const status = (parsed?.status as 'stub' | 'growing' | 'mature') ?? 'stub';

	const slug = slugify(title);

	// Check for duplicate slug or title — handle gracefully
	const conflicts = await db
		.select({ id: notes.id, title: notes.title, slug: notes.slug })
		.from(notes)
		.where(or(eq(notes.slug, slug), eq(notes.title, title)));

	if (conflicts.length > 0) {
		const conflict = conflicts[0];
		if (conflict.slug === slug) {
			return json(
				{ error: `A note with the slug "${slug}" already exists`, conflictId: conflict.id },
				{ status: 409 }
			);
		}
		return json(
			{ error: `A note titled "${title}" already exists`, conflictId: conflict.id },
			{ status: 409 }
		);
	}

	const [inserted] = await db
		.insert(notes)
		.values({
			title,
			slug,
			body,
			tags,
			aliases,
			category,
			status,
			aiGenerated: true,
			aiModel: 'claude-opus-4-6',
			aiPrompt: topic
		})
		.returning({ id: notes.id, slug: notes.slug, title: notes.title });

	// Sync [[wikilinks]] to note_links
	const linkedTitles = extractWikilinks(body);
	if (linkedTitles.length > 0) {
		const allNotes = await db.select({ id: notes.id, title: notes.title }).from(notes);
		const titleToId = new Map(allNotes.map((n) => [n.title, n.id]));

		const linkRows = linkedTitles
			.map((t) => titleToId.get(t))
			.filter((targetId): targetId is string => !!targetId && targetId !== inserted.id)
			.map((targetId) => ({ sourceNoteId: inserted.id, targetNoteId: targetId }));

		if (linkRows.length > 0) {
			await db.insert(noteLinks).values(linkRows);
		}
	}

	return json({ note: { id: inserted.id, slug: inserted.slug, title: inserted.title } }, { status: 201 });
};
