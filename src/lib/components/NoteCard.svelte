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
</script>

<a href="/notes/{slug}" class="note-card">
	<div class="card-header">
		<span class="card-title">{title}</span>
		<span class="status-badge" data-status={status}>{status}</span>
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
		gap: 0.45rem;
		padding: 0.9rem 1rem;
		background: var(--bg-surface);
		border: 1px solid var(--border-soft);
		border-radius: 10px;
		text-decoration: none;
		color: inherit;
		transition: border-color 0.15s, background 0.15s;
	}
	.note-card:hover {
		border-color: var(--border-strong);
		background: var(--bg-raised);
	}
	.card-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.card-title {
		font-weight: 600;
		color: var(--text-primary);
		font-size: 0.9rem;
		line-height: 1.4;
	}
	.status-badge {
		font-size: 0.68rem;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		font-weight: 500;
		white-space: nowrap;
		flex-shrink: 0;
	}
	.status-badge[data-status='stub'] {
		background: color-mix(in srgb, var(--graph-node-stub) 15%, transparent);
		color: var(--graph-node-stub);
	}
	.status-badge[data-status='growing'] {
		background: color-mix(in srgb, var(--graph-node-growing) 15%, transparent);
		color: var(--graph-node-growing);
	}
	.status-badge[data-status='mature'] {
		background: color-mix(in srgb, var(--graph-node-mature) 15%, transparent);
		color: var(--graph-node-mature);
	}
	.category {
		font-size: 0.75rem;
		color: var(--accent-primary);
		font-weight: 500;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	.tag {
		font-size: 0.68rem;
		padding: 0.1rem 0.4rem;
		background: var(--bg-raised);
		color: var(--text-muted);
		border-radius: 4px;
	}
	.date {
		font-size: 0.68rem;
		color: var(--text-subtle);
		margin-top: auto;
	}
</style>
