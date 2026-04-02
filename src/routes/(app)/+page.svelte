<script lang="ts">
	import ForceGraph from '$lib/components/ForceGraph.svelte';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();
</script>

<div class="graph-wrapper">
	{#if data.nodes.length === 0}
		<div class="empty-state">
			<p>No notes yet.</p>
			<a href="/chat">Start in Chat →</a>
		</div>
	{:else}
		<ForceGraph nodes={data.nodes} links={data.links} />
	{/if}
</div>

<style>
	.graph-wrapper {
		position: fixed;
		top: 0;
		left: var(--rail-w, var(--rail-w-expanded, 192px));
		right: 0;
		bottom: 0;
		transition: left 0.2s ease;
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
</style>
