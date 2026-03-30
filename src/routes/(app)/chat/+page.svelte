<script lang="ts">
	let composerValue = $state('');
	let isLoading = $state(false);
</script>

<svelte:head>
	<title>Chat — Techy</title>
</svelte:head>

<div class="chat-shell">
	<div class="conversation-column">
		<div class="conversation-area" aria-label="Conversation">
			{#if isLoading}
				<div class="loading-state">
					<div class="loading-dots">
						<span></span>
						<span></span>
						<span></span>
					</div>
					<p class="loading-label">Thinking…</p>
				</div>
			{:else}
				<div class="empty-state">
					<div class="empty-glyph">◈</div>
					<p class="empty-title">Ask about your notes</p>
					<p class="empty-hint">
						The assistant answers questions grounded in your knowledge graph.
					</p>
				</div>
			{/if}
		</div>

		<div class="composer-wrap">
			<textarea
				class="composer-input"
				placeholder="Ask about your notes…"
				rows="2"
				disabled={isLoading}
				bind:value={composerValue}
				onkeydown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) e.preventDefault();
				}}
			></textarea>
			<button class="send-btn" disabled={!composerValue.trim() || isLoading}>
				Send
			</button>
		</div>
	</div>
</div>

<style>
	/* ── Page shell fills the viewport below nav + page-content padding ── */
	.chat-shell {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 60px - 4rem);
		min-height: 400px;
	}

	/* ── Conversation column — centred, fills shell ─────────────────── */
	.conversation-column {
		display: flex;
		flex-direction: column;
		flex: 1;
		max-width: 720px;
		width: 100%;
		margin: 0 auto;
		gap: 0.75rem;
		overflow: hidden;
	}

	/* ── Primary conversation surface ───────────────────────────────── */
	.conversation-area {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-surface);
		border: 1px solid var(--border-soft);
		border-radius: 16px;
		overflow-y: auto;
		padding: 2rem;
	}

	/* ── Empty state ─────────────────────────────────────────────────── */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		text-align: center;
		max-width: 320px;
	}

	.empty-glyph {
		font-size: 2rem;
		color: var(--text-muted);
		line-height: 1;
		margin-bottom: 0.25rem;
	}

	.empty-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.empty-hint {
		font-size: 0.85rem;
		color: var(--text-muted);
		line-height: 1.5;
	}

	/* ── Loading state ───────────────────────────────────────────────── */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.loading-dots {
		display: flex;
		gap: 0.35rem;
	}

	.loading-dots span {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--text-muted);
		animation: pulse 1.2s ease-in-out infinite;
	}

	.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
	.loading-dots span:nth-child(3) { animation-delay: 0.4s; }

	@keyframes pulse {
		0%, 80%, 100% { opacity: 0.3; transform: scale(0.9); }
		40%            { opacity: 1;   transform: scale(1.1); }
	}

	.loading-label {
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	/* ── Composer ────────────────────────────────────────────────────── */
	.composer-wrap {
		display: flex;
		gap: 0.625rem;
		align-items: flex-end;
		background: var(--bg-surface);
		border: 1px solid var(--border-soft);
		border-radius: 14px;
		padding: 0.625rem 0.75rem;
		transition: border-color 0.15s ease;
	}

	.composer-wrap:focus-within {
		border-color: var(--border-strong);
	}

	.composer-input {
		flex: 1;
		background: none;
		border: none;
		outline: none;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: 0.9rem;
		line-height: 1.5;
		resize: none;
		padding: 0.25rem 0;
	}

	.composer-input::placeholder {
		color: var(--text-muted);
	}

	.composer-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.send-btn {
		flex-shrink: 0;
		background: var(--accent-strong);
		color: #fff;
		border: none;
		border-radius: 9999px;
		padding: 0.35rem 0.9rem;
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		transition: opacity 0.15s ease;
	}

	.send-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.send-btn:not(:disabled):hover {
		opacity: 0.85;
	}
</style>
