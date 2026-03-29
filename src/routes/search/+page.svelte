<script lang="ts">
	import NoteCard from '$lib/components/NoteCard.svelte';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();
</script>

<div class="search-page">
	<div class="search-command">
		<form method="GET" class="search-form">
			<div class="search-row">
				<input
					type="text"
					name="q"
					value={data.q}
					placeholder="Search notes..."
					class="search-input"
				/>
				<button type="submit" class="btn-search">Search</button>
			</div>
			<div class="filter-row">
				<label class="filter-label">
					<span class="filter-name">Tags</span>
					<input
						type="text"
						name="tags"
						value={data.tagsParam}
						placeholder="svelte, typescript"
						class="filter-input"
					/>
				</label>
				<label class="filter-label">
					<span class="filter-name">Category</span>
					<input
						type="text"
						name="category"
						value={data.category}
						placeholder="Web Frameworks"
						class="filter-input"
					/>
				</label>
			</div>
		</form>
	</div>

	{#if data.q || data.tagsParam || data.category}
		<div class="results-header">
			<span class="result-count">
				{data.results.length} result{data.results.length !== 1 ? 's' : ''}
			</span>
		</div>

		{#if data.results.length === 0}
			<p class="empty">No notes match your search.</p>
		{:else}
			<div class="results-grid">
				{#each data.results as note}
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
	{/if}
</div>

<style>
	.search-page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		max-width: 860px;
	}
	.search-command {
		background: var(--bg-surface);
		border: 1px solid var(--border-soft);
		border-radius: 12px;
		padding: 1.25rem 1.5rem;
	}
	.search-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.search-row {
		display: flex;
		gap: 0.6rem;
	}
	.search-input {
		flex: 1;
		background: var(--bg-raised);
		border: 1px solid var(--border-soft);
		color: var(--text-primary);
		border-radius: 8px;
		padding: 0.65rem 1rem;
		font-size: 1rem;
		font-family: inherit;
		transition: border-color 0.15s;
	}
	.search-input:focus {
		outline: none;
		border-color: var(--border-strong);
	}
	.btn-search {
		padding: 0.65rem 1.25rem;
		background: var(--accent-strong);
		color: #fff;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.9rem;
		font-family: inherit;
		font-weight: 500;
		white-space: nowrap;
		transition: opacity 0.15s;
	}
	.btn-search:hover {
		opacity: 0.85;
	}
	.filter-row {
		display: flex;
		gap: 1rem;
	}
	.filter-label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		flex: 1;
	}
	.filter-name {
		font-size: 0.7rem;
		color: var(--text-muted);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.filter-input {
		background: var(--bg-raised);
		border: 1px solid var(--border-soft);
		color: var(--text-primary);
		border-radius: 6px;
		padding: 0.4rem 0.65rem;
		font-size: 0.85rem;
		font-family: inherit;
		transition: border-color 0.15s;
	}
	.filter-input:focus {
		outline: none;
		border-color: var(--border-strong);
	}
	.results-header {
		display: flex;
		align-items: center;
	}
	.result-count {
		font-size: 0.82rem;
		color: var(--text-muted);
	}
	.empty {
		color: var(--text-muted);
	}
	.results-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 0.75rem;
	}
</style>
