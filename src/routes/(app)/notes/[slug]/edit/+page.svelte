<script lang="ts">
	import type { PageData, ActionData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const note = $derived(data.note);
</script>

<div class="form-page">
	<div class="form-header">
		<a href="/notes/{note.slug}" class="back-link">← {note.title}</a>
		<h1>Edit Note</h1>
	</div>

	{#if form?.error}
		<p class="error">{form.error}</p>
	{/if}

	<form method="POST" action="?/update" class="note-form">
		<label>
			<span>Title <span class="required">*</span></span>
			<input type="text" name="title" required value={note.title} />
		</label>

		<label>
			<span>Category</span>
			<input type="text" name="category" value={note.category ?? ''} />
		</label>

		<label>
			<span>Status</span>
			<select name="status">
				{#each ['stub', 'growing', 'mature'] as s}
					<option value={s} selected={note.status === s}>{s}</option>
				{/each}
			</select>
		</label>

		<label>
			<span>Tags <span class="hint">(comma-separated)</span></span>
			<input type="text" name="tags" value={note.tags.join(', ')} />
		</label>

		<label>
			<span>Aliases <span class="hint">(comma-separated)</span></span>
			<input type="text" name="aliases" value={note.aliases.join(', ')} />
		</label>

		<label class="body-label">
			<span>Body <span class="hint">(Markdown, use [[Note Title]] for links)</span></span>
			<textarea name="body" rows="16">{note.body}</textarea>
		</label>

		<div class="form-actions">
			<a href="/notes/{note.slug}" class="btn-cancel">Cancel</a>
			<button type="submit" class="btn-save">Save Changes</button>
		</div>
	</form>

	<form
		method="POST"
		action="?/delete"
		class="delete-section"
		onsubmit={(e) => { if (!confirm('Delete this note? This cannot be undone.')) e.preventDefault(); }}
	>
		<button type="submit" class="btn-delete">Delete Note</button>
	</form>
</div>

<style>
	.form-page {
		max-width: 720px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.form-header {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.back-link {
		font-size: 0.85rem;
		color: #64748b;
		text-decoration: none;
	}
	h1 {
		font-size: 1.5rem;
		font-weight: 700;
		color: #e2e8f0;
	}
	.error {
		padding: 0.75rem 1rem;
		background: #450a0a;
		color: #f87171;
		border-radius: 6px;
		font-size: 0.9rem;
	}
	.note-form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		font-size: 0.85rem;
		color: #94a3b8;
	}
	.required {
		color: #f87171;
	}
	.hint {
		color: #475569;
		font-size: 0.75rem;
	}
	input,
	select,
	textarea {
		background: #0f172a;
		border: 1px solid #1e293b;
		color: #e2e8f0;
		border-radius: 6px;
		padding: 0.6rem 0.75rem;
		font-size: 0.9rem;
		font-family: inherit;
		width: 100%;
	}
	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: #1d4ed8;
	}
	textarea {
		resize: vertical;
		font-family: 'Fira Code', 'Cascadia Code', monospace;
		font-size: 0.85rem;
		line-height: 1.6;
	}
	.form-actions {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
		align-items: center;
	}
	.btn-cancel {
		padding: 0.5rem 1.25rem;
		color: #64748b;
		text-decoration: none;
		font-size: 0.9rem;
	}
	.btn-save {
		padding: 0.5rem 1.25rem;
		background: #1d4ed8;
		color: #fff;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.9rem;
	}
	.btn-save:hover {
		background: #2563eb;
	}
	.delete-section {
		border-top: 1px solid #1e293b;
		padding-top: 1rem;
	}
	.btn-delete {
		background: none;
		border: 1px solid #7f1d1d;
		color: #f87171;
		padding: 0.4rem 0.85rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.85rem;
	}
	.btn-delete:hover {
		background: #450a0a;
	}
</style>
