import { db } from '$lib/server/db/index.js';
import { notes } from '$lib/server/db/schema.js';
import { ilike, arrayOverlaps, or, and } from 'drizzle-orm';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const tagsParam = url.searchParams.get('tags')?.trim() ?? '';
	const category = url.searchParams.get('category')?.trim() ?? '';

	const searchTags = tagsParam
		.split(',')
		.map((t) => t.trim())
		.filter(Boolean);

	if (!q && searchTags.length === 0 && !category) {
		return { results: [], q, tagsParam, category };
	}

	// Build filter conditions
	const conditions = [];

	if (q) {
		conditions.push(
			or(ilike(notes.title, `%${q}%`), ilike(notes.category, `%${q}%`)) as ReturnType<typeof ilike>
		);
	}

	if (searchTags.length > 0) {
		conditions.push(arrayOverlaps(notes.tags, searchTags));
	}

	if (category) {
		conditions.push(ilike(notes.category, `%${category}%`));
	}

	const results = await db
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
		.where(conditions.length === 1 ? conditions[0] : and(...conditions))
		.orderBy(notes.title);

	return { results, q, tagsParam, category };
};
