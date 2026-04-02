import type { PageServerLoad } from './$types.js';
import { PROVIDERS, DEFAULT_PROVIDER, DEFAULT_MODEL } from '$lib/server/ai/models.js';
import { db } from '$lib/server/db/index.js';
import { notes } from '$lib/server/db/schema.js';
import { asc } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const notesList = await db
		.select({ id: notes.id, title: notes.title, slug: notes.slug, aliases: notes.aliases })
		.from(notes)
		.orderBy(asc(notes.title));

	return {
		providers: PROVIDERS.map((p) => ({
			id: p.id,
			label: p.label,
			models: p.models,
			defaultModel: p.defaultModel
		})),
		defaultProvider: DEFAULT_PROVIDER,
		defaultModel: DEFAULT_MODEL,
		notes: notesList
	};
};
