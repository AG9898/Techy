<script lang="ts">
	import NoteCard from '$lib/components/NoteCard.svelte';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	let selectedCategory = $state<string | null>(null);
	let showOrphans = $state(false);

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
		<a href="/notes/new" class="btn-new">+ New Note</a>
	</div>

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
