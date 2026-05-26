<script lang="ts">
	import type { PageData } from './$types.js';
	import { marked } from 'marked';

	let { data }: { data: PageData } = $props();

	const statusLabels: Record<string, string> = {
		not_started: 'Not started',
		in_progress: 'In progress',
		completed: 'Completed',
		skipped: 'Skipped'
	};

	const difficultyClass: Record<string, string> = {
		Easy: 'diff-easy',
		Medium: 'diff-medium',
		Hard: 'diff-hard'
	};

	// Daily fetch state
	let fetchStatus = $state<'idle' | 'loading' | 'success' | 'error'>('idle');
	let fetchError = $state('');
	let fetchedProblem = $state<typeof data.dailyProblem | null>(null);

	// Import modal state
	let importOpen = $state(false);
	let importJson = $state('');
	let importStatus = $state<'idle' | 'loading' | 'success' | 'error'>('idle');
	let importError = $state('');
	let importedProblem = $state<{ id: string; title: string } | null>(null);

	const dailyProblem = $derived(fetchedProblem ?? data.dailyProblem);

	async function triggerDailyFetch() {
		fetchStatus = 'loading';
		fetchError = '';
		try {
			const res = await fetch('/api/practice/daily-fetch', { method: 'POST' });
			const body = (await res.json()) as
				| { problem: typeof data.dailyProblem; source: string; fetchedAt: string; created: boolean }
				| { error: string };
			if (!res.ok || 'error' in body) {
				fetchStatus = 'error';
				fetchError = ('error' in body ? body.error : null) ?? 'Fetch failed. Use manual import.';
			} else {
				fetchedProblem = body.problem;
				fetchStatus = 'success';
			}
		} catch {
			fetchStatus = 'error';
			fetchError = 'Network error. Check your connection and try again.';
		}
	}

	async function submitImport() {
		importStatus = 'loading';
		importError = '';
		importedProblem = null;
		let parsed: unknown;
		try {
			parsed = JSON.parse(importJson);
		} catch {
			importStatus = 'error';
			importError = 'Invalid JSON — check your input.';
			return;
		}
		try {
			const res = await fetch('/api/practice/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(parsed)
			});
			const body = (await res.json()) as
				| { problem: { id: string; title: string }; created: boolean }
				| { errors: { field: string; message: string }[] }
				| { error: string };
			if (!res.ok) {
				if ('errors' in body) {
					importStatus = 'error';
					importError = body.errors.map((e) => `${e.field}: ${e.message}`).join('; ');
				} else if ('error' in body) {
					importStatus = 'error';
					importError = body.error;
				} else {
					importStatus = 'error';
					importError = 'Import failed.';
				}
			} else if ('problem' in body) {
				importStatus = 'success';
				importedProblem = { id: body.problem.id, title: body.problem.title };
				importJson = '';
			}
		} catch {
			importStatus = 'error';
			importError = 'Network error during import.';
		}
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '';
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function formatRelative(isoStr: string | null): string {
		if (!isoStr) return '';
		const diff = Date.now() - new Date(isoStr).getTime();
		const days = Math.floor(diff / 86_400_000);
		if (days === 0) return 'today';
		if (days === 1) return 'yesterday';
		return `${days}d ago`;
	}
</script>

