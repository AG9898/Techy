import { db } from '$lib/server/db/index.js';
import { notes, noteRevisions } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { marked } from 'marked';
import { resolveWikilinks } from '$lib/utils/wikilinks.js';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ params }) => {
	const [note] = await db
		.select({ id: notes.id, title: notes.title, slug: notes.slug })
		.from(notes)
		.where(eq(notes.slug, params.slug));

	if (!note) {
		error(404, 'Note not found');
	}

	const [revision] = await db
		.select()
		.from(noteRevisions)
		.where(eq(noteRevisions.id, params.revisionId));

	if (!revision || revision.noteId !== note.id) {
		error(404, 'Revision not found');
	}

	// Render the revision body with wikilinks resolved
	const allNotes = await db.select({ title: notes.title, slug: notes.slug }).from(notes);
	const slugMap = new Map(allNotes.map((n) => [n.title, n.slug]));
	const resolvedBody = resolveWikilinks(revision.body, slugMap);
	const htmlBody = await marked(resolvedBody);

	return { note, revision, htmlBody };
};
