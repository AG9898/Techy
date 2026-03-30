<script lang="ts">
	import { tick } from 'svelte';

	interface MatchedNote {
		id: string;
		title: string;
		slug: string;
		url: string;
	}

	interface UserMessage {
		type: 'user';
		query: string;
	}

	interface AssistantMessage {
		type: 'assistant';
		matchedNote: MatchedNote | null;
		summary: string;
		possibleGaps: string[];
		newTopicIdeas: string[];
	}

	type Message = UserMessage | AssistantMessage;

	let composerValue = $state('');
	let isLoading = $state(false);
	let messages = $state<Message[]>([]);
	let conversationEl: HTMLDivElement | undefined;

	async function scrollToBottom() {
		await tick();
		if (conversationEl) conversationEl.scrollTop = conversationEl.scrollHeight;
	}

	async function sendQuery() {
		const query = composerValue.trim();
		if (!query || isLoading) return;

		composerValue = '';
		messages = [...messages, { type: 'user', query }];
		isLoading = true;
		await scrollToBottom();

		try {
			const res = await fetch('/api/assistant/query', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ query })
			});

			if (res.ok) {
				const data = await res.json();
				messages = [
					...messages,
					{
						type: 'assistant',
						matchedNote: data.matchedNote ?? null,
						summary: data.summary ?? '',
						possibleGaps: data.possibleGaps ?? [],
						newTopicIdeas: data.newTopicIdeas ?? []
					}
				];
			} else {
				const err = await res.json().catch(() => ({}));
				const notFound = res.status === 404;
				messages = [
					...messages,
					{
						type: 'assistant',
						matchedNote: null,
						summary: notFound
							? 'No matching note found. Try rephrasing or check the Notes page to see what topics exist.'
							: (err.message ?? 'Something went wrong. Please try again.'),
						possibleGaps: [],
						newTopicIdeas: []
					}
				];
			}
		} catch {
			messages = [
				...messages,
				{
					type: 'assistant',
					matchedNote: null,
					summary: 'Network error. Please try again.',
					possibleGaps: [],
					newTopicIdeas: []
				}
			];
		}

		isLoading = false;
		await scrollToBottom();
	}
</script>

<svelte:head>
	<title>Chat — Techy</title>
</svelte:head>

<div class="chat-shell">
	<div class="conversation-column">
		<div class="conversation-area" bind:this={conversationEl} aria-label="Conversation">
			{#if messages.length === 0}
				{#if isLoading}
					<div class="centered-state">
						<div class="loading-dots">
							<span></span>
							<span></span>
							<span></span>
						</div>
						<p class="loading-label">Thinking…</p>
					</div>
				{:else}
					<div class="centered-state">
						<div class="empty-glyph">◈</div>
						<p class="empty-title">Ask about your notes</p>
						<p class="empty-hint">
							The assistant answers questions grounded in your knowledge graph.
						</p>
					</div>
				{/if}
			{:else}
				<div class="messages-list">
					{#each messages as msg}
						{#if msg.type === 'user'}
							<div class="user-message">
								<p class="user-bubble">{msg.query}</p>
							</div>
						{:else}
							<div class="assistant-message">
								{#if msg.matchedNote}
									<a href={msg.matchedNote.url} class="note-link">
										<span class="note-link-glyph">◈</span>
										{msg.matchedNote.title}
									</a>
								{/if}
								<p class="summary-text">{msg.summary}</p>
								{#if msg.possibleGaps.length > 0}
									<div class="response-section">
										<p class="section-label">Possible additions</p>
										<ul class="gaps-list">
											{#each msg.possibleGaps as gap}
												<li>{gap}</li>
											{/each}
										</ul>
									</div>
								{/if}
								{#if msg.newTopicIdeas.length > 0}
									<div class="response-section">
										<p class="section-label">Explore next</p>
										<div class="topics-chips">
											{#each msg.newTopicIdeas as idea}
												<span class="topic-chip">{idea}</span>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						{/if}
					{/each}
					{#if isLoading}
						<div class="inline-loading">
							<div class="loading-dots">
								<span></span>
								<span></span>
								<span></span>
							</div>
							<p class="loading-label">Thinking…</p>
						</div>
					{/if}
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
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						sendQuery();
					}
				}}
			></textarea>
			<button
				class="send-btn"
				disabled={!composerValue.trim() || isLoading}
				onclick={sendQuery}
			>
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
		flex-direction: column;
		background: var(--bg-surface);
		border: 1px solid var(--border-soft);
		border-radius: 16px;
		overflow-y: auto;
		padding: 1.5rem;
	}

	/* ── Centred placeholder states (empty + first-load) ────────────── */
	.centered-state {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		text-align: center;
		max-width: 320px;
		margin: auto;
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
		margin: 0;
	}

	.empty-hint {
		font-size: 0.85rem;
		color: var(--text-muted);
		line-height: 1.5;
		margin: 0;
	}

	/* ── Messages list ───────────────────────────────────────────────── */
	.messages-list {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		width: 100%;
	}

	/* ── User message ────────────────────────────────────────────────── */
	.user-message {
		display: flex;
		justify-content: flex-end;
	}

	.user-bubble {
		background: var(--bg-raised);
		border: 1px solid var(--border-soft);
		border-radius: 14px 14px 4px 14px;
		padding: 0.6rem 0.9rem;
		font-size: 0.9rem;
		color: var(--text-primary);
		max-width: 80%;
		line-height: 1.5;
		margin: 0;
	}

	/* ── Assistant message ───────────────────────────────────────────── */
	.assistant-message {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 92%;
	}

	.note-link {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		color: var(--accent-primary);
		text-decoration: none;
		font-size: 0.82rem;
		font-weight: 500;
		background: var(--accent-soft);
		border: 1px solid color-mix(in srgb, var(--accent-primary) 22%, transparent);
		border-radius: 6px;
		padding: 0.25rem 0.65rem;
		width: fit-content;
		transition: color 0.15s ease, border-color 0.15s ease;
	}

	.note-link:hover {
		color: var(--accent-strong);
		border-color: color-mix(in srgb, var(--accent-strong) 35%, transparent);
	}

	.note-link-glyph {
		font-size: 0.75rem;
		opacity: 0.7;
	}

	.summary-text {
		font-size: 0.9rem;
		line-height: 1.75;
		color: var(--text-secondary);
		margin: 0;
	}

	/* ── Response sub-sections ───────────────────────────────────────── */
	.response-section {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding-top: 0.25rem;
		border-top: 1px solid var(--border-soft);
	}

	.section-label {
		font-size: 0.68rem;
		font-weight: 500;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--text-muted);
		margin: 0;
	}

	.gaps-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.gaps-list li {
		font-size: 0.85rem;
		color: var(--text-secondary);
		padding-left: 1rem;
		position: relative;
		line-height: 1.5;
	}

	.gaps-list li::before {
		content: '·';
		position: absolute;
		left: 0.25rem;
		color: var(--text-muted);
	}

	.topics-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.topic-chip {
		background: var(--bg-raised);
		border: 1px solid var(--border-soft);
		border-radius: 999px;
		padding: 0.2rem 0.65rem;
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	/* ── Loading states ──────────────────────────────────────────────── */
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
		margin: 0;
	}

	.inline-loading {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.25rem 0;
	}

	/* ── Composer ────────────────────────────────────────────────────── */
	.composer-wrap {
		display: flex;
		gap: 0.625rem;
		align-items: flex-end;
		flex-shrink: 0;
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
		font-family: inherit;
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
