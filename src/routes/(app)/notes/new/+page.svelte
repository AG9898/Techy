<script lang="ts">
	import type { ActionData } from './$types.js';

	let { form }: { form: ActionData } = $props();

	let titleValue = $state('');
	let bodyValue = $state('');
	let aiLoading = $state(false);
	let aiError = $state<string | null>(null);
	let aiGenerated = $state(false);
	let aiModel = $state('');
	let aiPrompt = $state('');

	async function researchWithAI() {
		if (!titleValue.trim() || aiLoading) return;
		aiLoading = true;
		aiError = null;
		try {
			const res = await fetch('/api/ai/research', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ topic: titleValue.trim() })
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

<div class="authoring-page">
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
					<input type="text" name="tags" placeholder="svelte, javascript, frontend" />
				</label>

				<label>
					<span class="field-label">Aliases <span class="hint">(comma-separated)</span></span>
					<input type="text" name="aliases" placeholder="SvelteKit, SK" />
				</label>
			</div>
		</div>

		<div class="fields-body">
			<label class="body-label">
				<span class="field-label">Body <span class="hint">(Markdown · [[Note Title]] for wikilinks)</span></span>
				<!-- AI-assist toolbar and markdown preview will slot in here -->
				<textarea
					name="body"
					rows="18"
					placeholder="# SvelteKit&#10;&#10;SvelteKit is a framework for [[Svelte]]..."
					bind:value={bodyValue}
				></textarea>
			</label>
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

	.fields-body {
		padding: 1.5rem;
		border-bottom: 1px solid var(--border-soft);
	}

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

	.body-label {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
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
