import { db } from '$lib/server/db/index.js';
import { notes, noteLinks } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import { slugify } from '$lib/utils/slugify.js';
import { extractWikilinks } from '$lib/utils/wikilinks.js';
import type { Actions, PageServerLoad } from './$types.js';

export const load: PageServerLoad = async () => {
	const allNotes = await db.select({ title: notes.title }).from(notes);
	return { noteTitles: allNotes.map((n) => n.title) };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const data = await request.formData();

		const title = (data.get('title') as string)?.trim();
		const body = (data.get('body') as string) ?? '';
		const tagsRaw = (data.get('tags') as string) ?? '';
		const aliasesRaw = (data.get('aliases') as string) ?? '';
		const category = (data.get('category') as string)?.trim() || null;
		const status = (data.get('status') as 'stub' | 'growing' | 'mature') ?? 'stub';
		const aiGenerated = data.get('ai_generated') === 'true';
		const aiModel = (data.get('ai_model') as string)?.trim() || null;
		const aiPrompt = (data.get('ai_prompt') as string)?.trim() || null;

		if (!title) {
			return fail(400, { error: 'Title is required' });
		}

		const slug = slugify(title);

		// Check for slug collision
		const existing = await db.select({ id: notes.id }).from(notes).where(eq(notes.slug, slug));
		if (existing.length > 0) {
			return fail(400, { error: `A note with the slug "${slug}" already exists` });
		}

		const tags = tagsRaw
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
		const aliases = aliasesRaw
			.split(',')
			.map((a) => a.trim())
			.filter(Boolean);

		const [inserted] = await db
			.insert(notes)
			.values({ title, slug, body, tags, aliases, category, status, aiGenerated, aiModel, aiPrompt })
			.returning({ id: notes.id });

		// Resolve [[wikilinks]] and insert note_links rows
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

		redirect(303, `/notes/${slug}`);
	}
};