<div class="practice-page">
	<!-- ── Page header ──────────────────────────────────────────────────── -->
	<header class="practice-header">
		<div class="header-row">
			<div class="header-title-block">
				<h1 class="page-title">Practice</h1>
				{#if data.stats.streakDays > 0}
					<span class="streak-badge">{data.stats.streakDays}d streak</span>
				{/if}
			</div>
			<div class="header-actions">
				<button
					class="action-btn"
					type="button"
					onclick={() => (importOpen = !importOpen)}
					aria-expanded={importOpen}
				>
					<svg
						class="btn-icon"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.75"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
						<polyline points="17 8 12 3 7 8" />
						<line x1="12" y1="3" x2="12" y2="15" />
					</svg>
					Import JSON
				</button>
				<button
					class="action-btn primary"
					type="button"
					onclick={triggerDailyFetch}
					disabled={fetchStatus === 'loading'}
				>
					{#if fetchStatus === 'loading'}
						Fetching…
					{:else}
						Fetch today
					{/if}
				</button>
			</div>
		</div>

		{#if fetchStatus === 'error'}
			<p class="fetch-error">{fetchError}</p>
		{/if}
		{#if fetchStatus === 'success'}
			<p class="fetch-ok">Daily problem loaded.</p>
		{/if}

		<!-- Import panel -->
		{#if importOpen}
			<div class="import-panel">
				<p class="import-label">Paste a problem JSON object matching the import schema:</p>
				<textarea
					class="import-textarea"
					rows={8}
					placeholder="JSON object with source, sourceUrl, title, promptMarkdown fields"
					bind:value={importJson}
					disabled={importStatus === 'loading'}
				></textarea>
				<div class="import-actions">
					<button
						class="action-btn primary"
						type="button"
						onclick={submitImport}
						disabled={importStatus === 'loading' || !importJson.trim()}
					>
						{importStatus === 'loading' ? 'Importing…' : 'Import'}
					</button>
					<button
						class="action-btn"
						type="button"
						onclick={() => {
							importOpen = false;
							importStatus = 'idle';
							importError = '';
							importJson = '';
							importedProblem = null;
						}}
					>
						Cancel
					</button>
				</div>
				{#if importStatus === 'error'}
					<p class="import-error">{importError}</p>
				{/if}
				{#if importStatus === 'success' && importedProblem}
					<p class="import-ok">
						Imported <a href="/practice/{importedProblem.id}">{importedProblem.title}</a>.
					</p>
				{/if}
			</div>
		{/if}
	</header>

	<!-- ── Stats strip ──────────────────────────────────────────────────── -->
	<div class="stats-strip">
		<span class="stat-item">
			<span class="stat-value">{data.stats.completed}</span>
			<span class="stat-label">completed</span>
		</span>
		<span class="stat-sep" aria-hidden="true">·</span>
		<span class="stat-item">
			<span class="stat-value">{data.stats.inProgress}</span>
			<span class="stat-label">in progress</span>
		</span>
	</div>

	<!-- ── Daily problem card ───────────────────────────────────────────── -->
	{#if dailyProblem}
		<section class="daily-section">
			<h2 class="section-label">Today's problem</h2>
			<div class="daily-card">
				<div class="daily-meta">
					{#if dailyProblem.dailyDate}
						<span class="daily-date">{formatDate(String(dailyProblem.dailyDate))}</span>
					{/if}
					{#if dailyProblem.difficulty}
						<span class="difficulty {difficultyClass[dailyProblem.difficulty] ?? ''}"
							>{dailyProblem.difficulty}</span
						>
					{/if}
					<span class="source-chip">{dailyProblem.source}</span>
				</div>
				<h3 class="daily-title">
					<a class="daily-title-link" href="/practice/{dailyProblem.id}">{dailyProblem.title}</a>
				</h3>
				{#if dailyProblem.topicTags && dailyProblem.topicTags.length > 0}
					<div class="tag-row">
						{#each dailyProblem.topicTags.slice(0, 4) as tag}
							<span class="topic-tag">{tag}</span>
						{/each}
						{#if dailyProblem.topicTags.length > 4}
							<span class="topic-tag more">+{dailyProblem.topicTags.length - 4}</span>
						{/if}
					</div>
				{/if}
				<div class="daily-footer">
					<a class="open-cta" href="/practice/{dailyProblem.id}">Open workspace →</a>
					{#if dailyProblem.sourceUrl}
						<a
							class="source-link"
							href={dailyProblem.sourceUrl}
							target="_blank"
							rel="noopener noreferrer"
						>
							View on {dailyProblem.source} ↗
						</a>
					{/if}
				</div>
			</div>
		</section>
	{:else}
		<section class="daily-section">
			<h2 class="section-label">Today's problem</h2>
			<div class="empty-daily">
				<p class="empty-copy">No problem loaded yet. Fetch today's challenge or import one manually.</p>
			</div>
		</section>
	{/if}

	<!-- ── Recent problems ──────────────────────────────────────────────── -->
	{#if data.recentProblems.length > 0}
		<section class="recent-section">
			<h2 class="section-label">Recent</h2>
			<ul class="problem-list" role="list">
				{#each data.recentProblems as problem}
					<li class="problem-row">
						<a class="problem-row-link" href="/practice/{problem.id}">
							<span class="problem-title">{problem.title}</span>
							<span class="problem-meta">
								{#if problem.difficulty}
									<span class="difficulty {difficultyClass[problem.difficulty] ?? ''} sm"
										>{problem.difficulty}</span
									>
								{/if}
								<span class="status-pill status-{problem.status}"
									>{statusLabels[problem.status]}</span
								>
								{#if problem.dailyDate}
									<span class="problem-date">{formatDate(problem.dailyDate)}</span>
								{/if}
								{#if problem.completedAt}
									<span class="problem-date muted">{formatRelative(problem.completedAt)}</span>
								{/if}
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<style>
	.practice-page {
		padding: 2rem 2.5rem;
		max-width: 860px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 2rem;
		overflow-y: auto;
		height: 100%;
	}

	/* ── Header ─────────────────────────────────────────────────────────── */
	.practice-header {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.header-title-block {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.page-title {
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
		letter-spacing: -0.02em;
	}

	.streak-badge {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--accent-primary);
		background: var(--accent-soft);
		padding: 0.15rem 0.55rem;
		border-radius: 10px;
		border: 1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent);
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.4rem 0.875rem;
		background: var(--bg-raised);
		border: 1px solid var(--border-soft);
		border-radius: 8px;
		color: var(--text-secondary);
		font-size: 0.8rem;
		font-family: inherit;
		cursor: pointer;
		transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
		white-space: nowrap;
	}

	.action-btn:hover:not(:disabled) {
		border-color: var(--border-strong);
		color: var(--text-primary);
	}

	.action-btn.primary {
		background: var(--accent-soft);
		border-color: color-mix(in srgb, var(--accent-primary) 30%, transparent);
		color: var(--accent-primary);
	}

	.action-btn.primary:hover:not(:disabled) {
		background: color-mix(in srgb, var(--accent-soft) 80%, var(--bg-raised));
		border-color: var(--accent-primary);
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-icon {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	.fetch-error {
		font-size: 0.8rem;
		color: var(--accent-red);
		margin: 0;
	}

	.fetch-ok {
		font-size: 0.8rem;
		color: var(--accent-green);
		margin: 0;
	}

	/* ── Import panel ───────────────────────────────────────────────────── */
	.import-panel {
		background: var(--bg-surface);
		border: 1px solid var(--border-soft);
		border-radius: 10px;
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.import-label {
		font-size: 0.8rem;
		color: var(--text-secondary);
		margin: 0;
	}

	.import-textarea {
		width: 100%;
		min-height: 120px;
		padding: 0.6rem 0.75rem;
		background: var(--bg-raised);
		border: 1px solid var(--border-soft);
		border-radius: 7px;
		color: var(--text-primary);
		font-family: 'Space Mono', monospace;
		font-size: 0.75rem;
		resize: vertical;
		box-sizing: border-box;
		transition: border-color 0.15s ease;
	}

	.import-textarea:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	.import-actions {
		display: flex;
		gap: 0.5rem;
	}

	.import-error {
		font-size: 0.8rem;
		color: var(--accent-red);
		margin: 0;
	}

	.import-ok {
		font-size: 0.8rem;
		color: var(--accent-green);
		margin: 0;
	}

	.import-ok a {
		color: var(--accent-primary);
		text-decoration: none;
	}

	.import-ok a:hover {
		text-decoration: underline;
	}

	/* ── Stats strip ────────────────────────────────────────────────────── */
	.stats-strip {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.8rem;
	}

	.stat-item {
		display: flex;
		align-items: baseline;
		gap: 0.3rem;
	}

	.stat-value {
		font-size: 1rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.stat-label {
		color: var(--text-muted);
	}

	.stat-sep {
		color: var(--border-strong);
	}

	/* ── Section ────────────────────────────────────────────────────────── */
	.section-label {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.07em;
		margin: 0 0 0.75rem;
	}

	/* ── Daily card ─────────────────────────────────────────────────────── */
	.daily-card {
		display: block;
		background: var(--bg-surface);
		border: 1px solid var(--border-soft);
		border-radius: 12px;
		padding: 1.25rem 1.5rem;
		transition: border-color 0.15s ease, background 0.15s ease;
	}

	.daily-card:hover {
		border-color: var(--border-strong);
		background: var(--bg-raised);
	}

	.daily-title-link {
		color: inherit;
		text-decoration: none;
		transition: color 0.15s ease;
	}

	.daily-title-link:hover {
		color: var(--accent-primary);
	}

	.daily-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.6rem;
		flex-wrap: wrap;
	}

	.daily-date {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.daily-title {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 0.75rem;
		letter-spacing: -0.01em;
	}

	.tag-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-bottom: 1rem;
	}

	.topic-tag {
		font-size: 0.68rem;
		color: var(--text-muted);
		background: var(--bg-raised);
		border: 1px solid var(--border-soft);
		border-radius: 5px;
		padding: 0.1rem 0.45rem;
	}

	.topic-tag.more {
		color: var(--text-subtle);
	}

	.daily-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.open-cta {
		font-size: 0.8rem;
		color: var(--accent-primary);
		font-weight: 500;
		text-decoration: none;
	}

	.open-cta:hover {
		text-decoration: underline;
	}

	.source-link {
		font-size: 0.75rem;
		color: var(--text-muted);
		text-decoration: none;
		transition: color 0.15s ease;
	}

	.source-link:hover {
		color: var(--accent-primary);
	}

	/* ── Difficulty badges ──────────────────────────────────────────────── */
	.difficulty {
		font-size: 0.7rem;
		font-weight: 600;
		padding: 0.1rem 0.5rem;
		border-radius: 6px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.diff-easy {
		color: var(--accent-green);
		background: color-mix(in srgb, var(--accent-green) 12%, transparent);
	}

	.diff-medium {
		color: #b8870a;
		background: color-mix(in srgb, #b8870a 12%, transparent);
	}

	.diff-hard {
		color: var(--accent-red);
		background: color-mix(in srgb, var(--accent-red) 12%, transparent);
	}

	.source-chip {
		font-size: 0.68rem;
		color: var(--text-subtle);
		background: var(--bg-raised);
		border: 1px solid var(--border-soft);
		border-radius: 5px;
		padding: 0.1rem 0.45rem;
		text-transform: capitalize;
	}

	/* ── Empty daily ────────────────────────────────────────────────────── */
	.empty-daily {
		background: var(--bg-surface);
		border: 1px dashed var(--border-soft);
		border-radius: 12px;
		padding: 1.5rem 1.5rem;
	}

	.empty-copy {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin: 0;
	}

	/* ── Recent list ────────────────────────────────────────────────────── */
	.problem-list {
		list-style: none;
		margin: 0;
		padding: 0;
		background: var(--bg-surface);
		border: 1px solid var(--border-soft);
		border-radius: 10px;
		overflow: hidden;
	}

	.problem-row {
		border-bottom: 1px solid var(--border-soft);
	}

	.problem-row:last-child {
		border-bottom: none;
	}

	.problem-row-link {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.65rem 1rem;
		text-decoration: none;
		transition: background 0.12s ease;
		gap: 0.75rem;
	}

	.problem-row-link:hover {
		background: var(--bg-raised);
	}

	.problem-title {
		font-size: 0.82rem;
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.problem-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.difficulty.sm {
		font-size: 0.65rem;
	}

	.status-pill {
		font-size: 0.68rem;
		padding: 0.1rem 0.45rem;
		border-radius: 6px;
		font-weight: 500;
		white-space: nowrap;
	}

	.status-not_started {
		color: var(--text-muted);
		background: var(--bg-raised);
	}

	.status-in_progress {
		color: var(--accent-primary);
		background: var(--accent-soft);
	}

	.status-completed {
		color: var(--accent-green);
		background: color-mix(in srgb, var(--accent-green) 12%, transparent);
	}

	.status-skipped {
		color: var(--text-subtle);
		background: var(--bg-raised);
	}

	.problem-date {
		font-size: 0.7rem;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.problem-date.muted {
		color: var(--text-subtle);
	}
</style>
