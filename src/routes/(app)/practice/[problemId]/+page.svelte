<script lang="ts">
	import type { PageData } from './$types.js';
	import { marked } from 'marked';
	import type { PracticeProblem } from '$lib/server/db/schema.js';

	let { data }: { data: PageData } = $props();

	type ProgressStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';
	type HintLevel = 'nudge' | 'pattern' | 'approach' | 'review';
	type TutorTurn = { role: 'user' | 'tutor'; content: string };

	const statusOptions: { value: ProgressStatus; label: string }[] = [
		{ value: 'not_started', label: 'Not started' },
		{ value: 'in_progress', label: 'In progress' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'skipped', label: 'Skipped' }
	];

	const hintLevelOptions: { value: HintLevel; label: string; desc: string }[] = [
		{ value: 'nudge', label: 'Nudge', desc: 'A small nudge to get unstuck' },
		{ value: 'pattern', label: 'Pattern', desc: 'Identify the algorithmic pattern' },
		{ value: 'approach', label: 'Approach', desc: 'Walk through the approach' },
		{ value: 'review', label: 'Review', desc: 'Review my code' }
	];

	const difficultyClass: Record<string, string> = {
		Easy: 'diff-easy',
		Medium: 'diff-medium',
		Hard: 'diff-hard'
	};

	// Progress state — local mirror of server data
	// Initialized via closure to avoid Svelte 5 state_referenced_locally warning
	let status = $state<ProgressStatus>((() => data.progress.status)());
	let attempts = $state((() => data.progress.attempts)());
	let notes = $state((() => data.progress.notes)());
	let codeSnapshot = $state((() => data.progress.codeSnapshot ?? '')());

	let progressSaving = $state(false);
	let progressSaved = $state(false);
	let progressError = $state('');

	// Tutor state — client-local only
	let tutorTurns = $state<TutorTurn[]>([]);
	let tutorMessage = $state('');
	let hintLevel = $state<HintLevel>('nudge');
	let tutorLoading = $state(false);
	let tutorError = $state('');

	// Rendered markdown (derived)
	const problemHtml = $derived(marked.parse(data.problem.promptMarkdown ?? '') as string);

	function formatDate(dateStr: string | null | undefined): string {
		if (!dateStr) return '';
		const d = new Date(String(dateStr) + 'T00:00:00');
		return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	// ── Save progress ────────────────────────────────────────────────────────────

	async function saveProgress() {
		progressSaving = true;
		progressSaved = false;
		progressError = '';
		try {
			const res = await fetch('/api/practice/progress', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					problemId: data.problem.id,
					status,
					attempts,
					notes,
					codeSnapshot: codeSnapshot || null
				})
			});
			if (!res.ok) {
				const body = (await res.json()) as { error?: string; errors?: { message: string }[] };
				if ('errors' in body && body.errors) {
					progressError = body.errors.map((e) => e.message).join('; ');
				} else {
					progressError = ('error' in body ? body.error : null) ?? 'Save failed.';
				}
			} else {
				progressSaved = true;
				setTimeout(() => {
					progressSaved = false;
				}, 2000);
			}
		} catch {
			progressError = 'Network error saving progress.';
		} finally {
			progressSaving = false;
		}
	}

	// ── Tutor ────────────────────────────────────────────────────────────────────

	async function askTutor() {
		const msg = tutorMessage.trim();
		if (!msg) return;

		tutorTurns = [...tutorTurns, { role: 'user', content: msg }];
		tutorMessage = '';
		tutorLoading = true;
		tutorError = '';

		try {
			const res = await fetch('/api/practice/tutor', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					problemId: data.problem.id,
					message: msg,
					code: codeSnapshot || undefined,
					hintLevel
				})
			});
			const body = (await res.json()) as { reply?: string; error?: string };
			if (!res.ok || !body.reply) {
				tutorError = body.error ?? 'Tutor request failed.';
				tutorTurns = tutorTurns.slice(0, -1);
			} else {
				tutorTurns = [...tutorTurns, { role: 'tutor', content: body.reply }];
			}
		} catch {
			tutorError = 'Network error reaching tutor.';
			tutorTurns = tutorTurns.slice(0, -1);
		} finally {
			tutorLoading = false;
		}
	}

	function handleTutorKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			void askTutor();
		}
	}

	function clearTutor() {
		tutorTurns = [];
		tutorError = '';
	}
</script>

