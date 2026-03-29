<script lang="ts">
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	const statusColor: Record<string, string> = {
		stub: '#64748b',
		growing: '#38bdf8',
		mature: '#4ade80'
	};
</script>

<div class="note-detail">
	<div class="note-header">
		<a href="/notes" class="back-link">← Notes</a>
		<div class="header-actions">
			<span
				class="status-badge"
				style="background: {statusColor[data.note.status]}20; color: {statusColor[data.note.status]}"
			>
				{data.note.status}
			</span>
			<a href="/notes/{data.note.slug}/history" class="btn-history">History</a>
			<a href="/notes/{data.note.slug}/edit" class="btn-edit">Edit</a>
		</div>
	</div>

	<h1>{data.note.title}</h1>

	<div class="note-meta">
		{#if data.note.category}
			<span class="meta-item category">{data.note.category}</span>
		{/if}
		{#if data.note.tags.length > 0}
			{#each data.note.tags as tag}
				<span class="meta-item tag">{tag}</span>
			{/each}
		{/if}
		{#if data.note.aiGenerated}
			<span class="meta-item ai-badge" title={data.note.aiModel ?? ''}>AI Generated</span>
		{/if}
		<span class="meta-item date">{new Date(data.note.createdAt).toLocaleDateString()}</span>
	</div>

	<article class="note-body">
		{@html data.htmlBody}
	</article>

	{#if data.outgoing.length > 0 || data.incoming.length > 0}
		<div class="related-notes">
			{#if data.outgoing.length > 0}
				<div class="related-section">
					<h3>Links to</h3>
					<ul>
						{#each data.outgoing as linked}
							<li><a href="/notes/{linked.slug}">{linked.title}</a></li>
						{/each}
					</ul>
				</div>
			{/if}
			{#if data.incoming.length > 0}
				<div class="related-section">
					<h3>Linked from</h3>
					<ul>
						{#each data.incoming as linked}
							<li><a href="/notes/{linked.slug}">{linked.title}</a></li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.note-detail {
		max-width: 720px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.note-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.back-link {
		font-size: 0.85rem;
		color: #64748b;
		text-decoration: none;
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
	.btn-history {
		padding: 0.3rem 0.85rem;
		background: transparent;
		color: #64748b;
		border-radius: 6px;
		text-decoration: none;
		font-size: 0.85rem;
	}
	.btn-history:hover {
		color: #94a3b8;
	}
	.btn-edit {
		padding: 0.3rem 0.85rem;
		background: #1e293b;
		color: #94a3b8;
		border-radius: 6px;
		text-decoration: none;
		font-size: 0.85rem;
	}
	.btn-edit:hover {
		color: #e2e8f0;
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
	.ai-badge {
		background: #2d1b69;
		color: #a78bfa;
	}
	.date {
		background: transparent;
		color: #475569;
		padding-left: 0;
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
	.related-notes {
		border-top: 1px solid #1e293b;
		padding-top: 1.5rem;
		display: flex;
		gap: 2rem;
	}
	.related-section h3 {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #64748b;
		margin-bottom: 0.5rem;
	}
	.related-section ul {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.related-section a {
		font-size: 0.9rem;
		color: #7dd3fc;
		text-decoration: none;
	}
	.related-section a:hover {
		text-decoration: underline;
	}
</style>
