<script lang="ts">
	type Props = {
		title: string;
		slug: string;
		tags: string[];
		category: string | null;
		status: 'stub' | 'growing' | 'mature';
		createdAt?: Date;
	};

	let { title, slug, tags, category, status, createdAt }: Props = $props();

	const statusColor: Record<string, string> = {
		stub: '#64748b',
		growing: '#38bdf8',
		mature: '#4ade80'
	};
</script>

<a href="/notes/{slug}" class="note-card">
	<div class="card-header">
		<span class="card-title">{title}</span>
		<span class="status-badge" style="background: {statusColor[status]}20; color: {statusColor[status]}">
			{status}
		</span>
	</div>
	{#if category}
		<span class="category">{category}</span>
	{/if}
	{#if tags.length > 0}
		<div class="tags">
			{#each tags as tag}
				<span class="tag">{tag}</span>
			{/each}
		</div>
	{/if}
	{#if createdAt}
		<span class="date">{new Date(createdAt).toLocaleDateString()}</span>
	{/if}
</a>

<style>
	.note-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem;
		background: #0f172a;
		border: 1px solid #1e293b;
		border-radius: 8px;
		text-decoration: none;
		color: inherit;
		transition: border-color 0.15s;
	}
	.note-card:hover {
		border-color: #334155;
	}
	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.card-title {
		font-weight: 600;
		color: #e2e8f0;
		font-size: 0.95rem;
	}
	.status-badge {
		font-size: 0.7rem;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		font-weight: 500;
		white-space: nowrap;
	}
	.category {
		font-size: 0.75rem;
		color: #94a3b8;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.tag {
		font-size: 0.7rem;
		padding: 0.1rem 0.45rem;
		background: #1e293b;
		color: #64748b;
		border-radius: 4px;
	}
	.date {
		font-size: 0.7rem;
		color: #475569;
	}
</style>
