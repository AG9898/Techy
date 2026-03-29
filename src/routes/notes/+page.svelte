<script lang="ts">
	import NoteCard from '$lib/components/NoteCard.svelte';
	import type { PageData, ActionData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedCategory = $state<string | null>(null);
	let showOrphans = $state(false);
	let showImport = $state(false);

	// Show import panel automatically when the server returned results after a submission
	const hasImportFeedback = $derived(!!(form?.importResult || form?.importError));

	const categories = $derived([...new Set(data.notes.map((n) => n.category).filter(Boolean))] as string[]);
	const orphanIdSet = $derived(new Set(data.orphanIds));

	const filtered = $derived(
		showOrphans
			? data.notes.filter((n) => orphanIdSet.has(n.id))
			: selectedCategory
				? data.notes.filter((n) => n.category === selectedCategory)
				: data.notes
	);
</script>

<div class="notes-page">
	<div class="page-header">
		<h1>Notes</h1>
		<div class="header-actions">
			<button class="btn-secondary" onclick={() => (showImport = !showImport)}>
				{showImport ? 'Close Import' : '↑ Import'}
			</button>
			<a href="/notes/export" class="btn-secondary">↓ Export</a>
			<a href="/notes/new" class="btn-primary">+ New Note</a>
		</div>
	</div>

	{#if showImport || hasImportFeedback}
		<div class="import-panel">
			<form method="POST" action="?/import" enctype="multipart/form-data" class="import-form">
				<label for="import-files" class="import-label">Select Markdown files to import</label>
				<input
					id="import-files"
					type="file"
					name="files"
					multiple
					accept=".md"
					class="import-input"
				/>
				<button type="submit" class="btn-submit">Import</button>
			</form>

			{#if form?.importResult}
				{@const result = form.importResult}
				<div class="import-result">
					{#if result.imported > 0}
						<p class="result-success">
							✓ {result.imported} note{result.imported === 1 ? '' : 's'} imported successfully.
						</p>
					{/if}
					{#if result.errors.length > 0}
						<ul class="result-errors">
							{#each result.errors as err}
								<li><span class="err-file">{err.file}</span> — {err.message}</li>
							{/each}
						</ul>
					{/if}
					{#if result.imported === 0 && result.errors.length === 0}
						<p class="result-empty">No files were processed.</p>
					{/if}
				</div>
			{/if}

			{#if form?.importError}
				<p class="import-error">{form.importError}</p>
			{/if}
		</div>
	{/if}

	<div class="category-filters">
		<button
			class="chip"
			class:active={!showOrphans && selectedCategory === null}
			onclick={() => { showOrphans = false; selectedCategory = null; }}
		>
			All
		</button>
		{#each categories as cat}
			<button
				class="chip"
				class:active={!showOrphans && selectedCategory === cat}
				onclick={() => { showOrphans = false; selectedCategory = cat; }}
			>
				{cat}
			</button>
		{/each}
		{#if data.orphanIds.length > 0}
			<button
				class="chip chip-orphan"
				class:active={showOrphans}
				onclick={() => { showOrphans = !showOrphans; selectedCategory = null; }}
			>
				Orphans ({data.orphanIds.length})
			</button>
		{/if}
	</div>

	{#if filtered.length === 0}
		<p class="empty">No notes yet. <a href="/notes/new">Create one →</a></p>
	{:else}
		<div class="notes-grid">
			{#each filtered as note}
				<NoteCard
					title={note.title}
					slug={note.slug}
					tags={note.tags}
					category={note.category}
					status={note.status}
					createdAt={note.createdAt}
				/>
			{/each}
		</div>
	{/if}
</div>

<style>
	.notes-page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	h1 {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
	}
	.header-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.btn-secondary {
		padding: 0.35rem 0.9rem;
		background: var(--bg-surface);
		color: var(--text-muted);
		border: 1px solid var(--border-soft);
		border-radius: 6px;
		text-decoration: none;
		font-size: 0.82rem;
		cursor: pointer;
		font-family: inherit;
		transition: color 0.15s, border-color 0.15s;
	}
	.btn-secondary:hover {
		color: var(--text-secondary);
		border-color: var(--border-strong);
	}
	.btn-primary {
		padding: 0.35rem 0.9rem;
		background: var(--bg-raised);
		color: var(--accent-primary);
		border: 1px solid var(--border-soft);
		border-radius: 6px;
		text-decoration: none;
		font-size: 0.82rem;
		font-weight: 500;
		transition: border-color 0.15s;
	}
	.btn-primary:hover {
		border-color: var(--border-strong);
	}
	.import-panel {
		background: var(--bg-surface);
		border: 1px solid var(--border-soft);
		border-radius: 10px;
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.import-form {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.import-label {
		color: var(--text-secondary);
		font-size: 0.85rem;
	}
	.import-input {
		color: var(--text-secondary);
		font-size: 0.85rem;
		flex: 1;
		min-width: 0;
	}
	.btn-submit {
		padding: 0.35rem 0.9rem;
		background: var(--bg-raised);
		color: var(--accent-primary);
		border: none;
		border-radius: 6px;
		font-size: 0.85rem;
		cursor: pointer;
		white-space: nowrap;
		font-family: inherit;
	}
	.btn-submit:hover {
		opacity: 0.85;
	}
	.import-result {
		font-size: 0.85rem;
	}
	.result-success {
		color: var(--accent-green);
		margin: 0;
	}
	.result-errors {
		margin: 0.25rem 0 0;
		padding-left: 1.25rem;
		color: var(--accent-red);
		list-style: disc;
	}
	.result-errors li {
		margin-bottom: 0.2rem;
	}
	.err-file {
		font-family: monospace;
		color: var(--accent-primary);
	}
	.result-empty {
		color: var(--text-muted);
		margin: 0;
	}
	.import-error {
		color: var(--accent-red);
		font-size: 0.85rem;
		margin: 0;
	}
	.category-filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.chip {
		padding: 0.25rem 0.7rem;
		background: var(--bg-surface);
		color: var(--text-muted);
		border: 1px solid var(--border-soft);
		border-radius: 999px;
		font-size: 0.78rem;
		cursor: pointer;
		font-family: inherit;
		transition: color 0.15s, border-color 0.15s, background 0.15s;
	}
	.chip:hover {
		color: var(--text-secondary);
		border-color: var(--border-strong);
	}
	.chip.active {
		background: color-mix(in srgb, var(--accent-primary) 12%, var(--bg-surface));
		color: var(--accent-primary);
		border-color: var(--border-strong);
	}
	.chip-orphan {
		color: var(--text-secondary);
		border-color: var(--border-strong);
	}
	.chip-orphan.active {
		background: color-mix(in srgb, var(--accent-strong) 15%, var(--bg-surface));
		color: var(--accent-strong);
		border-color: var(--border-strong);
	}
	.notes-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 0.75rem;
	}
	.empty {
		color: var(--text-muted);
	}
	.empty a {
		color: var(--accent-primary);
	}
</style>
