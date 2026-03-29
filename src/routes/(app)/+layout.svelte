<script lang="ts">
	import Nav from '$lib/components/Nav.svelte';
	import type { LayoutData } from './$types.js';

	let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();
</script>

<Nav session={data.session} />

<main class="page-content">
	{@render children()}
</main>
