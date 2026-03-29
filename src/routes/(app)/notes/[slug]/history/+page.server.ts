import { db } from '$lib/server/db/index.js';
import { notes, noteRevisions } from '$lib/server/db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ params }) => {
	const [note] = await db
		.select({ id: notes.id, title: notes.title, slug: notes.slug })
		.from(notes)
		.where(eq(notes.slug, params.slug));

	if (!note) {
		error(404, 'Note not found');
	}

	const revisions = await db
		.select()
		.from(noteRevisions)
		.where(eq(noteRevisions.noteId, note.id))
		.orderBy(desc(noteRevisions.revisedAt));

	return { note, revisions };
};
