<script lang="ts">
	import type { DefaultSession } from '@auth/sveltekit';

	let { session }: { session: DefaultSession | null } = $props();
</script>

<nav class="site-nav">
	<a href="/" class="nav-logo">Techy</a>
	<div class="nav-links">
		<a href="/">Graph</a>
		<a href="/notes">Notes</a>
		<a href="/notes/new">+ New</a>
		<a href="/search">Search</a>
	</div>
	<div class="nav-user">
		{#if session?.user}
			{#if session.user.image}
				<img src={session.user.image} alt={session.user.name ?? 'User'} class="avatar" />
			{/if}
			<form method="POST" action="/auth/signout">
				<button type="submit">Sign out</button>
			</form>
		{/if}
	</div>
</nav>

<style>
	.site-nav {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 0.75rem 1.5rem;
		background: #0f172a;
		color: #e2e8f0;
		border-bottom: 1px solid #1e293b;
	}
	.nav-logo {
		font-weight: 700;
		font-size: 1.1rem;
		color: #7dd3fc;
		text-decoration: none;
	}
	.nav-links {
		display: flex;
		gap: 1rem;
		margin-left: auto;
	}
	.nav-links a {
		color: #94a3b8;
		text-decoration: none;
		font-size: 0.9rem;
	}
	.nav-links a:hover {
		color: #e2e8f0;
	}
	.nav-user {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
	}
	button {
		background: none;
		border: 1px solid #334155;
		color: #94a3b8;
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
	}
	button:hover {
		color: #e2e8f0;
		border-color: #64748b;
	}
</style>
