import { db } from '$lib/server/db/index.js';
import { notes, noteLinks, noteRevisions } from '$lib/server/db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { slugify } from '$lib/utils/slugify.js';
import { validateNoteCategory } from '$lib/utils/note-taxonomy.js';
import { validateStandardNoteBody } from '$lib/utils/note-structure.js';
import { extractWikilinks } from '$lib/utils/wikilinks.js';

// ── Domain types ──────────────────────────────────────────────────────────────

export interface NoteDraft {
	title: string;
	body: string;
	tags: string[];
	aliases: string[];
	category: string | null;
	status: 'stub' | 'growing' | 'mature';
	aiGenerated?: boolean;
	aiModel?: string | null;
	aiPrompt?: string | null;
}

export interface LinkedNotePatch {
	noteId: string;
	updatedBody: string;
}

export interface CommitCreateResult {
	type: 'create_note';
	note: { id: string; slug: string; title: string };
}

export interface CommitUpdateResult {
	type: 'update_note';
	note: { id: string; slug: string; title: string };
}

export interface CommitDeleteResult {
	type: 'delete_note';
	noteId: string;
}

export type CommitResult = CommitCreateResult | CommitUpdateResult | CommitDeleteResult;

// ── Error type ────────────────────────────────────────────────────────────────

export class CommitError extends Error {
	constructor(
		message: string,
		public readonly code: 'CONFLICT' | 'NOT_FOUND' | 'VALIDATION'
	) {
		super(message);
		this.name = 'CommitError';
	}
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function validateAssistantNoteBody(body: string): string {
	const result = validateStandardNoteBody(body);
	if (!result.ok) {
		throw new CommitError(result.error, 'VALIDATION');
	}

	return result.normalizedBody;
}

function normalizeLinkedNotePatch(patch: LinkedNotePatch): LinkedNotePatch {
	return {
		...patch,
		updatedBody: validateAssistantNoteBody(patch.updatedBody)
	};
}

/** Delete all outgoing note_links for `noteId` and re-insert from `body`. */
async function syncWikilinks(noteId: string, body: string): Promise<void> {
	await db.delete(noteLinks).where(eq(noteLinks.sourceNoteId, noteId));

	const linkedTitles = extractWikilinks(body);
	if (linkedTitles.length === 0) return;

	const allNotes = await db.select({ id: notes.id, title: notes.title }).from(notes);
	const titleToId = new Map(allNotes.map((n) => [n.title, n.id]));

	const linkRows = linkedTitles
		.map((t) => titleToId.get(t))
		.filter((targetId): targetId is string => !!targetId && targetId !== noteId)
		.map((targetId) => ({ sourceNoteId: noteId, targetNoteId: targetId }));

	if (linkRows.length > 0) {
		await db.insert(noteLinks).values(linkRows);
	}
}

// ── Commit operations ─────────────────────────────────────────────────────────

/**
 * Insert a new note from a confirmed assistant proposal.
 * Throws CommitError('CONFLICT') if the derived slug already exists.
 */
export async function commitCreate(
	draft: NoteDraft,
	linkedNotePatches: LinkedNotePatch[] = []
): Promise<CommitCreateResult> {
	const categoryValidation = validateNoteCategory(draft.category);
	if (categoryValidation.error) {
		throw new CommitError(categoryValidation.error, 'VALIDATION');
	}
	const body = validateAssistantNoteBody(draft.body);
	const normalizedPatches = linkedNotePatches.map(normalizeLinkedNotePatch);

	const slug = slugify(draft.title);

	const existing = await db.select({ id: notes.id }).from(notes).where(eq(notes.slug, slug));
	if (existing.length > 0) {
		throw new CommitError(`A note with slug "${slug}" already exists`, 'CONFLICT');
	}

	// Pre-validate all patch targets exist before any writes
	if (normalizedPatches.length > 0) {
		const patchIds = normalizedPatches.map((p) => p.noteId);
		const found = await db.select({ id: notes.id }).from(notes).where(inArray(notes.id, patchIds));
		const foundIds = new Set(found.map((n) => n.id));
		const missing = patchIds.filter((id) => !foundIds.has(id));
		if (missing.length > 0) {
			throw new CommitError(
				`Linked-note patch target${missing.length > 1 ? 's' : ''} not found: ${missing.join(', ')}`,
				'NOT_FOUND'
			);
		}
	}

	const [inserted] = await db
		.insert(notes)
		.values({
			title: draft.title,
			slug,
			body,
			tags: draft.tags,
			aliases: draft.aliases,
			category: categoryValidation.category,
			status: draft.status,
			aiGenerated: draft.aiGenerated ?? false,
			aiModel: draft.aiModel ?? null,
			aiPrompt: draft.aiPrompt ?? null
		})
		.returning({ id: notes.id });

	await syncWikilinks(inserted.id, body);

	// Apply linked-note patches: update each referenced note body and re-sync its links
	for (const patch of normalizedPatches) {
		await db
			.update(notes)
			.set({ body: patch.updatedBody, updatedAt: new Date() })
			.where(eq(notes.id, patch.noteId));
		await syncWikilinks(patch.noteId, patch.updatedBody);
	}

	return { type: 'create_note', note: { id: inserted.id, slug, title: draft.title } };
}

/**
 * Update an existing note from a confirmed assistant proposal.
 * Snapshots the current state before applying changes.
 * Throws CommitError('NOT_FOUND') if the note no longer exists.
 */
export async function commitUpdate(noteId: string, draft: NoteDraft): Promise<CommitUpdateResult> {
	const [note] = await db.select().from(notes).where(eq(notes.id, noteId));
	if (!note) {
		throw new CommitError(`Note with id "${noteId}" not found`, 'NOT_FOUND');
	}

	const categoryValidation = validateNoteCategory(draft.category);
	if (categoryValidation.error) {
		throw new CommitError(categoryValidation.error, 'VALIDATION');
	}
	const body = validateAssistantNoteBody(draft.body);

	// Snapshot current state before applying changes
	await db.insert(noteRevisions).values({
		noteId: note.id,
		title: note.title,
		body: note.body,
		tags: note.tags,
		aliases: note.aliases,
		category: note.category,
		status: note.status
	});

	await db
		.update(notes)
		.set({
			title: draft.title,
			body,
			tags: draft.tags,
			aliases: draft.aliases,
			category: categoryValidation.category,
			status: draft.status,
			aiGenerated: draft.aiGenerated ?? note.aiGenerated,
			aiModel: draft.aiModel ?? note.aiModel,
			aiPrompt: draft.aiPrompt ?? note.aiPrompt,
			updatedAt: new Date()
		})
		.where(eq(notes.id, note.id));

	await syncWikilinks(note.id, body);

	// Slug is stable — not changed when title changes
	return { type: 'update_note', note: { id: note.id, slug: note.slug, title: draft.title } };
}

/**
 * Delete a note after explicit user confirmation.
 * Throws CommitError('NOT_FOUND') if the note no longer exists.
 */
export async function commitDelete(noteId: string): Promise<CommitDeleteResult> {
	const [note] = await db.select({ id: notes.id }).from(notes).where(eq(notes.id, noteId));
	if (!note) {
		throw new CommitError(`Note with id "${noteId}" not found`, 'NOT_FOUND');
	}

	await db.delete(notes).where(eq(notes.id, note.id));

	return { type: 'delete_note', noteId };
}
