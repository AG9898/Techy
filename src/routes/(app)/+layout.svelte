<script lang="ts">
	import Nav from '$lib/components/Nav.svelte';
	import type { LayoutData } from './$types.js';

	let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();
</script>

<div class="app-shell">
	<Nav session={data.session} />
	<main class="page-content">
		{@render children()}
	</main>
</div>

<style>
	.app-shell {
		display: flex;
		height: 100vh;
		overflow: hidden;
	}
</style>
