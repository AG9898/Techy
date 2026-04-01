<script lang="ts">
	import type { PageData, ActionData } from './$types.js';
	import { marked } from 'marked';
	import { untrack } from 'svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const note = $derived(data.note);
	let bodyValue = $state(untrack(() => data.note.body));
	let showPreview = $state(false);
	let tagsValue = $state(untrack(() => data.note.tags.join(', ')));
	let deleteDialog: HTMLDialogElement | null = $state(null);

	const tagOptions = $derived.by(() => {
		const parts = tagsValue.split(',');
		const token = parts[parts.length - 1].trimStart();
		const prefix = parts.length > 1 ? parts.slice(0, -1).join(',') + ', ' : '';
		const done = parts.slice(0, -1).map((t) => t.trim()).filter(Boolean);
		return data.existingTags
			.filter((t) => t.toLowerCase().includes(token.toLowerCase()) && !done.includes(t))
			.map((t) => prefix + t);
	});

	const noteTitlesSet = $derived(new Set(data.noteTitles));
	const previewHtml = $derived(renderPreview(bodyValue, noteTitlesSet));

	function renderPreview(body: string, knownTitles: Set<string>): string {
		const preprocessed = body.replace(/\[\[([^\]]+)\]\]/g, (_, title) => {
			const cls = knownTitles.has(title) ? 'wikilink' : 'wikilink-broken';
			return `<span class="${cls}">${title}</span>`;
		});
		return marked.parse(preprocessed) as string;
	}

	// Use a custom dialog so destructive confirmation can follow Techy's theme.
	function openDeleteDialog() {
		deleteDialog?.showModal();
	}

	function closeDeleteDialog() {
		deleteDialog?.close();
	}

	function handleDeleteDialogClick(event: MouseEvent) {
		if (event.target === deleteDialog) {
			closeDeleteDialog();
		}
	}
</script>

