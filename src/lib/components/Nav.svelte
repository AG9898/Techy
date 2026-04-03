<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import type { DefaultSession } from '@auth/sveltekit';
	import { loadGsap, prefersReducedMotion } from '$lib/client/motion';

	let { session }: { session: DefaultSession | null } = $props();

	type Theme = 'dark' | 'light';
	type Accent = 'sand' | 'lavender' | 'mauve' | 'rose';

	function normalizeAccent(value: string | null): Accent {
		if (value === 'sand' || value === 'lavender' || value === 'mauve' || value === 'rose') {
			return value;
		}

		if (value === 'sky') return 'lavender';
		if (value === 'amber' || value === 'mint') return 'sand';
		return 'sand';
	}

	// Initialize from DOM attributes set by app.html inline script (client-side only)
	let theme = $state<Theme>(
		(typeof document !== 'undefined'
			? (document.documentElement.getAttribute('data-theme') as Theme)
			: null) ?? 'dark'
	);
	let accent = $state<Accent>(
		normalizeAccent(
			typeof document !== 'undefined'
				? document.documentElement.getAttribute('data-accent')
				: null
		)
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
		{ id: 'sand', color: '#a9895c' },
		{ id: 'lavender', color: '#8392b4' },
		{ id: 'mauve', color: '#aa88a1' },
		{ id: 'rose', color: '#a94f5e' }
	];

	type RailMode = 'route-default' | 'manual-collapsed' | 'temporary' | 'pinned';

	let railEl = $state<HTMLElement | null>(null);
	let railMode = $state<RailMode>('route-default');
	let railMotionReady = false;
	let lastVisualCollapseState = false;

	const railContentId = 'main-navigation-content';
	const isPinned = $derived(railMode === 'pinned');
	const isTemporaryOpen = $derived(railMode === 'temporary');
	const visuallyExpanded = $derived(
		railMode === 'pinned' ||
			railMode === 'temporary' ||
			(railMode === 'route-default' && page.url.pathname !== '/')
	);
	const visuallyCollapsed = $derived(!visuallyExpanded);

	onMount(() => {
		lastVisualCollapseState = visuallyCollapsed;
		railMotionReady = true;
	});

	// Keep a CSS variable in sync so graph-page can offset its fixed position
	$effect(() => {
		if (typeof document !== 'undefined') {
			document.documentElement.style.setProperty(
				'--rail-w',
				visuallyCollapsed ? 'var(--rail-w-collapsed)' : 'var(--rail-w-expanded)'
			);
		}
	});

	$effect(() => {
		if (!railEl || !railMotionReady) return;

		const collapsed = visuallyCollapsed;
		if (collapsed === lastVisualCollapseState) return;

		lastVisualCollapseState = collapsed;
		void animateRailTransition(collapsed);
	});

	const navLinks = [
		{ href: '/', label: 'Graph' },
		{ href: '/notes', label: 'Notes' },
		{ href: '/chat', label: 'Chat' }
	];

	function isActive(href: string): boolean {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}

	function openRail() {
		railMode = 'temporary';
	}

	function collapseRail() {
		railMode = 'manual-collapsed';
	}

	function togglePin() {
		if (railMode === 'pinned') {
			railMode = 'temporary';
			return;
		}

		railMode = 'pinned';
	}

	function handleNavLinkClick() {
		if (railMode !== 'temporary') return;

		collapseRail();
	}

	function handleWindowPointerDown(event: PointerEvent) {
		if (railMode !== 'temporary') return;

		const target = event.target;
		if (target instanceof Node && railEl?.contains(target)) return;

		collapseRail();
	}

	function handleWindowKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape' || railMode !== 'temporary') return;

		collapseRail();
	}

	function railWidthValue(variableName: '--rail-w-expanded' | '--rail-w-collapsed', fallback: string) {
		if (typeof window === 'undefined') return fallback;

		return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim() || fallback;
	}

	async function animateRailTransition(collapsed: boolean) {
		if (!railEl || prefersReducedMotion()) return;

		const gsap = await loadGsap();
		if (!gsap) return;

		const currentWidth = railEl.getBoundingClientRect().width;
		const targetWidth = railWidthValue(
			collapsed ? '--rail-w-collapsed' : '--rail-w-expanded',
			collapsed ? '52px' : '192px'
		);

		gsap.killTweensOf(railEl);
		gsap.fromTo(
			railEl,
			{ width: currentWidth, minWidth: currentWidth },
			{
				width: targetWidth,
				minWidth: targetWidth,
				duration: 0.24,
				ease: 'power2.out',
				clearProps: 'width,minWidth'
			}
		);

		if (!collapsed) {
			const labels = railEl.querySelectorAll<HTMLElement>('.nav-label');
			gsap.fromTo(
				labels,
				{ autoAlpha: 0, x: -8 },
				{
					autoAlpha: 1,
					x: 0,
					duration: 0.18,
					delay: 0.05,
					stagger: 0.012,
					ease: 'power2.out',
					clearProps: 'opacity,transform'
				}
			);
		}
	}

	async function animateShellFeedback(source: HTMLElement | null) {
		if (!railEl || prefersReducedMotion()) return;

		const gsap = await loadGsap();
		if (!gsap) return;

		if (source) {
			gsap.fromTo(
				source,
				{ scale: 0.94 },
				{
					scale: 1.04,
					duration: 0.12,
					repeat: 1,
					yoyo: true,
					ease: 'power1.inOut',
					clearProps: 'transform'
				}
			);
		}

		gsap.fromTo(
			railEl,
			{ filter: 'brightness(1.03) saturate(1.04)' },
			{ filter: 'brightness(1) saturate(1)', duration: 0.22, ease: 'power2.out', clearProps: 'filter' }
		);
	}

	function selectTheme(nextTheme: Theme, event: MouseEvent) {
		if (theme === nextTheme) return;

		theme = nextTheme;
		const source = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
		void animateShellFeedback(source);
	}

	function selectAccent(nextAccent: Accent, event: MouseEvent) {
		if (accent === nextAccent) return;

		accent = nextAccent;
		const source = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
		void animateShellFeedback(source);
	}
