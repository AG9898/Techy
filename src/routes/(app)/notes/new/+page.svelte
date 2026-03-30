<script lang="ts">
	import type { PageData, ActionData } from './$types.js';
	import { marked } from 'marked';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let titleValue = $state('');
	let bodyValue = $state('');
	let aiLoading = $state(false);
	let aiError = $state<string | null>(null);
	let aiGenerated = $state(false);
	let aiModel = $state('');
	let aiPrompt = $state('');
	let aiProvider = $state<'claude' | 'chatgpt'>('claude');
	let showPreview = $state(false);
	let tagsValue = $state('');

	const tagOptions = $derived.by(() => {
		const parts = tagsValue.split(',');
		const token = parts[parts.length - 1].trimStart();
		const prefix = parts.length > 1 ? parts.slice(0, -1).join(',') + ', ' : '';
		const done = parts.slice(0, -1).map((t) => t.trim()).filter(Boolean);
		return data.existingTags
			.filter((t) => t.toLowerCase().includes(token.toLowerCase()) && !done.includes(t))
			.map((t) => prefix + t);
	});

	const noteTitlesSet = $derived(new Set(data.noteTitles));
	const previewHtml = $derived(renderPreview(bodyValue, noteTitlesSet));

	function renderPreview(body: string, knownTitles: Set<string>): string {
		const preprocessed = body.replace(/\[\[([^\]]+)\]\]/g, (_, title) => {
			const cls = knownTitles.has(title) ? 'wikilink' : 'wikilink-broken';
			return `<span class="${cls}">${title}</span>`;
		});
		return marked.parse(preprocessed) as string;
	}

	async function researchWithAI() {
		if (!titleValue.trim() || aiLoading) return;
		aiLoading = true;
		aiError = null;
		try {
			const res = await fetch('/api/ai/research', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ topic: titleValue.trim(), provider: aiProvider })
			});
			const data = await res.json();
			if (!res.ok) {
				aiError = data.error ?? 'AI research failed';
				return;
			}
			bodyValue = data.body;
			aiGenerated = true;
			aiModel = data.model ?? 'claude-opus-4-6';
			aiPrompt = titleValue.trim();
		} catch {
			aiError = 'Network error — could not reach AI service';
		} finally {
			aiLoading = false;
		}
	}
</script>