<div class="authoring-page" class:preview-open={showPreview}>
	<div class="authoring-header">
		<a href="/notes/{note.slug}" class="back-link">← {note.title}</a>
		<h1>Edit Note</h1>
	</div>

	{#if form?.error}
		<p class="error-banner">{form.error}</p>
	{/if}

	<form method="POST" action="?/update" class="authoring-form">
		<div class="fields-meta">
			<label>
				<span class="field-label">Title <span class="required">*</span></span>
				<input type="text" name="title" required value={note.title} />
			</label>

			<div class="fields-row">
				<label>
					<span class="field-label">Category</span>
					<input type="text" name="category" value={note.category ?? ''} />
				</label>

				<label>
					<span class="field-label">Status</span>
					<select name="status">
						{#each ['stub', 'growing', 'mature'] as s}
							<option value={s} selected={note.status === s}>{s}</option>
						{/each}
					</select>
				</label>
			</div>

			<div class="fields-row">
				<label>
					<span class="field-label">Tags <span class="hint">(comma-separated)</span></span>
					<input
						type="text"
						name="tags"
						list="tags-suggestions"
						bind:value={tagsValue}
					/>
				</label>
				<datalist id="tags-suggestions">
					{#each tagOptions as option}
						<option value={option}></option>
					{/each}
				</datalist>

				<label>
					<span class="field-label">Aliases <span class="hint">(comma-separated)</span></span>
					<input type="text" name="aliases" value={note.aliases.join(', ')} />
				</label>
			</div>
		</div>

		<div class="fields-body">
			<div class="body-header">
				<span class="field-label">Body <span class="hint">(Markdown · [[Note Title]] for wikilinks)</span></span>
				<button type="button" class="btn-preview" onclick={() => (showPreview = !showPreview)}>
					{showPreview ? 'Hide Preview' : 'Preview'}
				</button>
			</div>
			<div class="body-split">
				<textarea name="body" rows="18" bind:value={bodyValue}></textarea>
				{#if showPreview}
					<div class="preview-pane">
						{#if bodyValue.trim()}
							{@html previewHtml}
						{:else}
							<span class="preview-empty">Nothing to preview yet…</span>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<div class="form-actions">
			<a href="/notes/{note.slug}" class="btn-cancel">Cancel</a>
			<button type="submit" class="btn-save">Save Changes</button>
		</div>
	</form>

	<div class="delete-section">
		<button type="button" class="btn-delete" onclick={openDeleteDialog}>Delete Note</button>
	</div>

	<dialog
		bind:this={deleteDialog}
		class="delete-dialog"
		oncancel={() => closeDeleteDialog()}
		onclick={handleDeleteDialogClick}
	>
		<div class="delete-dialog__panel">
			<p class="delete-dialog__eyebrow">Delete note</p>
			<h2 class="delete-dialog__title">Delete “{note.title}”?</h2>
			<p class="delete-dialog__message">
				This permanently removes the note and its graph connections from Techy. This action cannot be undone.
			</p>
			<div class="delete-dialog__actions">
				<form method="dialog">
					<button type="submit" class="delete-dialog__cancel">Cancel</button>
				</form>
				<form method="POST" action="?/delete">
					<button type="submit" class="delete-dialog__confirm">Delete Note</button>
				</form>
			</div>
		</div>
	</dialog>
</div>

<style>
	.authoring-page {
		max-width: 720px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		transition: max-width 200ms ease;
	}

	.authoring-page.preview-open {
		max-width: 1400px;
	}

	.authoring-header {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.back-link {
		font-size: 0.85rem;
		color: var(--text-muted);
		text-decoration: none;
		transition: color 150ms ease;
	}

	.back-link:hover {
		color: var(--text-secondary);
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
		letter-spacing: -0.01em;
	}

	.error-banner {
		padding: 0.75rem 1rem;
		background: color-mix(in srgb, var(--accent-red) 15%, var(--bg-surface));
		color: var(--accent-red);
		border: 1px solid color-mix(in srgb, var(--accent-red) 30%, transparent);
		border-radius: 8px;
		font-size: 0.9rem;
	}

	.authoring-form {
		display: flex;
		flex-direction: column;
		gap: 0;
		background: var(--bg-surface);
		border: 1px solid var(--border-soft);
		border-radius: 12px;
		overflow: hidden;
	}

	.fields-meta {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.5rem;
		border-bottom: 1px solid var(--border-soft);
	}

	.fields-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.fields-body {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1.5rem;
		border-bottom: 1px solid var(--border-soft);
	}

	.body-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.body-split {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.authoring-page.preview-open .body-split {
		flex-direction: row;
		gap: 1rem;
		align-items: flex-start;
	}

	.authoring-page.preview-open .body-split textarea {
		flex: 1;
		min-width: 0;
	}

	.preview-pane {
		flex: 1;
		min-width: 0;
		min-height: 18lh;
		overflow-y: auto;
		background: var(--bg-raised);
		border: 1px solid var(--border-soft);
		border-radius: 8px;
		padding: 0.75rem 1rem;
		font-size: 0.9rem;
		line-height: 1.75;
		color: var(--text-secondary);
	}

	.preview-empty {
		color: var(--text-muted);
		font-size: 0.85rem;
		font-style: italic;
	}

	.preview-pane :global(h1) { font-size: 1.3rem; font-weight: 700; color: var(--text-primary); margin: 0.75rem 0 0.4rem; }
	.preview-pane :global(h2) { font-size: 1.05rem; font-weight: 600; color: var(--text-primary); margin: 0.6rem 0 0.3rem; }
	.preview-pane :global(h3) { font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin: 0.5rem 0 0.25rem; }
	.preview-pane :global(p) { margin: 0.4rem 0; }
	.preview-pane :global(ul),
	.preview-pane :global(ol) { padding-left: 1.25rem; margin: 0.4rem 0; }
	.preview-pane :global(li) { margin: 0.2rem 0; }
	.preview-pane :global(code) {
		background: var(--bg-overlay);
		border-radius: 3px;
		padding: 0.1em 0.3em;
		font-family: var(--font-mono);
		font-size: 0.85em;
	}
	.preview-pane :global(pre) {
		background: var(--bg-overlay);
		border-radius: 6px;
		padding: 0.75rem;
		overflow-x: auto;
		margin: 0.5rem 0;
	}
	.preview-pane :global(pre code) { background: none; padding: 0; }
	.preview-pane :global(blockquote) {
		border-left: 3px solid var(--border-strong);
		padding-left: 0.75rem;
		color: var(--text-muted);
		margin: 0.4rem 0;
	}
	.preview-pane :global(a) { color: var(--accent-primary); text-decoration: underline; }
	.preview-pane :global(hr) { border: none; border-top: 1px solid var(--border-soft); margin: 0.75rem 0; }
	.preview-pane :global(.wikilink) { color: var(--accent-green-muted); }
	.preview-pane :global(.wikilink-broken) { color: var(--accent-red); text-decoration: line-through; }

	label {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.field-label {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text-secondary);
		letter-spacing: 0.01em;
	}

	.required {
		color: var(--accent-red);
	}

	.hint {
		color: var(--text-subtle);
		font-size: 0.75rem;
		font-weight: 400;
	}

	input,
	select,
	textarea {
		background: var(--bg-raised);
		border: 1px solid var(--border-soft);
		color: var(--text-primary);
		border-radius: 8px;
		padding: 0.55rem 0.75rem;
		font-size: 0.9rem;
		font-family: inherit;
		width: 100%;
		transition: border-color 150ms ease, box-shadow 150ms ease;
	}

	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: var(--accent-strong);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-strong) 18%, transparent);
	}

	select {
		cursor: pointer;
	}

	textarea {
		resize: vertical;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		line-height: 1.65;
	}

	.form-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		align-items: center;
		padding: 1rem 1.5rem;
	}

	.btn-cancel {
		padding: 0.5rem 1.1rem;
		color: var(--text-muted);
		text-decoration: none;
		font-size: 0.9rem;
		border-radius: 8px;
		transition: color 150ms ease, background 150ms ease;
	}

	.btn-cancel:hover {
		color: var(--text-secondary);
		background: var(--bg-raised);
	}

	.btn-save {
		padding: 0.5rem 1.25rem;
		background: var(--accent-strong);
		color: #fff;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 500;
		transition: opacity 150ms ease;
	}

	.btn-save:hover {
		opacity: 0.88;
	}

	.btn-preview {
		padding: 0.3rem 0.75rem;
		background: var(--bg-raised);
		color: var(--text-muted);
		border: 1px solid var(--border-soft);
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.75rem;
		font-weight: 500;
		transition: color 150ms ease, border-color 150ms ease, background 150ms ease;
	}

	.btn-preview:hover {
		color: var(--text-secondary);
		border-color: var(--border-strong);
		background: var(--bg-overlay);
	}

	.delete-section {
		border-top: 1px solid var(--border-soft);
		padding-top: 0.75rem;
	}

	.btn-delete {
		background: none;
		border: 1px solid color-mix(in srgb, var(--accent-red) 40%, transparent);
		color: var(--accent-red);
		padding: 0.4rem 0.85rem;
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.85rem;
		transition: background 150ms ease, border-color 150ms ease;
	}

	.btn-delete:hover {
		background: color-mix(in srgb, var(--accent-red) 10%, transparent);
		border-color: var(--accent-red);
	}

	.delete-dialog {
		width: min(32rem, calc(100vw - 2rem));
		padding: 0;
		border: none;
		background: transparent;
	}

	.delete-dialog::backdrop {
		background: color-mix(in srgb, var(--bg-base) 62%, transparent);
		backdrop-filter: blur(8px);
	}

	.delete-dialog__panel {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		padding: 1.4rem 1.4rem 1.2rem;
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--accent-red) 6%, var(--bg-surface)),
				var(--bg-surface)
			);
		border: 1px solid color-mix(in srgb, var(--accent-red) 18%, var(--border-soft));
		border-radius: 18px;
		box-shadow:
			0 24px 60px color-mix(in srgb, var(--bg-base) 38%, transparent),
			inset 0 1px 0 color-mix(in srgb, white 6%, transparent);
	}

	.delete-dialog__eyebrow,
	.delete-dialog__title,
	.delete-dialog__message {
		margin: 0;
	}

	.delete-dialog__eyebrow {
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--accent-red) 76%, var(--text-secondary));
	}

	.delete-dialog__title {
		font-size: 1.35rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--text-primary);
	}

	.delete-dialog__message {
		max-width: 40ch;
		font-size: 0.95rem;
		line-height: 1.65;
		color: var(--text-muted);
	}

	.delete-dialog__actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding-top: 0.4rem;
	}

	.delete-dialog__actions form {
		margin: 0;
	}

	.delete-dialog__cancel,
	.delete-dialog__confirm {
		border: none;
		border-radius: 9999px;
		padding: 0.65rem 1.1rem;
		font-size: 0.88rem;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition:
			background 150ms ease,
			border-color 150ms ease,
			color 150ms ease,
			opacity 150ms ease;
	}

	.delete-dialog__cancel {
		background: var(--bg-raised);
		color: var(--text-secondary);
		border: 1px solid var(--border-soft);
	}

	.delete-dialog__cancel:hover {
		background: var(--bg-overlay);
		border-color: var(--border-strong);
	}

	.delete-dialog__confirm {
		background: color-mix(in srgb, var(--accent-red) 84%, var(--bg-surface));
		color: white;
	}

	.delete-dialog__confirm:hover {
		opacity: 0.9;
	}

	@media (max-width: 640px) {
		.delete-dialog {
			width: calc(100vw - 1.25rem);
		}

		.delete-dialog__panel {
			padding: 1.15rem 1rem 1rem;
			border-radius: 16px;
		}

		.delete-dialog__actions {
			flex-direction: column-reverse;
			align-items: stretch;
		}

		.delete-dialog__actions form {
			width: 100%;
		}

		.delete-dialog__cancel,
		.delete-dialog__confirm {
			width: 100%;
		}
	}
</style>
