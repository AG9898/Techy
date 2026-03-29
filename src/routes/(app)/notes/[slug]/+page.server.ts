import { db } from '$lib/server/db/index.js';
import { notes, noteLinks } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { marked } from 'marked';
import { resolveWikilinks } from '$lib/utils/wikilinks.js';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ params }) => {
	const [note] = await db.select().from(notes).where(eq(notes.slug, params.slug));

	if (!note) {
		error(404, 'Note not found');
	}

	// Load outgoing and incoming links
	const [outgoing, incoming] = await Promise.all([
		db
			.select({ id: notes.id, title: notes.title, slug: notes.slug, status: notes.status })
			.from(notes)
			.innerJoin(noteLinks, eq(noteLinks.targetNoteId, notes.id))
			.where(eq(noteLinks.sourceNoteId, note.id)),
		db
			.select({ id: notes.id, title: notes.title, slug: notes.slug, status: notes.status })
			.from(notes)
			.innerJoin(noteLinks, eq(noteLinks.sourceNoteId, notes.id))
			.where(eq(noteLinks.targetNoteId, note.id))
	]);

	// Build slug map for wikilink resolution
	const allNotes = await db.select({ title: notes.title, slug: notes.slug }).from(notes);
	const slugMap = new Map(allNotes.map((n) => [n.title, n.slug]));

	// Resolve [[wikilinks]] then parse markdown
	const resolvedBody = resolveWikilinks(note.body, slugMap);
	const htmlBody = await marked(resolvedBody);

	return { note, htmlBody, outgoing, incoming };
};
