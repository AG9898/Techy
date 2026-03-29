import { db } from '$lib/server/db/index.js';
import { notes } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types.js';

export const load: PageServerLoad = async () => {
	const allNotes = await db
		.select({
			id: notes.id,
			title: notes.title,
			slug: notes.slug,
			tags: notes.tags,
			category: notes.category,
			status: notes.status,
			createdAt: notes.createdAt
		})
		.from(notes)
		.orderBy(notes.createdAt);

	return { notes: allNotes };
};

export const actions: Actions = {
	delete: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id');
		if (!id || typeof id !== 'string') {
			return fail(400, { error: 'Invalid note id' });
		}
		await db.delete(notes).where(eq(notes.id, id));
		return { success: true };
	}
};
