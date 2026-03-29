import { db } from '$lib/server/db/index.js';
import { notes } from '$lib/server/db/schema.js';
import { zipSync, strToU8 } from 'fflate';
import type { RequestHandler } from './$types.js';

function serializeNote(note: {
	title: string;
	slug: string;
	body: string;
	tags: string[];
	aliases: string[];
	category: string | null;
	status: string;
}): string {
	const tags = `[${note.tags.join(', ')}]`;
	const aliases = `[${note.aliases.join(', ')}]`;
	const category = note.category ?? '';
	const lines = [
		'---',
		`title: ${note.title}`,
		`tags: ${tags}`,
		`aliases: ${aliases}`,
		`category: ${category}`,
		`status: ${note.status}`,
		'---',
		'',
		note.body
	];
	return lines.join('\n');
}

export const GET: RequestHandler = async () => {
	const allNotes = await db
		.select({
			title: notes.title,
			slug: notes.slug,
			body: notes.body,
			tags: notes.tags,
			aliases: notes.aliases,
			category: notes.category,
			status: notes.status
		})
		.from(notes)
		.orderBy(notes.title);

	const files: Record<string, Uint8Array> = {};
	for (const note of allNotes) {
		files[`${note.slug}.md`] = strToU8(serializeNote(note));
	}

	const zipped = zipSync(files);
	const date = new Date().toISOString().slice(0, 10);

	return new Response(zipped.buffer as ArrayBuffer, {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="techy-notes-${date}.zip"`
		}
	});
};
