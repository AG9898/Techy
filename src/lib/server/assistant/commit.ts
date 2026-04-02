import { db } from '$lib/server/db/index.js';
import { notes, noteLinks, noteRevisions } from '$lib/server/db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { slugify } from '$lib/utils/slugify.js';
import { validateNoteCategory } from '$lib/utils/note-taxonomy.js';
import { extractWikilinks } from '$lib/utils/wikilinks.js';

const REQUIRED_NOTE_SECTIONS = ['Overview', 'Description', 'Key Concepts', 'Connections', 'Resources'] as const;
const OPTIONAL_NOTE_SECTIONS = ['Use Cases', 'Tradeoffs', 'Ecosystem', 'Version Notes', 'Example'] as const;
const DEPRECATED_NOTE_HEADINGS = ['Current Status', 'Notable Features', 'Quick Examples', 'Industry Usage'] as const;

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

function normalizeHeadingText(text: string): string {
	return text.trim().replace(/\s+/g, ' ');
}

function canonicalSectionHeading(text: string): string | null {
	const normalized = normalizeHeadingText(text).toLowerCase();
	const section = [...REQUIRED_NOTE_SECTIONS, ...OPTIONAL_NOTE_SECTIONS].find(
		(candidate) => candidate.toLowerCase() === normalized
	);
	return section ?? null;
}

function isDeprecatedHeading(text: string): boolean {
	const normalized = normalizeHeadingText(text).toLowerCase();
	return DEPRECATED_NOTE_HEADINGS.some((candidate) => candidate.toLowerCase() === normalized);
}

function validateAssistantNoteBody(body: string): string {
	const lines = body.split(/\r?\n/);
	const topLevelSections: string[] = [];
	const normalizedLines = [...lines];

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		const headingMatch = line.match(/^(\s*)(#{1,6})\s+(.+?)\s*#*\s*$/);
		if (!headingMatch) continue;

		const [, leadingWhitespace, hashes, rawHeading] = headingMatch;
		const headingLevel = hashes.length;
		const headingText = normalizeHeadingText(rawHeading);

		if (isDeprecatedHeading(headingText)) {
			throw new CommitError(`Assistant note bodies cannot use deprecated heading "${headingText}"`, 'VALIDATION');
		}

		const canonicalHeading = canonicalSectionHeading(headingText);
		if (headingLevel === 2) {
			if (!canonicalHeading) {
				throw new CommitError(
					`Assistant note bodies must use only the approved section headings. Unsupported heading "${headingText}" is not allowed.`,
					'VALIDATION'
				);
			}

			topLevelSections.push(canonicalHeading);
			normalizedLines[index] = `${leadingWhitespace}${hashes} ${canonicalHeading}`;
			continue;
		}

		if (canonicalHeading) {
			throw new CommitError(
				`Assistant note bodies must use "${canonicalHeading}" as an h2 section heading.`,
				'VALIDATION'
			);
		}
	}

	if (topLevelSections.length < REQUIRED_NOTE_SECTIONS.length) {
		throw new CommitError(
			'Assistant note bodies must include Overview, Description, Key Concepts, Connections, and Resources in order.',
			'VALIDATION'
		);
	}

	let cursor = 0;
	for (const section of REQUIRED_NOTE_SECTIONS.slice(0, 3)) {
		if (topLevelSections[cursor] !== section) {
			throw new CommitError(
				'Assistant note bodies must start with Overview, Description, and Key Concepts in that order.',
				'VALIDATION'
			);
		}
		cursor += 1;
	}

	for (const section of OPTIONAL_NOTE_SECTIONS) {
		if (topLevelSections[cursor] === section) {
			cursor += 1;
		}
	}

	if (topLevelSections[cursor] !== 'Connections') {
		throw new CommitError(
			'Assistant note bodies must place only approved optional sections between Key Concepts and Connections.',
			'VALIDATION'
		);
	}
	cursor += 1;

	if (topLevelSections[cursor] !== 'Resources' || cursor !== topLevelSections.length - 1) {
		throw new CommitError(
			'Assistant note bodies must end with Resources after Connections.',
			'VALIDATION'
		);
	}

	return normalizedLines.join('\n');
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
