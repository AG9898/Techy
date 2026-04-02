import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import {
	commitCreate,
	commitUpdate,
	commitDelete,
	CommitError
} from '$lib/server/assistant/commit.js';
import type { NoteDraft, LinkedNotePatch } from '$lib/server/assistant/commit.js';

/**
 * POST /api/assistant/commit
 *
 * Persist a confirmed assistant proposal (create_note, update_note, or delete_note).
 * No note mutation happens anywhere in the app until this endpoint is called.
 *
 * Errors:
 *   400 — invalid proposal shape or missing required fields
 *   404 — target note not found (update/delete)
 *   409 — title/slug conflict (create)
 *   500 — DB or sync failure
 */
export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return json({ error: 'Request body must be a JSON object' }, { status: 400 });
	}

	const { proposal } = body as Record<string, unknown>;

	if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
		return json({ error: 'proposal is required and must be an object' }, { status: 400 });
	}

	const p = proposal as Record<string, unknown>;
	const type = p.type;

	if (type !== 'create_note' && type !== 'update_note' && type !== 'delete_note') {
		return json(
			{ error: 'proposal.type must be "create_note", "update_note", or "delete_note"' },
			{ status: 400 }
		);
	}

	try {
		if (type === 'create_note') {
			const draft = parseDraft(p.draft);
			if (!draft) {
				return json(
					{ error: 'proposal.draft is required for create_note and must be a valid note draft' },
					{ status: 400 }
				);
			}
			const patches = parseLinkedNotePatches(p.linkedNotePatches);
			const result = await commitCreate(draft, patches);
			return json({ result }, { status: 201 });
		}

		if (type === 'update_note') {
			if (typeof p.noteId !== 'string' || !p.noteId) {
				return json({ error: 'proposal.noteId is required for update_note' }, { status: 400 });
			}
			const draft = parseDraft(p.draft);
			if (!draft) {
				return json(
					{ error: 'proposal.draft is required for update_note and must be a valid note draft' },
					{ status: 400 }
				);
			}
			const result = await commitUpdate(p.noteId, draft);
			return json({ result });
		}

		// delete_note
		if (typeof p.noteId !== 'string' || !p.noteId) {
			return json({ error: 'proposal.noteId is required for delete_note' }, { status: 400 });
		}
		const result = await commitDelete(p.noteId);
		return json({ result });
	} catch (err) {
		if (err instanceof CommitError) {
			const status =
				err.code === 'VALIDATION' ? 400 : err.code === 'CONFLICT' ? 409 : 404;
			return json({ error: err.message }, { status });
		}
		console.error('[/api/assistant/commit]', err);
		return json({ error: 'DB or sync failure' }, { status: 500 });
	}
};

// ── Validation helpers ────────────────────────────────────────────────────────

function parseDraft(raw: unknown): NoteDraft | null {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const d = raw as Record<string, unknown>;

	if (typeof d.title !== 'string' || !d.title.trim()) return null;
	if (typeof d.body !== 'string') return null;
	if (!Array.isArray(d.tags) || !d.tags.every((t) => typeof t === 'string')) return null;
	if (!Array.isArray(d.aliases) || !d.aliases.every((a) => typeof a === 'string')) return null;

	const status = d.status;
	if (status !== 'stub' && status !== 'growing' && status !== 'mature') return null;

	return {
		title: (d.title as string).trim(),
		body: d.body as string,
		tags: d.tags as string[],
		aliases: d.aliases as string[],
		category: typeof d.category === 'string' ? d.category : null,
		status: status as 'stub' | 'growing' | 'mature',
		aiGenerated: typeof d.aiGenerated === 'boolean' ? d.aiGenerated : false,
		aiModel: typeof d.aiModel === 'string' ? d.aiModel : null,
		aiPrompt: typeof d.aiPrompt === 'string' ? d.aiPrompt : null
	};
}

function parseLinkedNotePatches(raw: unknown): LinkedNotePatch[] {
	if (!Array.isArray(raw)) return [];
	return raw.filter(
		(item): item is LinkedNotePatch =>
			typeof item === 'object' &&
			item !== null &&
			typeof (item as Record<string, unknown>).noteId === 'string' &&
			typeof (item as Record<string, unknown>).updatedBody === 'string'
	);
}
