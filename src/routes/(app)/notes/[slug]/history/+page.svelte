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
		color: #64748b;
		text-decoration: none;
	}
	.back-link:hover {
		color: #94a3b8;
	}
	h1 {
		font-size: 1.4rem;
		font-weight: 700;
		color: #e2e8f0;
	}
	.empty {
		color: #64748b;
		font-size: 0.9rem;
	}
	.revision-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.revision-item {
		border: 1px solid #1e293b;
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
		background: #0f172a;
	}
	.revision-title {
		font-size: 0.95rem;
		color: #cbd5e1;
		font-weight: 500;
	}
	.revision-meta {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		color: #64748b;
	}
	.sep {
		color: #334155;
	}
	.status-dot {
		display: inline-block;
		width: 7px;
		height: 7px;
		border-radius: 50%;
	}
	.status-dot[data-status='stub'] { background: #64748b; }
	.status-dot[data-status='growing'] { background: #38bdf8; }
	.status-dot[data-status='mature'] { background: #4ade80; }
</style>
