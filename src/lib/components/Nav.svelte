<script lang="ts">
	import type { DefaultSession } from '@auth/sveltekit';

	let { session }: { session: DefaultSession | null } = $props();

	type Theme = 'dark' | 'light';
	type Accent = 'sky' | 'mint' | 'amber' | 'rose';

	// Initialize from DOM attributes set by app.html inline script (client-side only)
	let theme = $state<Theme>(
		(typeof document !== 'undefined'
			? (document.documentElement.getAttribute('data-theme') as Theme)
			: null) ?? 'dark'
	);
	let accent = $state<Accent>(
		(typeof document !== 'undefined'
			? (document.documentElement.getAttribute('data-accent') as Accent)
			: null) ?? 'sky'
	);

	$effect(() => {
		document.documentElement.setAttribute('data-theme', theme);
		document.documentElement.setAttribute('data-accent', accent);
		localStorage.setItem('techy-theme', theme);
		localStorage.setItem('techy-accent', accent);
	});

	const themes: { id: Theme; label: string }[] = [
		{ id: 'dark', label: 'Dark' },
		{ id: 'light', label: 'Light' }
	];

	const accents: { id: Accent; color: string }[] = [
		{ id: 'sky', color: '#7dd3fc' },
		{ id: 'mint', color: '#86efac' },
		{ id: 'amber', color: '#fcd34d' },
		{ id: 'rose', color: '#fda4af' }
	];
</script>

<nav class="site-nav">
	<a href="/" class="nav-logo">Techy</a>

	<div class="nav-links">
		<a href="/">Graph</a>
		<a href="/notes">Notes</a>
		<a href="/search">Search</a>
		<a href="/chat">Chat</a>
	</div>

	<div class="nav-controls">
		<div class="theme-toggles">
			{#each themes as t}
				<button
					class="theme-btn"
					class:active={theme === t.id}
					onclick={() => (theme = t.id)}
					aria-label="Switch to {t.label} theme"
				>{t.label}</button>
			{/each}
		</div>
		<div class="accent-toggles">
			{#each accents as a}
				<button
					class="accent-dot"
					class:active={accent === a.id}
					onclick={() => (accent = a.id)}
					aria-label="Switch to {a.id} accent"
					style="--dot-color: {a.color}"
				></button>
			{/each}
		</div>
	</div>

	<div class="nav-user">
		{#if session?.user}
			{#if session.user.image}
				<img src={session.user.image} alt={session.user.name ?? 'User'} class="avatar" />
			{/if}
			<form method="POST" action="/auth/signout">
				<button type="submit" class="signout-btn">Sign out</button>
			</form>
		{/if}
	</div>
</nav>

<style>
	.site-nav {
		position: sticky;
		top: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 0 1.5rem;
		height: 60px;
		background: var(--bg-surface);
		border-bottom: 1px solid var(--border-soft);
	}

	/* ── Logo ─────────────────────────────────────────────── */
	.nav-logo {
		font-weight: 700;
		font-size: 1.1rem;
		letter-spacing: -0.01em;
		color: var(--accent-primary);
		text-decoration: none;
	}

	/* ── Navigation links ─────────────────────────────────── */
	.nav-links {
		display: flex;
		gap: 0.125rem;
		margin-left: auto;
	}

	.nav-links a {
		color: var(--text-secondary);
		text-decoration: none;
		font-size: 0.875rem;
		padding: 0.35rem 0.75rem;
		border-radius: 9999px;
		transition: color 0.15s ease, background 0.15s ease;
	}

	.nav-links a:hover {
		color: var(--text-primary);
		background: var(--bg-raised);
	}

	/* ── Theme + accent controls ──────────────────────────── */
	.nav-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.theme-toggles {
		display: flex;
		gap: 0.125rem;
		padding: 0.2rem;
		background: var(--bg-base);
		border: 1px solid var(--border-soft);
		border-radius: 9999px;
	}

	.theme-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		padding: 0.2rem 0.55rem;
		border-radius: 9999px;
		cursor: pointer;
		font-size: 0.7rem;
		transition: color 0.15s ease, background 0.15s ease;
	}

	.theme-btn:hover {
		color: var(--text-primary);
	}

	.theme-btn.active {
		background: var(--bg-surface);
		color: var(--accent-primary);
	}

	.accent-toggles {
		display: flex;
		gap: 0.35rem;
		align-items: center;
	}

	.accent-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--dot-color);
		border: 2px solid transparent;
		cursor: pointer;
		padding: 0;
		transition: transform 0.15s ease, border-color 0.15s ease;
	}

	.accent-dot:hover {
		transform: scale(1.25);
	}

	.accent-dot.active {
		border-color: var(--text-primary);
		transform: scale(1.15);
	}

	/* ── User area ────────────────────────────────────────── */
	.nav-user {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}

	.avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 1.5px solid var(--border-soft);
	}

	.signout-btn {
		background: none;
		border: 1px solid var(--border-soft);
		color: var(--text-muted);
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		cursor: pointer;
		font-size: 0.75rem;
		transition: color 0.15s ease, border-color 0.15s ease;
	}

	.signout-btn:hover {
		color: var(--text-secondary);
		border-color: var(--border-strong);
	}
</style>
