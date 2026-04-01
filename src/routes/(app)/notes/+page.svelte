<script lang="ts">
	import NoteCard from '$lib/components/NoteCard.svelte';
	import type { PageData, ActionData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedCategory = $state<string | null>(null);
	let showOrphans = $state(false);
	let showImport = $state(false);
	let searchQuery = $state('');

	const hasImportFeedback = $derived(!!(form?.importResult || form?.importError));
	const categories = $derived(
		[...new Set(data.notes.map((n) => n.category).filter(Boolean))] as string[]
	);
	const orphanIdSet = $derived(new Set(data.orphanIds));

	const filtered = $derived(
		data.notes.filter((n) => {
			if (showOrphans) return orphanIdSet.has(n.id);
			if (selectedCategory && n.category !== selectedCategory) return false;
			if (searchQuery) {
				const q = searchQuery.toLowerCase();
				return (
					n.title.toLowerCase().includes(q) ||
					(n.category?.toLowerCase().includes(q) ?? false) ||
					n.tags.some((t) => t.toLowerCase().includes(q))
				);
			}
			return true;
		})
	);

	const featuredNotes = $derived(filtered.slice(0, 2));
	const regularNotes = $derived(filtered.slice(2));

	function textExcerpt(body: string, max = 160): string {
		return body
			.replace(/#{1,6}\s+/g, '')
			.replace(/[*_`![\]()]/g, '')
			.replace(/\[\[([^\]]+)\]\]/g, '$1')
			.replace(/\n+/g, ' ')
			.trim()
			.slice(0, max);
	}

	function relativeDate(date: Date | null | undefined): string {
		if (!date) return '';
		const now = new Date();
		const d = new Date(date);
		const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
		if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`;
		if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
		if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
		return d.toLocaleDateString();
	}
</script>

<div class="repo-page">
	<!-- Page header -->
	<div class="repo-header">
		<div class="title-block">
			<h1 class="repo-title">Repository</h1>
			<p class="repo-subtitle">Browse, search, and manage your technical knowledge graph.</p>
		</div>
		<div class="header-actions">
			<button
				class="action-btn"
				class:active={showImport}
				onclick={() => (showImport = !showImport)}
			>
				↑ Import
			</button>
			<a href="/notes/export" class="action-btn">↓ Export</a>
		</div>
	</div>

	<!-- Search bar -->
	<div class="search-zone">
		<label class="search-wrap" for="notes-search">
			<svg class="search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
				<circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="1.5" />
				<path d="M13.5 13.5 L17 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
			</svg>
			<input
				id="notes-search"
				type="search"
				class="search-input"
				placeholder="Search by title, tag, or category…"
				bind:value={searchQuery}
			/>
			{#if searchQuery}
				<button class="search-clear" onclick={() => (searchQuery = '')} aria-label="Clear search">
					×
				</button>
			{/if}
		</label>
	</div>

	<!-- Import panel -->
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
							✓ {result.imported} note{result.imported === 1 ? '' : 's'} imported.
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

	<!-- Category filters -->
	<div class="filter-zone">
		<button
			class="chip"
			class:active={!showOrphans && selectedCategory === null}
			onclick={() => {
				showOrphans = false;
				selectedCategory = null;
			}}
		>
			All Collections
		</button>
		{#each categories as cat}
			<button
				class="chip"
				class:active={!showOrphans && selectedCategory === cat}
				onclick={() => {
					showOrphans = false;
					selectedCategory = cat;
				}}
			>
				{cat}
			</button>
		{/each}
		{#if data.orphanIds.length > 0}
			<button
				class="chip chip-orphan"
				class:active={showOrphans}
				onclick={() => {
					showOrphans = !showOrphans;
					selectedCategory = null;
				}}
			>
				Orphans ({data.orphanIds.length})
			</button>
		{/if}
	</div>

	<!-- Notes content -->
	{#if filtered.length === 0}
		<div class="empty-state">
			{#if searchQuery}
				<p class="empty-text">No notes matching <em>"{searchQuery}"</em>.</p>
			{:else}
				<p class="empty-text">No notes yet. Start a conversation in <a href="/chat">Chat →</a></p>
			{/if}
		</div>
	{:else}
		<!-- Featured notes: first 2 get large card treatment -->
		{#if featuredNotes.length > 0}
			<div class="featured-grid" class:single={featuredNotes.length === 1}>
				{#each featuredNotes as note}
					<a href="/notes/{note.slug}" class="featured-card">
						<div class="featured-top">
							<div class="featured-badges">
								{#if note.category}
									<span class="featured-category">{note.category}</span>
								{/if}
								{#each note.tags.slice(0, 2) as tag}
									<span class="featured-tag">{tag}</span>
								{/each}
							</div>
							<span class="featured-age">{relativeDate(note.updatedAt ?? note.createdAt)}</span>
						</div>
						<h2 class="featured-title">{note.title}</h2>
						{#if note.body}
							{@const ex = textExcerpt(note.body)}
							{#if ex}
								<p class="featured-excerpt">{ex}</p>
							{/if}
						{/if}
						<div class="featured-footer">
							<span class="featured-status" data-status={note.status}>{note.status}</span>
						</div>
					</a>
				{/each}
			</div>
		{/if}

		<!-- Regular notes: compact list rows -->
		{#if regularNotes.length > 0}
			<div class="notes-list">
				{#each regularNotes as note}
					<NoteCard
						title={note.title}
						slug={note.slug}
						tags={note.tags}
						category={note.category}
						status={note.status}
						createdAt={note.createdAt}
						compact={true}
					/>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.repo-page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	/* Header */
	.repo-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}
	.title-block {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.repo-title {
		font-size: 1.9rem;
		font-weight: 700;
		color: var(--text-primary);
		line-height: 1.1;
		letter-spacing: -0.02em;
	}
	.repo-subtitle {
		font-size: 0.82rem;
		color: var(--text-muted);
		margin: 0;
	}
	.header-actions {
		display: flex;
		gap: 0.4rem;
		align-items: center;
		flex-shrink: 0;
		padding-top: 0.25rem;
	}
	.action-btn {
		padding: 0.3rem 0.75rem;
		background: transparent;
		color: var(--text-muted);
		border: 1px solid var(--border-soft);
		border-radius: 6px;
		text-decoration: none;
		font-size: 0.78rem;
		cursor: pointer;
		font-family: inherit;
		transition: color 0.15s, border-color 0.15s;
	}
	.action-btn:hover,
	.action-btn.active {
		color: var(--text-secondary);
		border-color: var(--border-strong);
	}

	/* Search */
	.search-zone {
		width: 100%;
	}
	.search-wrap {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem 0.9rem;
		background: var(--bg-surface);
		border: 1px solid var(--border-soft);
		border-radius: 10px;
		cursor: text;
		transition: border-color 0.15s;
	}
	.search-wrap:focus-within {
		border-color: var(--border-strong);
	}
	.search-icon {
		width: 16px;
		height: 16px;
		color: var(--text-muted);
		flex-shrink: 0;
	}
	.search-input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		color: var(--text-primary);
		font-size: 0.88rem;
		font-family: inherit;
		min-width: 0;
	}
	.search-input::placeholder {
		color: var(--text-subtle);
	}
	.search-input::-webkit-search-cancel-button {
		display: none;
	}
	.search-clear {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 1rem;
		cursor: pointer;
		padding: 0 0.2rem;
		line-height: 1;
		font-family: inherit;
	}
	.search-clear:hover {
		color: var(--text-secondary);
	}

	/* Import panel */
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
		font-family: inherit;
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

	/* Category filter chips */
	.filter-zone {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.chip {
		padding: 0.22rem 0.65rem;
		background: transparent;
		color: var(--text-muted);
		border: 1px solid var(--border-soft);
		border-radius: 999px;
		font-size: 0.76rem;
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
		border-color: color-mix(in srgb, var(--accent-primary) 35%, transparent);
	}
	.chip-orphan {
		color: var(--text-subtle);
	}
	.chip-orphan.active {
		background: color-mix(in srgb, var(--accent-strong) 12%, var(--bg-surface));
		color: var(--accent-strong);
		border-color: color-mix(in srgb, var(--accent-strong) 35%, transparent);
	}

	/* Empty state */
	.empty-state {
		padding: 3rem 0;
		text-align: center;
	}
	.empty-text {
		color: var(--text-muted);
		font-size: 0.9rem;
		margin: 0;
	}
	.empty-text em {
		font-style: normal;
		color: var(--text-secondary);
	}
	.empty-text a {
		color: var(--accent-primary);
		text-decoration: none;
	}

	/* Featured notes grid */
	.featured-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.75rem;
	}
	.featured-grid.single {
		grid-template-columns: 1fr;
	}
	.featured-card {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 1.25rem 1.35rem;
		background: var(--bg-surface);
		border: 1px solid var(--border-soft);
		border-radius: 12px;
		text-decoration: none;
		color: inherit;
		transition: border-color 0.15s, background 0.15s;
		min-height: 140px;
	}
	.featured-card:hover {
		border-color: var(--border-strong);
		background: var(--bg-raised);
	}
	.featured-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.featured-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	.featured-category {
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--accent-primary);
		background: color-mix(in srgb, var(--accent-primary) 10%, transparent);
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
	}
	.featured-tag {
		font-size: 0.7rem;
		font-weight: 500;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--text-muted);
		background: var(--bg-raised);
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
	}
	.featured-age {
		font-size: 0.72rem;
		color: var(--text-subtle);
		white-space: nowrap;
		flex-shrink: 0;
	}
	.featured-title {
		font-size: 1.2rem;
		font-weight: 700;
		color: var(--text-primary);
		letter-spacing: -0.015em;
		line-height: 1.25;
		margin: 0;
	}
	.featured-excerpt {
		font-size: 0.82rem;
		color: var(--text-secondary);
		line-height: 1.55;
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.featured-footer {
		margin-top: auto;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.featured-status {
		font-size: 0.68rem;
		padding: 0.12rem 0.45rem;
		border-radius: 999px;
		font-weight: 500;
	}
	.featured-status[data-status='stub'] {
		background: color-mix(in srgb, var(--graph-node-stub) 15%, transparent);
		color: var(--graph-node-stub);
	}
	.featured-status[data-status='growing'] {
		background: color-mix(in srgb, var(--graph-node-growing) 15%, transparent);
		color: var(--graph-node-growing);
	}
	.featured-status[data-status='mature'] {
		background: color-mix(in srgb, var(--graph-node-mature) 15%, transparent);
		color: var(--graph-node-mature);
	}

	/* Regular notes list */
	.notes-list {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		border: 1px solid var(--border-soft);
		border-radius: 10px;
		padding: 0.35rem;
		background: var(--bg-surface);
	}

	/* Responsive */
	@media (max-width: 640px) {
		.featured-grid {
			grid-template-columns: 1fr;
		}
		.repo-header {
			flex-direction: column;
		}
		.header-actions {
			padding-top: 0;
		}
	}
</style>
