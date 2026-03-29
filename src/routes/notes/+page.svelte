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
			<button class="btn-import" onclick={() => (showImport = !showImport)}>
				{showImport ? 'Close Import' : '↑ Import'}
			</button>
			<a href="/notes/new" class="btn-new">+ New Note</a>
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
		color: #e2e8f0;
	}
	.header-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.btn-new {
		padding: 0.4rem 1rem;
		background: #1e3a5f;
		color: #7dd3fc;
		border-radius: 6px;
		text-decoration: none;
		font-size: 0.85rem;
	}
	.btn-new:hover {
		background: #1e40af;
	}
	.btn-import {
		padding: 0.4rem 1rem;
		background: #1e293b;
		color: #94a3b8;
		border: 1px solid #334155;
		border-radius: 6px;
		font-size: 0.85rem;
		cursor: pointer;
	}
	.btn-import:hover {
		background: #273449;
		color: #cbd5e1;
	}
	.import-panel {
		background: #0f172a;
		border: 1px solid #1e293b;
		border-radius: 8px;
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
		color: #94a3b8;
		font-size: 0.85rem;
	}
	.import-input {
		color: #cbd5e1;
		font-size: 0.85rem;
		flex: 1;
		min-width: 0;
	}
	.btn-submit {
		padding: 0.35rem 0.9rem;
		background: #1e3a5f;
		color: #7dd3fc;
		border: none;
		border-radius: 6px;
		font-size: 0.85rem;
		cursor: pointer;
		white-space: nowrap;
	}
	.btn-submit:hover {
		background: #1e40af;
	}
	.import-result {
		font-size: 0.85rem;
	}
	.result-success {
		color: #4ade80;
		margin: 0;
	}
	.result-errors {
		margin: 0.25rem 0 0;
		padding-left: 1.25rem;
		color: #fca5a5;
		list-style: disc;
	}
	.result-errors li {
		margin-bottom: 0.2rem;
	}
	.err-file {
		font-family: monospace;
		color: #fbbf24;
	}
	.result-empty {
		color: #64748b;
		margin: 0;
	}
	.import-error {
		color: #fca5a5;
		font-size: 0.85rem;
		margin: 0;
	}
	.category-filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.chip {
		padding: 0.25rem 0.75rem;
		background: #1e293b;
		color: #94a3b8;
		border: 1px solid #334155;
		border-radius: 999px;
		font-size: 0.8rem;
		cursor: pointer;
	}
	.chip.active {
		background: #1e3a5f;
		color: #7dd3fc;
		border-color: #1d4ed8;
	}
	.chip-orphan {
		color: #fbbf24;
		border-color: #92400e;
	}
	.chip-orphan.active {
		background: #451a03;
		color: #fcd34d;
		border-color: #b45309;
	}
	.notes-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
	}
	.empty {
		color: #64748b;
	}
</style>