</script>

<svelte:window onpointerdown={handleWindowPointerDown} onkeydown={handleWindowKeydown} />

<nav
	bind:this={railEl}
	class="rail"
	class:collapsed={visuallyCollapsed}
	aria-label="Main navigation"
>
	<!-- ── Header ──────────────────────────────────────────────── -->
	<div class="rail-header">
		<a href="/" class="logo" aria-label="Techy home">
			<span class="logo-mark">T</span>
			<span class="logo-words">
				<span class="logo-name">Techy</span>
				<span class="logo-sub">Knowledge Graph</span>
			</span>
		</a>
		{#if visuallyCollapsed}
			<button
				class="rail-toggle"
				type="button"
				aria-controls={railContentId}
				aria-expanded="false"
				aria-label="Expand navigation"
				onclick={openRail}
			>
				<svg class="chevron flipped" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<polyline points="15 18 9 12 15 6" />
				</svg>
			</button>
		{:else}
			<div class="rail-actions">
				<button
					class="rail-toggle"
					type="button"
					aria-controls={railContentId}
					aria-pressed={isPinned}
					aria-label={isPinned ? 'Unpin navigation' : 'Pin navigation'}
					onclick={togglePin}
				>
					<svg class="pin-icon" class:active={isPinned} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M9 3h6" />
						<path d="M10 3v5l-3 3v1h10v-1l-3-3V3" />
						<path d="M12 12v9" />
					</svg>
				</button>
				<button
					class="rail-toggle"
					type="button"
					aria-controls={railContentId}
					aria-expanded="true"
					aria-label="Collapse navigation"
					onclick={collapseRail}
				>
					<svg class="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<polyline points="15 18 9 12 15 6" />
					</svg>
				</button>
			</div>
		{/if}
	</div>

	<!-- ── Primary nav ─────────────────────────────────────────── -->
	<div id={railContentId} class="nav-body">
		<ul class="nav-list" role="list">
			{#each navLinks as link}
				<li>
					<a
						href={link.href}
						class="nav-item"
						class:active={isActive(link.href)}
						title={visuallyCollapsed ? link.label : undefined}
						aria-current={isActive(link.href) ? 'page' : undefined}
						onclick={handleNavLinkClick}
					>
						{#if link.label === 'Graph'}
							<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<circle cx="12" cy="5" r="2.5"/>
								<circle cx="5" cy="19" r="2.5"/>
								<circle cx="19" cy="19" r="2.5"/>
								<line x1="12" y1="7.5" x2="5.8" y2="16.7"/>
								<line x1="12" y1="7.5" x2="18.2" y2="16.7"/>
							</svg>
						{:else if link.label === 'Notes'}
							<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
								<polyline points="14 2 14 8 20 8"/>
								<line x1="16" y1="13" x2="8" y2="13"/>
								<line x1="16" y1="17" x2="8" y2="17"/>
							</svg>
						{:else if link.label === 'Chat'}
							<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
							</svg>
						{/if}
						<span class="nav-label">{link.label}</span>
					</a>
				</li>
			{/each}
		</ul>

		<!-- ── Footer controls ─────────────────────────────────── -->
		<div class="rail-footer">
			<!-- Theme toggle -->
			<div class="theme-row">
				{#each themes as t}
					<button
						class="theme-btn"
						class:active={theme === t.id}
						onclick={(event) => selectTheme(t.id, event)}
						aria-label="Switch to {t.label} theme"
						title={visuallyCollapsed ? t.label : undefined}
					>
						{#if t.id === 'dark'}
							<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
							</svg>
						{:else}
							<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<circle cx="12" cy="12" r="5"/>
								<line x1="12" y1="1" x2="12" y2="3"/>
								<line x1="12" y1="21" x2="12" y2="23"/>
								<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
								<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
								<line x1="1" y1="12" x2="3" y2="12"/>
								<line x1="21" y1="12" x2="23" y2="12"/>
								<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
								<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
							</svg>
						{/if}
						<span class="nav-label">{t.label}</span>
					</button>
				{/each}
			</div>

			<!-- Accent dots -->
			{#if !visuallyCollapsed}
				<div class="accent-row">
					{#each accents as a}
						<button
							class="accent-dot"
							class:active={accent === a.id}
							onclick={(event) => selectAccent(a.id, event)}
							aria-label="Switch to {a.id} accent"
							title={a.id}
							style="--dot-color: {a.color}"
						></button>
					{/each}
				</div>
			{/if}

			<!-- Account -->
			{#if session?.user}
				<div class="account-row" title={visuallyCollapsed && session.user.name ? session.user.name : undefined}>
					{#if session.user.image}
						<img
							src={session.user.image}
							alt={session.user.name ?? 'User'}
							class="avatar"
						/>
					{/if}
					<span class="nav-label user-name">{session.user.name ?? ''}</span>
				</div>
				<form method="POST" action="/auth/signout">
					<button type="submit" class="signout-btn" title={visuallyCollapsed ? 'Sign out' : undefined}>
						<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
							<polyline points="16 17 21 12 16 7"/>
							<line x1="21" y1="12" x2="9" y2="12"/>
						</svg>
						<span class="nav-label">Sign out</span>
					</button>
				</form>
			{/if}
		</div>
	</div>
</nav>

<style>
	/* ── Rail shell ───────────────────────────────────────────── */
	.rail {
		display: flex;
		flex-direction: column;
		width: var(--rail-w-expanded, 192px);
		min-width: var(--rail-w-expanded, 192px);
		height: 100vh;
		background: var(--bg-surface);
		border-right: 1px solid var(--border-soft);
		overflow: hidden;
		flex-shrink: 0;
		position: sticky;
		top: 0;
		z-index: 40;
	}

	.rail.collapsed {
		width: var(--rail-w-collapsed, 52px);
		min-width: var(--rail-w-collapsed, 52px);
	}

	/* ── Header ───────────────────────────────────────────────── */
	.rail-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 0.75rem 0.75rem;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.rail.collapsed .rail-header {
		justify-content: center;
		padding-inline: 0;
	}

	.rail-actions {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		min-width: 0;
		overflow: hidden;
	}

	.logo-mark {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: var(--accent-soft);
		color: var(--accent-primary);
		border-radius: 7px;
		font-size: 0.8rem;
		font-weight: 700;
		flex-shrink: 0;
	}

	.logo-words {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		transition: opacity 0.15s ease;
		min-width: 0;
	}

	.rail.collapsed .logo {
		display: none;
	}

	.rail.collapsed .logo-words {
		opacity: 0;
		pointer-events: none;
	}

	.logo-name {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text-primary);
		white-space: nowrap;
		letter-spacing: -0.01em;
	}

	.logo-sub {
		font-size: 0.6rem;
		color: var(--text-muted);
		white-space: nowrap;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	/* ── Toggle button ────────────────────────────────────────── */
	.rail-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: none;
		border: 1px solid var(--border-soft);
		border-radius: 6px;
		color: var(--text-muted);
		cursor: pointer;
		flex-shrink: 0;
		transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
	}

	.rail.collapsed .rail-toggle {
		width: 28px;
		height: 28px;
	}

	.rail-toggle:hover {
		color: var(--text-secondary);
		border-color: var(--border-strong);
		background: var(--bg-raised);
	}

	.chevron {
		transition: transform 0.2s ease;
	}

	.chevron.flipped {
		transform: rotate(180deg);
	}

	.pin-icon {
		transition: color 0.15s ease, transform 0.15s ease;
	}

	.pin-icon.active {
		color: var(--accent-primary);
		transform: rotate(-18deg);
	}

	/* ── Nav body (collapsible content region) ────────────────── */
	.nav-body {
		display: flex;
		flex-direction: column;
		flex: 1;
		overflow: hidden;
		min-height: 0;
	}

	/* ── Nav list ─────────────────────────────────────────────── */
	.nav-list {
		list-style: none;
		padding: 0.5rem 0.5rem 0;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		flex-shrink: 0;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.5rem 0.625rem;
		border-radius: 8px;
		color: var(--text-secondary);
		text-decoration: none;
		font-size: 0.8125rem;
		transition: color 0.15s ease, background 0.15s ease;
		white-space: nowrap;
	}

	.nav-item:hover {
		color: var(--text-primary);
		background: var(--bg-raised);
	}

	.nav-item.active {
		color: var(--accent-primary);
		background: var(--accent-soft);
	}

	/* ── Icons ────────────────────────────────────────────────── */
	.nav-icon {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}

	/* ── Labels (fade when collapsed) ────────────────────────── */
	.nav-label {
		overflow: hidden;
		white-space: nowrap;
		transition: opacity 0.15s ease;
	}

	.rail.collapsed .nav-label {
		opacity: 0;
		pointer-events: none;
		width: 0;
	}

	/* ── Rail footer ──────────────────────────────────────────── */
	.rail-footer {
		margin-top: auto;
		padding: 0.75rem 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		border-top: 1px solid var(--border-soft);
		flex-shrink: 0;
	}

	/* ── Theme toggle row ─────────────────────────────────────── */
	.theme-row {
		display: flex;
		gap: 0.125rem;
	}

	.rail.collapsed .theme-row {
		flex-direction: column;
		gap: 0.25rem;
	}

	.theme-btn {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		width: 100%;
		padding: 0.4rem 0.625rem;
		background: none;
		border: none;
		border-radius: 7px;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 0.8rem;
		font-family: inherit;
		white-space: nowrap;
		transition: color 0.15s ease, background 0.15s ease;
	}

	.rail.collapsed .nav-item,
	.rail.collapsed .theme-btn,
	.rail.collapsed .signout-btn,
	.rail.collapsed .account-row {
		justify-content: center;
		gap: 0;
	}

	.rail.collapsed .nav-item,
	.rail.collapsed .theme-btn,
	.rail.collapsed .signout-btn {
		padding-inline: 0;
	}

	.theme-btn:hover {
		color: var(--text-secondary);
		background: var(--bg-raised);
	}

	.theme-btn.active {
		color: var(--accent-primary);
		background: var(--accent-soft);
	}

	/* ── Accent dots row ──────────────────────────────────────── */
	.accent-row {
		display: flex;
		gap: 0.375rem;
		align-items: center;
		padding: 0 0.625rem;
	}

	.accent-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--dot-color);
		border: 2px solid transparent;
		cursor: pointer;
		padding: 0;
		flex-shrink: 0;
		transition: transform 0.15s ease, border-color 0.15s ease;
	}

	.accent-dot:hover {
		transform: scale(1.25);
	}

	.accent-dot.active {
		border-color: var(--text-primary);
		transform: scale(1.15);
	}

	/* ── Account row ──────────────────────────────────────────── */
	.account-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 0.25rem;
		overflow: hidden;
	}

	.rail.collapsed .account-row {
		padding-inline: 0;
	}

	.avatar {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		border: 1.5px solid var(--border-soft);
		flex-shrink: 0;
	}

	.user-name {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	/* ── Sign out button ──────────────────────────────────────── */
	.signout-btn {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		width: 100%;
		padding: 0.4rem 0.625rem;
		background: none;
		border: none;
		border-radius: 7px;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 0.8rem;
		font-family: inherit;
		white-space: nowrap;
		transition: color 0.15s ease, background 0.15s ease;
	}

	.signout-btn:hover {
		color: var(--accent-red);
		background: var(--bg-raised);
	}

	@media (prefers-reduced-motion: reduce) {
		.logo-words,
		.rail-toggle,
		.chevron,
		.pin-icon,
		.nav-item,
		.nav-label,
		.theme-btn,
		.accent-dot,
		.signout-btn {
			transition: none;
		}
	}
</style>
