<script lang="ts">
	import ForceGraph from '$lib/components/ForceGraph.svelte';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();
</script>

<div class="graph-wrapper">
	{#if data.nodes.length === 0}
		<div class="empty-state">
			<p>No notes yet.</p>
			<a href="/notes/new">Create your first note →</a>
		</div>
	{:else}
		<ForceGraph nodes={data.nodes} links={data.links} />
		<div class="graph-legend">
			<span class="legend-item">
				<span class="legend-dot" style="background: var(--graph-node-stub)"></span>
				<span>stub</span>
			</span>
			<span class="legend-item">
				<span class="legend-dot" style="background: var(--graph-node-growing)"></span>
				<span>growing</span>
			</span>
			<span class="legend-item">
				<span class="legend-dot" style="background: var(--graph-node-mature)"></span>
				<span>mature</span>
			</span>
		</div>
	{/if}
</div>

<style>
	.graph-wrapper {
		position: fixed;
		top: 60px;
		left: 0;
		right: 0;
		bottom: 0;
	}
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 1rem;
		color: var(--text-muted);
	}
	.empty-state a {
		font-size: 0.9rem;
	}
	.graph-legend {
		position: absolute;
		bottom: 1.5rem;
		left: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		background: var(--bg-overlay);
		border: 1px solid var(--border-soft);
		border-radius: 0.75rem;
		padding: 0.6rem 0.9rem;
		backdrop-filter: blur(6px);
		pointer-events: none;
	}
	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		color: var(--text-secondary);
		letter-spacing: 0.01em;
	}
	.legend-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
</style>
