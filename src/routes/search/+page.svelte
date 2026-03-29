<script lang="ts">
	import NoteCard from '$lib/components/NoteCard.svelte';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();
</script>

<div class="search-page">
	<h1>Search</h1>

	<form method="GET" class="search-form">
		<div class="search-row">
			<input
				type="text"
				name="q"
				value={data.q}
				placeholder="Search by title or category..."
				class="search-input"
			/>
			<button type="submit" class="btn-search">Search</button>
		</div>
		<div class="filter-row">
			<label class="filter-label">
				<span>Tags</span>
				<input
					type="text"
					name="tags"
					value={data.tagsParam}
					placeholder="svelte, typescript (comma-separated)"
					class="filter-input"
				/>
			</label>
			<label class="filter-label">
				<span>Category</span>
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

	{#if data.q || data.tagsParam || data.category}
		<p class="result-count">
			{data.results.length} result{data.results.length !== 1 ? 's' : ''}
		</p>

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
		max-width: 900px;
	}
	h1 {
		font-size: 1.5rem;
		font-weight: 700;
		color: #e2e8f0;
	}
	.search-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.search-row {
		display: flex;
		gap: 0.75rem;
	}
	.search-input {
		flex: 1;
		background: #0f172a;
		border: 1px solid #1e293b;
		color: #e2e8f0;
		border-radius: 6px;
		padding: 0.6rem 0.75rem;
		font-size: 0.95rem;
		font-family: inherit;
	}
	.search-input:focus {
		outline: none;
		border-color: #1d4ed8;
	}
	.btn-search {
		padding: 0.6rem 1.25rem;
		background: #1d4ed8;
		color: #fff;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.9rem;
	}
	.btn-search:hover {
		background: #2563eb;
	}
	.filter-row {
		display: flex;
		gap: 1rem;
	}
	.filter-label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		flex: 1;
		font-size: 0.8rem;
		color: #64748b;
	}
	.filter-input {
		background: #0f172a;
		border: 1px solid #1e293b;
		color: #e2e8f0;
		border-radius: 6px;
		padding: 0.45rem 0.65rem;
		font-size: 0.85rem;
		font-family: inherit;
	}
	.filter-input:focus {
		outline: none;
		border-color: #1d4ed8;
	}
	.result-count {
		font-size: 0.85rem;
		color: #64748b;
	}
	.empty {
		color: #64748b;
	}
	.results-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
	}
</style>
