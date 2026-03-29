import { db } from '$lib/server/db/index.js';
import { notes, noteLinks } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import { extractWikilinks } from '$lib/utils/wikilinks.js';
import type { Actions, PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ params }) => {
	const [note] = await db.select().from(notes).where(eq(notes.slug, params.slug));
	if (!note) error(404, 'Note not found');
	return { note };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const [note] = await db.select({ id: notes.id }).from(notes).where(eq(notes.slug, params.slug));
		if (!note) return fail(404, { error: 'Note not found' });

		const data = await request.formData();
		const title = (data.get('title') as string)?.trim();
		const body = (data.get('body') as string) ?? '';
		const tagsRaw = (data.get('tags') as string) ?? '';
		const aliasesRaw = (data.get('aliases') as string) ?? '';
		const category = (data.get('category') as string)?.trim() || null;
		const status = (data.get('status') as 'stub' | 'growing' | 'mature') ?? 'stub';

		if (!title) return fail(400, { error: 'Title is required' });

		const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
		const aliases = aliasesRaw.split(',').map((a) => a.trim()).filter(Boolean);

		await db
			.update(notes)
			.set({ title, body, tags, aliases, category, status, updatedAt: new Date() })
			.where(eq(notes.id, note.id));

		// Re-sync wikilinks: delete old links then re-insert
		await db.delete(noteLinks).where(eq(noteLinks.sourceNoteId, note.id));

		const linkedTitles = extractWikilinks(body);
		if (linkedTitles.length > 0) {
			const allNotes = await db.select({ id: notes.id, title: notes.title }).from(notes);
			const titleToId = new Map(allNotes.map((n) => [n.title, n.id]));

			const linkRows = linkedTitles
				.map((t) => titleToId.get(t))
				.filter((targetId): targetId is string => !!targetId && targetId !== note.id)
				.map((targetId) => ({ sourceNoteId: note.id, targetNoteId: targetId }));

			if (linkRows.length > 0) {
				await db.insert(noteLinks).values(linkRows);
			}
		}

		redirect(303, `/notes/${params.slug}`);
	},

	delete: async ({ params }) => {
		const [note] = await db.select({ id: notes.id }).from(notes).where(eq(notes.slug, params.slug));
		if (!note) return fail(404, { error: 'Note not found' });
		await db.delete(notes).where(eq(notes.id, note.id));
		redirect(303, '/notes');
	}
};
