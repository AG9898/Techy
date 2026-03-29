<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children }: { children: import('svelte').Snippet } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Techy</title>
</svelte:head>

{@render children()}