<div class="workspace">
	<!-- ── Workspace header ──────────────────────────────────────────────── -->
	<header class="ws-header">
		<div class="ws-back-row">
			<a class="back-link" href="/practice">← Practice</a>
		</div>
		<div class="ws-title-row">
			<h1 class="ws-title">{data.problem.title}</h1>
			<div class="ws-meta">
				{#if data.problem.dailyDate}
					<span class="meta-chip">{formatDate(String(data.problem.dailyDate))}</span>
				{/if}
				{#if data.problem.difficulty}
					<span class="difficulty {difficultyClass[data.problem.difficulty] ?? ''}"
						>{data.problem.difficulty}</span
					>
				{/if}
				<span class="meta-chip source">{data.problem.source}</span>
				{#if data.problem.sourceUrl}
					<a
						class="source-link"
						href={data.problem.sourceUrl}
						target="_blank"
						rel="noopener noreferrer"
					>
						Solve on {data.problem.source} ↗
					</a>
				{/if}
			</div>
		</div>
		{#if data.problem.topicTags && data.problem.topicTags.length > 0}
			<div class="tag-row">
				{#each data.problem.topicTags as tag}
					<span class="topic-tag">{tag}</span>
				{/each}
			</div>
		{/if}
	</header>

	<!-- ── Two-column workspace ──────────────────────────────────────────── -->
	<div class="ws-body">
		<!-- Left: problem content -->
		<div class="problem-col">
			<!-- Problem statement -->
			<section class="ws-section">
				<h2 class="section-label">Problem</h2>
				<div class="problem-md prose">
					{@html problemHtml}
				</div>
			</section>

			<!-- Tutor -->
			<section class="ws-section tutor-section">
				<div class="tutor-header">
					<h2 class="section-label">Tutor</h2>
					<span class="tutor-note">Session only · not saved</span>
					{#if tutorTurns.length > 0}
						<button class="clear-btn" type="button" onclick={clearTutor}>Clear</button>
					{/if}
				</div>

				<!-- Hint level selector -->
				<div class="hint-row">
					{#each hintLevelOptions as opt}
						<button
							class="hint-btn"
							class:active={hintLevel === opt.value}
							type="button"
							title={opt.desc}
							onclick={() => (hintLevel = opt.value)}
						>
							{opt.label}
						</button>
					{/each}
				</div>

				<!-- Transcript -->
				{#if tutorTurns.length > 0}
					<div class="tutor-transcript" aria-live="polite">
						{#each tutorTurns as turn}
							<div class="tutor-turn turn-{turn.role}">
								<span class="turn-role">{turn.role === 'user' ? 'You' : 'Tutor'}</span>
								<p class="turn-content">{turn.content}</p>
							</div>
						{/each}
						{#if tutorLoading}
							<div class="tutor-turn turn-tutor loading">
								<span class="turn-role">Tutor</span>
								<span class="thinking-dots">···</span>
							</div>
						{/if}
					</div>
				{/if}

				{#if tutorError}
					<p class="tutor-error">{tutorError}</p>
				{/if}

				<!-- Tutor input -->
				<div class="tutor-input-row">
					<textarea
						class="tutor-input"
						rows={3}
						placeholder="Ask a question… (Ctrl+Enter to send)"
						bind:value={tutorMessage}
						onkeydown={handleTutorKeydown}
						disabled={tutorLoading}
					></textarea>
					<button
						class="send-btn"
						type="button"
						onclick={askTutor}
						disabled={tutorLoading || !tutorMessage.trim()}
					>
						Ask
					</button>
				</div>
			</section>
		</div>

		<!-- Right: progress + notes + code -->
		<div class="progress-col">
			<!-- Progress controls -->
			<section class="ws-section">
				<h2 class="section-label">Progress</h2>

				<div class="progress-form">
					<div class="field-row">
						<label class="field-label" for="status-select">Status</label>
						<select id="status-select" class="field-select" bind:value={status}>
							{#each statusOptions as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>

					<div class="field-row">
						<label class="field-label" for="attempts-input">Attempts</label>
						<input
							id="attempts-input"
							class="field-input narrow"
							type="number"
							min={0}
							step={1}
							bind:value={attempts}
						/>
					</div>

					<div class="save-row">
						<button
							class="action-btn primary"
							type="button"
							onclick={saveProgress}
							disabled={progressSaving}
						>
							{progressSaving ? 'Saving…' : 'Save progress'}
						</button>
						{#if progressSaved}
							<span class="save-ok">Saved</span>
						{/if}
						{#if progressError}
							<span class="save-error">{progressError}</span>
						{/if}
					</div>
				</div>
			</section>

			<!-- Notes -->
			<section class="ws-section">
				<h2 class="section-label">Notes</h2>
				<textarea
					class="notes-area"
					rows={6}
					placeholder="Your approach notes, edge cases, observations…"
					bind:value={notes}
				></textarea>
			</section>

			<!-- Code snapshot -->
			<section class="ws-section">
				<h2 class="section-label">Code snapshot</h2>
				<textarea
					class="code-area"
					rows={10}
					placeholder="Paste your current solution attempt here…"
					bind:value={codeSnapshot}
				></textarea>
				<p class="code-note">
					Code is saved with progress. Paste here for tutor context, then submit on {data.problem.source}.
				</p>
			</section>
		</div>
	</div>
</div>

<style>
	.workspace {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	/* ── Header ─────────────────────────────────────────────────────────── */
	.ws-header {
		padding: 1.25rem 2rem 1rem;
		border-bottom: 1px solid var(--border-soft);
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.ws-back-row {
		margin-bottom: 0.125rem;
	}

	.back-link {
		font-size: 0.75rem;
		color: var(--text-muted);
		text-decoration: none;
		transition: color 0.15s ease;
	}

	.back-link:hover {
		color: var(--accent-primary);
	}

	.ws-title-row {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.ws-title {
		font-size: 1.15rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
		letter-spacing: -0.02em;
		flex: 1;
		min-width: 0;
	}

	.ws-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
		flex-wrap: wrap;
	}

	.meta-chip {
		font-size: 0.7rem;
		color: var(--text-muted);
		background: var(--bg-raised);
		border: 1px solid var(--border-soft);
		border-radius: 5px;
		padding: 0.1rem 0.45rem;
	}

	.meta-chip.source {
		text-transform: capitalize;
	}

	.source-link {
		font-size: 0.75rem;
		color: var(--accent-primary);
		text-decoration: none;
		white-space: nowrap;
		transition: opacity 0.15s ease;
	}

	.source-link:hover {
		opacity: 0.8;
	}

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

	.tag-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.topic-tag {
		font-size: 0.67rem;
		color: var(--text-muted);
		background: var(--bg-raised);
		border: 1px solid var(--border-soft);
		border-radius: 5px;
		padding: 0.08rem 0.4rem;
	}

	/* ── Body layout ────────────────────────────────────────────────────── */
	.ws-body {
		display: grid;
		grid-template-columns: 1fr 320px;
		gap: 0;
		flex: 1;
		overflow: hidden;
	}

	.problem-col {
		overflow-y: auto;
		padding: 1.5rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 2rem;
		border-right: 1px solid var(--border-soft);
	}

	.progress-col {
		overflow-y: auto;
		padding: 1.5rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	/* ── Section ────────────────────────────────────────────────────────── */
	.ws-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.section-label {
		font-size: 0.68rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.07em;
		margin: 0;
	}

	/* ── Problem markdown ───────────────────────────────────────────────── */
	.problem-md {
		font-size: 0.875rem;
		line-height: 1.7;
		color: var(--text-secondary);
	}

	:global(.problem-md h1),
	:global(.problem-md h2),
	:global(.problem-md h3) {
		color: var(--text-primary);
		font-weight: 600;
		margin: 1em 0 0.4em;
	}

	:global(.problem-md p) {
		margin: 0 0 0.75em;
	}

	:global(.problem-md pre) {
		background: var(--bg-raised);
		border: 1px solid var(--border-soft);
		border-radius: 7px;
		padding: 0.75rem 1rem;
		overflow-x: auto;
		font-size: 0.8rem;
		margin: 0.75em 0;
	}

	:global(.problem-md code) {
		font-family: 'Space Mono', monospace;
		font-size: 0.82em;
		background: var(--bg-raised);
		padding: 0.1em 0.35em;
		border-radius: 4px;
	}

	:global(.problem-md pre code) {
		background: none;
		padding: 0;
	}

	:global(.problem-md ul),
	:global(.problem-md ol) {
		padding-left: 1.5em;
		margin: 0 0 0.75em;
	}

	:global(.problem-md li) {
		margin-bottom: 0.3em;
	}

	:global(.problem-md strong) {
		color: var(--text-primary);
		font-weight: 600;
	}

	/* ── Tutor ──────────────────────────────────────────────────────────── */
	.tutor-section {
		flex: 1;
	}

	.tutor-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.tutor-note {
		font-size: 0.68rem;
		color: var(--text-subtle);
	}

	.clear-btn {
		margin-left: auto;
		font-size: 0.72rem;
		color: var(--text-muted);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.1rem 0.3rem;
		font-family: inherit;
		transition: color 0.15s ease;
	}

	.clear-btn:hover {
		color: var(--accent-red);
	}

	.hint-row {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.hint-btn {
		font-size: 0.72rem;
		font-family: inherit;
		padding: 0.25rem 0.65rem;
		border-radius: 6px;
		border: 1px solid var(--border-soft);
		background: var(--bg-raised);
		color: var(--text-secondary);
		cursor: pointer;
		transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
	}

	.hint-btn:hover {
		border-color: var(--border-strong);
		color: var(--text-primary);
	}

	.hint-btn.active {
		border-color: var(--accent-primary);
		background: var(--accent-soft);
		color: var(--accent-primary);
	}

	.tutor-transcript {
		background: var(--bg-surface);
		border: 1px solid var(--border-soft);
		border-radius: 10px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-height: 320px;
		overflow-y: auto;
	}

	.tutor-turn {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.turn-role {
		font-size: 0.68rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
	}

	.turn-user .turn-role {
		color: var(--accent-primary);
	}

	.turn-tutor .turn-role {
		color: var(--text-muted);
	}

	.turn-content {
		font-size: 0.82rem;
		color: var(--text-secondary);
		line-height: 1.55;
		margin: 0;
		white-space: pre-wrap;
	}

	.tutor-turn.loading .thinking-dots {
		font-size: 1rem;
		color: var(--text-muted);
		letter-spacing: 0.15em;
	}

	.tutor-error {
		font-size: 0.78rem;
		color: var(--accent-red);
		margin: 0;
	}

	.tutor-input-row {
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
	}

	.tutor-input {
		flex: 1;
		padding: 0.55rem 0.75rem;
		background: var(--bg-raised);
		border: 1px solid var(--border-soft);
		border-radius: 8px;
		color: var(--text-primary);
		font-family: 'Space Mono', monospace;
		font-size: 0.8rem;
		resize: none;
		transition: border-color 0.15s ease;
	}

	.tutor-input:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	.send-btn {
		padding: 0.5rem 1rem;
		background: var(--accent-soft);
		border: 1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent);
		border-radius: 8px;
		color: var(--accent-primary);
		font-size: 0.8rem;
		font-family: inherit;
		cursor: pointer;
		white-space: nowrap;
		transition: opacity 0.15s ease, background 0.15s ease;
		flex-shrink: 0;
	}

	.send-btn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--accent-soft) 80%, var(--bg-raised));
	}

	.send-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	/* ── Progress form ──────────────────────────────────────────────────── */
	.progress-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.field-row {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.field-label {
		font-size: 0.72rem;
		color: var(--text-muted);
		font-weight: 500;
	}

	.field-select,
	.field-input {
		padding: 0.45rem 0.65rem;
		background: var(--bg-raised);
		border: 1px solid var(--border-soft);
		border-radius: 7px;
		color: var(--text-primary);
		font-family: 'Space Mono', monospace;
		font-size: 0.8rem;
		transition: border-color 0.15s ease;
	}

	.field-select:focus,
	.field-input:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	.field-input.narrow {
		max-width: 80px;
	}

	.save-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
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

	.save-ok {
		font-size: 0.78rem;
		color: var(--accent-green);
	}

	.save-error {
		font-size: 0.78rem;
		color: var(--accent-red);
	}

	/* ── Notes / code areas ─────────────────────────────────────────────── */
	.notes-area,
	.code-area {
		width: 100%;
		padding: 0.6rem 0.75rem;
		background: var(--bg-raised);
		border: 1px solid var(--border-soft);
		border-radius: 8px;
		color: var(--text-primary);
		font-family: 'Space Mono', monospace;
		font-size: 0.78rem;
		line-height: 1.55;
		resize: vertical;
		box-sizing: border-box;
		transition: border-color 0.15s ease;
	}

	.notes-area:focus,
	.code-area:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	.code-note {
		font-size: 0.7rem;
		color: var(--text-subtle);
		margin: 0;
	}

	/* ── Responsive ─────────────────────────────────────────────────────── */
	@media (max-width: 900px) {
		.ws-body {
			grid-template-columns: 1fr;
			overflow-y: auto;
		}

		.problem-col {
			border-right: none;
			border-bottom: 1px solid var(--border-soft);
			overflow-y: visible;
		}

		.progress-col {
			overflow-y: visible;
		}
	}
</style>
