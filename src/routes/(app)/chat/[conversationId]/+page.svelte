<script lang="ts">
	import ChatPage from '../+page.svelte';
	import type { PageData } from './$types.js';

	const { data }: { data: PageData } = $props();
</script>

<ChatPage {data} />
