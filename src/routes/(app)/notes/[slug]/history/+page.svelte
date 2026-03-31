<script lang="ts">
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();
</script>

<div class="history-page">
	<div class="page-header">
		<a href="/notes/{data.note.slug}" class="back-link">← {data.note.title}</a>
		<h1>Revision History</h1>
	</div>

	{#if data.revisions.length === 0}
		<p class="empty">No revisions yet. Revisions are saved each time the note is edited.</p>
	{:else}
		<ul class="revision-list">
			{#each data.revisions as rev}
				<li class="revision-item">
					<a href="/notes/{data.note.slug}/history/{rev.id}" class="revision-link">
						<span class="revision-title">{rev.title}</span>
						<span class="revision-meta">
							<span class="status-dot" data-status={rev.status}></span>
							{rev.status}
							<span class="sep">·</span>
							{new Date(rev.revisedAt).toLocaleString()}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.history-page {
		max-width: 720px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.page-header {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.back-link {
		font-size: 0.85rem;
		color: var(--text-muted);
		text-decoration: none;
	}
	.back-link:hover {
		color: var(--text-secondary);
	}
	h1 {
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--text-primary);
	}
	.empty {
		color: var(--text-muted);
		font-size: 0.9rem;
	}
	.revision-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.revision-item {
		border: 1px solid var(--border-soft);
		border-radius: 6px;
	}
	.revision-link {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		text-decoration: none;
		color: inherit;
		border-radius: 6px;
	}
	.revision-link:hover {
		background: var(--bg-surface);
	}
	.revision-title {
		font-size: 0.95rem;
		color: var(--text-primary);
		font-weight: 500;
	}
	.revision-meta {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		color: var(--text-muted);
	}
	.sep {
		color: var(--text-subtle);
	}
	.status-dot {
		display: inline-block;
		width: 7px;
		height: 7px;
		border-radius: 50%;
	}
	.status-dot[data-status='stub'] { background: var(--graph-node-stub); }
	.status-dot[data-status='growing'] { background: var(--graph-node-growing); }
	.status-dot[data-status='mature'] { background: var(--graph-node-mature); }
</style>
