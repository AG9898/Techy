<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Nav from '$lib/components/Nav.svelte';
	import type { LayoutData } from './$types.js';

	let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Techy</title>
</svelte:head>

<Nav session={data.session} />

<main class="page-content">
	{@render children()}
</main>
