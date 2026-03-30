import { db } from '$lib/server/db/index.js';
import { notes, noteLinks, noteRevisions } from '$lib/server/db/schema.js';
import { and, eq, like, ne } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import { extractWikilinks } from '$lib/utils/wikilinks.js';
import type { Actions, PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ params }) => {
	const [note] = await db.select().from(notes).where(eq(notes.slug, params.slug));
	if (!note) error(404, 'Note not found');
	const allNotes = await db.select({ title: notes.title }).from(notes);
	return { note, noteTitles: allNotes.map((n) => n.title) };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const [note] = await db.select().from(notes).where(eq(notes.slug, params.slug));
		if (!note) return fail(404, { error: 'Note not found' });

		// Snapshot current state as a revision before applying changes
		await db.insert(noteRevisions).values({
			noteId: note.id,
			title: note.title,
			body: note.body,
			tags: note.tags,
			aliases: note.aliases,
			category: note.category,
			status: note.status
		});

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

		const oldTitle = note.title;

		await db
			.update(notes)
			.set({ title, body, tags, aliases, category, status, updatedAt: new Date() })
			.where(eq(notes.id, note.id));

		// Re-sync wikilinks for the edited note: delete old links then re-insert
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

		// Propagate title rename: update [[oldTitle]] → [[newTitle]] in all other notes
		if (title !== oldTitle) {
			const affected = await db
				.select({ id: notes.id, body: notes.body })
				.from(notes)
				.where(and(like(notes.body, `%[[${oldTitle}]]%`), ne(notes.id, note.id)));

			if (affected.length > 0) {
				const oldWikilink = `[[${oldTitle}]]`;
				const newWikilink = `[[${title}]]`;
				const allNotes = await db.select({ id: notes.id, title: notes.title }).from(notes);
				const titleToId = new Map(allNotes.map((n) => [n.title, n.id]));

				for (const ref of affected) {
					const updatedBody = ref.body.split(oldWikilink).join(newWikilink);

					await db
						.update(notes)
						.set({ body: updatedBody, updatedAt: new Date() })
						.where(eq(notes.id, ref.id));

					// Re-sync this note's outgoing wikilinks
					await db.delete(noteLinks).where(eq(noteLinks.sourceNoteId, ref.id));

					const refLinkedTitles = extractWikilinks(updatedBody);
					if (refLinkedTitles.length > 0) {
						const linkRows = refLinkedTitles
							.map((t) => titleToId.get(t))
							.filter((targetId): targetId is string => !!targetId && targetId !== ref.id)
							.map((targetId) => ({ sourceNoteId: ref.id, targetNoteId: targetId }));

						if (linkRows.length > 0) {
							await db.insert(noteLinks).values(linkRows);
						}
					}
				}
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
