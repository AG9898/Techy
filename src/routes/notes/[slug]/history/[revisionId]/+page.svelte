<script lang="ts">
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	const statusColor: Record<string, string> = {
		stub: '#64748b',
		growing: '#38bdf8',
		mature: '#4ade80'
	};
</script>

<div class="revision-detail">
	<div class="revision-header">
		<a href="/notes/{data.note.slug}/history" class="back-link">← Revision History</a>
		<div class="header-actions">
			<span
				class="status-badge"
				style="background: {statusColor[data.revision.status]}20; color: {statusColor[data.revision.status]}"
			>
				{data.revision.status}
			</span>
			<span class="current-link">
				<a href="/notes/{data.note.slug}">View current</a>
			</span>
		</div>
	</div>

	<div class="revision-banner">
		Revision from {new Date(data.revision.revisedAt).toLocaleString()}
	</div>

	<h1>{data.revision.title}</h1>

	<div class="note-meta">
		{#if data.revision.category}
			<span class="meta-item category">{data.revision.category}</span>
		{/if}
		{#each data.revision.tags as tag}
			<span class="meta-item tag">{tag}</span>
		{/each}
	</div>

	<article class="note-body">
		{@html data.htmlBody}
	</article>
</div>

<style>
	.revision-detail {
		max-width: 720px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.revision-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.back-link {
		font-size: 0.85rem;
		color: #64748b;
		text-decoration: none;
	}
	.back-link:hover {
		color: #94a3b8;
	}
	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.status-badge {
		font-size: 0.75rem;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		font-weight: 500;
	}
	.current-link a {
		font-size: 0.85rem;
		color: #7dd3fc;
		text-decoration: none;
	}
	.current-link a:hover {
		text-decoration: underline;
	}
	.revision-banner {
		background: #1e293b;
		border: 1px solid #334155;
		border-radius: 6px;
		padding: 0.5rem 0.85rem;
		font-size: 0.8rem;
		color: #94a3b8;
	}
	h1 {
		font-size: 1.75rem;
		font-weight: 700;
		color: #e2e8f0;
		line-height: 1.3;
	}
	.note-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}
	.meta-item {
		font-size: 0.75rem;
		padding: 0.15rem 0.5rem;
		border-radius: 4px;
	}
	.category {
		background: #1e3a5f;
		color: #7dd3fc;
	}
	.tag {
		background: #1e293b;
		color: #64748b;
	}
	.note-body {
		line-height: 1.7;
		color: #cbd5e1;
	}
	.note-body :global(h1),
	.note-body :global(h2),
	.note-body :global(h3) {
		color: #e2e8f0;
		margin: 1.5rem 0 0.5rem;
	}
	.note-body :global(p) {
		margin-bottom: 1rem;
	}
	.note-body :global(code) {
		background: #1e293b;
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		font-size: 0.85em;
	}
	.note-body :global(pre) {
		background: #0f172a;
		border: 1px solid #1e293b;
		border-radius: 6px;
		padding: 1rem;
		overflow-x: auto;
		margin-bottom: 1rem;
	}
	.note-body :global(ul),
	.note-body :global(ol) {
		margin: 0.5rem 0 1rem 1.5rem;
	}
</style>