<div class="authoring-page" class:preview-open={showPreview}>
	<div class="authoring-header">
		<a href="/notes" class="back-link">← Notes</a>
		<h1>New Note</h1>
	</div>

	{#if form?.error}
		<p class="error-banner">{form.error}</p>
	{/if}

	<form method="POST" class="authoring-form">
		<input type="hidden" name="ai_generated" value={aiGenerated ? 'true' : 'false'} />
		<input type="hidden" name="ai_model" value={aiModel} />
		<input type="hidden" name="ai_prompt" value={aiPrompt} />

		<div class="fields-meta">
			<label>
				<span class="field-label">Title <span class="required">*</span></span>
				<div class="title-row">
					<input
						type="text"
						name="title"
						required
						placeholder="e.g. SvelteKit"
						bind:value={titleValue}
					/>
					<select class="provider-select" bind:value={aiProvider} disabled={aiLoading}>
						<option value="claude">Claude</option>
						<option value="chatgpt">ChatGPT</option>
					</select>
					<button
						type="button"
						class="btn-ai"
						onclick={researchWithAI}
						disabled={!titleValue.trim() || aiLoading}
					>
						{#if aiLoading}
							<span class="spinner"></span>
							Researching…
						{:else}
							✦ Research with AI
						{/if}
					</button>
				</div>
			</label>

			{#if aiError}
				<p class="ai-error">{aiError}</p>
			{/if}

			<div class="fields-row">
				<label>
					<span class="field-label">Category</span>
					<input type="text" name="category" placeholder="e.g. Web Frameworks" />
				</label>

				<label>
					<span class="field-label">Status</span>
					<select name="status">
						<option value="stub">Stub</option>
						<option value="growing">Growing</option>
						<option value="mature">Mature</option>
					</select>
				</label>
			</div>

			<div class="fields-row">
				<label>
					<span class="field-label">Tags <span class="hint">(comma-separated)</span></span>
					<input
						type="text"
						name="tags"
						placeholder="svelte, javascript, frontend"
						list="tags-suggestions"
						bind:value={tagsValue}
					/>
				</label>
				<datalist id="tags-suggestions">
					{#each tagOptions as option}
						<option value={option}></option>
					{/each}
				</datalist>

				<label>
					<span class="field-label">Aliases <span class="hint">(comma-separated)</span></span>
					<input type="text" name="aliases" placeholder="SvelteKit, SK" />
				</label>
			</div>
		</div>

		<div class="fields-body">
			<div class="body-header">
				<span class="field-label">Body <span class="hint">(Markdown · [[Note Title]] for wikilinks)</span></span>
				<button type="button" class="btn-preview" onclick={() => (showPreview = !showPreview)}>
					{showPreview ? 'Hide Preview' : 'Preview'}
				</button>
			</div>
			<div class="body-split">
				<textarea
					name="body"
					rows="18"
					placeholder="# SvelteKit&#10;&#10;SvelteKit is a framework for [[Svelte]]..."
					bind:value={bodyValue}
				></textarea>
				{#if showPreview}
					<div class="preview-pane">
						{#if bodyValue.trim()}
							{@html previewHtml}
						{:else}
							<span class="preview-empty">Nothing to preview yet…</span>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<div class="form-actions">
			<a href="/notes" class="btn-cancel">Cancel</a>
			<button type="submit" class="btn-save">Create Note</button>
		</div>
	</form>
</div>

<style>
	.authoring-page {
		max-width: 720px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		transition: max-width 200ms ease;
	}

	.authoring-page.preview-open {
		max-width: 1400px;
	}

	.authoring-header {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.back-link {
		font-size: 0.85rem;
		color: var(--text-muted);
		text-decoration: none;
		transition: color 150ms ease;
	}

	.back-link:hover {
		color: var(--text-secondary);
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
		letter-spacing: -0.01em;
	}

	.error-banner {
		padding: 0.75rem 1rem;
		background: color-mix(in srgb, var(--accent-red) 15%, var(--bg-surface));
		color: var(--accent-red);
		border: 1px solid color-mix(in srgb, var(--accent-red) 30%, transparent);
		border-radius: 8px;
		font-size: 0.9rem;
	}

	.authoring-form {
		display: flex;
		flex-direction: column;
		gap: 0;
		background: var(--bg-surface);
		border: 1px solid var(--border-soft);
		border-radius: 12px;
		overflow: hidden;
	}

	.fields-meta {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.5rem;
		border-bottom: 1px solid var(--border-soft);
	}

	.fields-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.title-row {
		display: flex;
		gap: 0.6rem;
		align-items: stretch;
	}

	.title-row input {
		flex: 1;
		min-width: 0;
	}

	.provider-select {
		width: auto;
		padding: 0.55rem 0.65rem;
		font-size: 0.82rem;
		flex-shrink: 0;
		cursor: pointer;
	}

	.provider-select:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.fields-body {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1.5rem;
		border-bottom: 1px solid var(--border-soft);
	}

	.body-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.body-split {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.authoring-page.preview-open .body-split {
		flex-direction: row;
		gap: 1rem;
		align-items: flex-start;
	}

	.authoring-page.preview-open .body-split textarea {
		flex: 1;
		min-width: 0;
	}

	.preview-pane {
		flex: 1;
		min-width: 0;
		min-height: 18lh;
		overflow-y: auto;
		background: var(--bg-raised);
		border: 1px solid var(--border-soft);
		border-radius: 8px;
		padding: 0.75rem 1rem;
		font-size: 0.9rem;
		line-height: 1.75;
		color: var(--text-secondary);
	}

	.preview-empty {
		color: var(--text-muted);
		font-size: 0.85rem;
		font-style: italic;
	}

	.preview-pane :global(h1) { font-size: 1.3rem; font-weight: 700; color: var(--text-primary); margin: 0.75rem 0 0.4rem; }
	.preview-pane :global(h2) { font-size: 1.05rem; font-weight: 600; color: var(--text-primary); margin: 0.6rem 0 0.3rem; }
	.preview-pane :global(h3) { font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin: 0.5rem 0 0.25rem; }
	.preview-pane :global(p) { margin: 0.4rem 0; }
	.preview-pane :global(ul),
	.preview-pane :global(ol) { padding-left: 1.25rem; margin: 0.4rem 0; }
	.preview-pane :global(li) { margin: 0.2rem 0; }
	.preview-pane :global(code) {
		background: var(--bg-overlay);
		border-radius: 3px;
		padding: 0.1em 0.3em;
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 0.85em;
	}
	.preview-pane :global(pre) {
		background: var(--bg-overlay);
		border-radius: 6px;
		padding: 0.75rem;
		overflow-x: auto;
		margin: 0.5rem 0;
	}
	.preview-pane :global(pre code) { background: none; padding: 0; }
	.preview-pane :global(blockquote) {
		border-left: 3px solid var(--border-strong);
		padding-left: 0.75rem;
		color: var(--text-muted);
		margin: 0.4rem 0;
	}
	.preview-pane :global(a) { color: var(--accent-primary); text-decoration: underline; }
	.preview-pane :global(hr) { border: none; border-top: 1px solid var(--border-soft); margin: 0.75rem 0; }
	.preview-pane :global(.wikilink) { color: var(--accent-green-muted); }
	.preview-pane :global(.wikilink-broken) { color: var(--accent-red); text-decoration: line-through; }

	label {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.field-label {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text-secondary);
		letter-spacing: 0.01em;
	}

	.required {
		color: var(--accent-red);
	}

	.hint {
		color: var(--text-subtle);
		font-size: 0.75rem;
		font-weight: 400;
	}

	input,
	select,
	textarea {
		background: var(--bg-raised);
		border: 1px solid var(--border-soft);
		color: var(--text-primary);
		border-radius: 8px;
		padding: 0.55rem 0.75rem;
		font-size: 0.9rem;
		font-family: inherit;
		width: 100%;
		transition: border-color 150ms ease, box-shadow 150ms ease;
	}

	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: var(--accent-strong);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-strong) 18%, transparent);
	}

	select {
		cursor: pointer;
	}

	textarea {
		resize: vertical;
		font-family: var(--font-mono, 'Fira Code', 'Cascadia Code', monospace);
		font-size: 0.85rem;
		line-height: 1.65;
	}

	.form-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		align-items: center;
		padding: 1rem 1.5rem;
	}

	.btn-cancel {
		padding: 0.5rem 1.1rem;
		color: var(--text-muted);
		text-decoration: none;
		font-size: 0.9rem;
		border-radius: 8px;
		transition: color 150ms ease, background 150ms ease;
	}

	.btn-cancel:hover {
		color: var(--text-secondary);
		background: var(--bg-raised);
	}

	.btn-save {
		padding: 0.5rem 1.25rem;
		background: var(--accent-strong);
		color: #fff;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 500;
		transition: opacity 150ms ease;
	}

	.btn-save:hover {
		opacity: 0.88;
	}

	.btn-preview {
		padding: 0.3rem 0.75rem;
		background: var(--bg-raised);
		color: var(--text-muted);
		border: 1px solid var(--border-soft);
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.75rem;
		font-weight: 500;
		transition: color 150ms ease, border-color 150ms ease, background 150ms ease;
	}

	.btn-preview:hover {
		color: var(--text-secondary);
		border-color: var(--border-strong);
		background: var(--bg-overlay);
	}

	.btn-ai {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.55rem 1rem;
		background: color-mix(in srgb, var(--accent-purple) 14%, var(--bg-raised));
		color: var(--accent-purple);
		border: 1px solid color-mix(in srgb, var(--accent-purple) 30%, transparent);
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 500;
		white-space: nowrap;
		transition: opacity 150ms ease, background 150ms ease;
		flex-shrink: 0;
	}

	.btn-ai:hover:not(:disabled) {
		background: color-mix(in srgb, var(--accent-purple) 22%, var(--bg-raised));
	}

	.btn-ai:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.ai-error {
		padding: 0.6rem 0.9rem;
		background: color-mix(in srgb, var(--accent-red) 12%, var(--bg-surface));
		color: var(--accent-red);
		border: 1px solid color-mix(in srgb, var(--accent-red) 25%, transparent);
		border-radius: 8px;
		font-size: 0.85rem;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.spinner {
		display: inline-block;
		width: 11px;
		height: 11px;
		border: 2px solid color-mix(in srgb, var(--accent-purple) 35%, transparent);
		border-top-color: var(--accent-purple);
		border-radius: 50%;
		animation: spin 600ms linear infinite;
		flex-shrink: 0;
	}
</style>
