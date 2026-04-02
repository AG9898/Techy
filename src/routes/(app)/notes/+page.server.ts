import { db } from '$lib/server/db/index.js';
import { notes, noteLinks } from '$lib/server/db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { validateNoteCategory } from '$lib/utils/note-taxonomy.js';
import { slugify } from '$lib/utils/slugify.js';
import { extractWikilinks } from '$lib/utils/wikilinks.js';
import { parseFrontmatter } from '$lib/utils/frontmatter.js';
import type { Actions, PageServerLoad } from './$types.js';

export const load: PageServerLoad = async () => {
	const [allNotes, allLinks] = await Promise.all([
		db
			.select({
				id: notes.id,
				title: notes.title,
				slug: notes.slug,
				tags: notes.tags,
				category: notes.category,
				status: notes.status,
				createdAt: notes.createdAt,
				updatedAt: notes.updatedAt,
				body: notes.body
			})
			.from(notes)
			.orderBy(notes.createdAt),
		db.select({ source: noteLinks.sourceNoteId, target: noteLinks.targetNoteId }).from(noteLinks)
	]);

	const linkedIds = new Set<string>();
	for (const link of allLinks) {
		linkedIds.add(link.source);
		linkedIds.add(link.target);
	}

	const orphanIds = allNotes.filter((n) => !linkedIds.has(n.id)).map((n) => n.id);

	return { notes: allNotes, orphanIds };
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
	},

	import: async ({ request }) => {
		const data = await request.formData();
		const files = data.getAll('files');

		if (!files.length) {
			return fail(400, { importError: 'No files selected' });
		}

		type ValidNote = {
			fileName: string;
			title: string;
			slug: string;
			body: string;
			tags: string[];
			aliases: string[];
			category: string | null;
			status: 'stub' | 'growing' | 'mature';
		};

		const errors: Array<{ file: string; message: string }> = [];
		const validNotes: ValidNote[] = [];

		// Parse phase — validate all files before touching the DB
		for (const file of files) {
			if (!(file instanceof File)) continue;
			if (!file.name.endsWith('.md')) {
				errors.push({ file: file.name, message: 'Not a Markdown file (.md required)' });
				continue;
			}

			const content = await file.text();
			const parsed = parseFrontmatter(content);

			if (!parsed) {
				errors.push({
					file: file.name,
					message: 'Missing frontmatter — expected --- block at the top of the file'
				});
				continue;
			}

			if (!parsed.title) {
				errors.push({
					file: file.name,
					message: 'Missing title — add title: in frontmatter or a # Heading in the body'
				});
				continue;
			}

			const VALID_STATUSES = ['stub', 'growing', 'mature'] as const;
			const status = (VALID_STATUSES as readonly string[]).includes(parsed.status ?? '')
				? (parsed.status as 'stub' | 'growing' | 'mature')
				: 'stub';
			const categoryValidation = validateNoteCategory(parsed.category ?? null);

			if (categoryValidation.error) {
				errors.push({
					file: file.name,
					message: categoryValidation.error
				});
				continue;
			}

			validNotes.push({
				fileName: file.name,
				title: parsed.title,
				slug: slugify(parsed.title),
				body: parsed.body,
				tags: parsed.tags,
				aliases: parsed.aliases,
				category: categoryValidation.category,
				status
			});
		}

		// Insert/update phase
		let imported = 0;
		const upsertedIds: string[] = [];

		for (const note of validNotes) {
			try {
				const existingByTitle = await db
					.select({ id: notes.id })
					.from(notes)
					.where(eq(notes.title, note.title));

				if (existingByTitle.length > 0) {
					const id = existingByTitle[0].id;
					await db
						.update(notes)
						.set({
							body: note.body,
							tags: note.tags,
							aliases: note.aliases,
							category: note.category,
							status: note.status,
							updatedAt: new Date()
						})
						.where(eq(notes.id, id));
					upsertedIds.push(id);
					imported++;
				} else {
					// Guard against slug collision with a different-titled note
					const existingBySlug = await db
						.select({ id: notes.id })
						.from(notes)
						.where(eq(notes.slug, note.slug));

					if (existingBySlug.length > 0) {
						errors.push({
							file: note.fileName,
							message: `Slug conflict: "${note.slug}" is already taken by another note`
						});
						continue;
					}

					const [inserted] = await db
						.insert(notes)
						.values({
							title: note.title,
							slug: note.slug,
							body: note.body,
							tags: note.tags,
							aliases: note.aliases,
							category: note.category,
							status: note.status
						})
						.returning({ id: notes.id });

					upsertedIds.push(inserted.id);
					imported++;
				}
			} catch {
				errors.push({ file: note.fileName, message: 'Database error during import' });
			}
		}

		// Wikilink sync phase — runs after all notes are upserted so cross-file links resolve
		if (upsertedIds.length > 0) {
			const allNotes = await db.select({ id: notes.id, title: notes.title }).from(notes);
			const titleToId = new Map(allNotes.map((n) => [n.title, n.id]));

			const importedRows = await db
				.select({ id: notes.id, body: notes.body })
				.from(notes)
				.where(inArray(notes.id, upsertedIds));

			for (const row of importedRows) {
				await db.delete(noteLinks).where(eq(noteLinks.sourceNoteId, row.id));

				const linkedTitles = extractWikilinks(row.body);
				if (linkedTitles.length === 0) continue;

				const linkRows = linkedTitles
					.map((t) => titleToId.get(t))
					.filter((targetId): targetId is string => !!targetId && targetId !== row.id)
					.map((targetId) => ({ sourceNoteId: row.id, targetNoteId: targetId }));

				if (linkRows.length > 0) {
					await db.insert(noteLinks).values(linkRows);
				}
			}
		}

		return { importResult: { imported, errors } };
	}
};
