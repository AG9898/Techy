import { db } from '$lib/server/db/index.js';
import { notes, noteLinks } from '$lib/server/db/schema.js';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async () => {
	const [allNotes, allLinks] = await Promise.all([
		db.select({ id: notes.id, slug: notes.slug, title: notes.title, status: notes.status, category: notes.category }).from(notes),
		db.select({ source: noteLinks.sourceNoteId, target: noteLinks.targetNoteId }).from(noteLinks)
	]);

	return {
		nodes: allNotes,
		links: allLinks.map((l) => ({ source: l.source, target: l.target }))
	};
};
