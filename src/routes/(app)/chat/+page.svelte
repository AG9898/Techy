<script lang="ts">
	import { tick } from 'svelte';
	import type { PageData } from './$types.js';

	const { data }: { data: PageData } = $props();
	// Extract initial values before $state to avoid Svelte 5 prop-capture warnings
	const initProvider = data.defaultProvider;
	const initModel = data.defaultModel;

	interface NoteDraft {
		title: string;
		body: string;
		tags: string[];
		aliases: string[];
		category: string;
		status: string;
		aiGenerated?: boolean;
		aiModel?: string;
		aiPrompt?: string;
	}

	interface LinkedNotePatch {
		noteId: string;
		title?: string;
		updatedBody: string;
	}

	interface NoteProposal {
		type: 'create_note' | 'update_note' | 'delete_note';
		draft?: NoteDraft;
		noteId?: string;
		noteTitle?: string;
		linkedNotePatches?: LinkedNotePatch[];
	}

	interface CommitResultNote {
		id: string;
		slug: string;
		title: string;
	}

	interface CommitState {
		status: 'pending' | 'done' | 'error';
		note?: CommitResultNote;
		noteId?: string;
		error?: string;
	}

	interface UserDisplayMessage {
		type: 'user';
		content: string;
	}

	interface Citation {
		title: string;
		url: string;
	}

	interface AssistantDisplayMessage {
		type: 'assistant';
		content: string;
		citations: Citation[];
		proposal: NoteProposal | null;
	}

	type DisplayMessage = UserDisplayMessage | AssistantDisplayMessage;

	let composerValue = $state('');
	let isLoading = $state(false);
	let displayMessages = $state<DisplayMessage[]>([]);
	let conversationHistory = $state<{ role: 'user' | 'assistant'; content: string }[]>([]);
	let topicCache = $state<Record<string, unknown>>({});
	let conversationEl: HTMLDivElement | undefined;
	let commitStates = $state<Record<number, CommitState>>({});

	let selectedProvider = $state(initProvider);
	let selectedModel = $state(initModel);
	let chatMode = $state<'chat' | 'create' | 'update'>('chat');
	let selectedNoteId = $state('');

	const currentProviderModels = $derived(
		data.providers.find((p) => p.id === selectedProvider)?.models ?? []
	);

	async function scrollToBottom() {
		await tick();
		if (conversationEl) conversationEl.scrollTop = conversationEl.scrollHeight;
	}

	async function commitProposal(msgIndex: number, proposal: NoteProposal) {
		commitStates = { ...commitStates, [msgIndex]: { status: 'pending' } };
		try {
			const res = await fetch('/api/assistant/commit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ proposal })
			});
			const data = await res.json();
			if (res.ok) {
				const result = (data as { result: { type: string; note?: CommitResultNote; noteId?: string } }).result;
				commitStates = {
					...commitStates,
					[msgIndex]: { status: 'done', note: result.note, noteId: result.noteId }
				};
			} else {
				const errMsg = (data as { error?: string }).error ?? 'Commit failed';
				commitStates = { ...commitStates, [msgIndex]: { status: 'error', error: errMsg } };
			}
		} catch {
			commitStates = { ...commitStates, [msgIndex]: { status: 'error', error: 'Network error' } };
		}
	}

	async function sendMessage() {
		const content = composerValue.trim();
		if (!content || isLoading) return;
		if (chatMode === 'update' && !selectedNoteId) return;

		composerValue = '';
		displayMessages = [...displayMessages, { type: 'user', content }];
		conversationHistory = [...conversationHistory, { role: 'user', content }];
		isLoading = true;
		await scrollToBottom();

		try {
			const body: Record<string, unknown> = {
				messages: conversationHistory,
				mode: chatMode,
				provider: selectedProvider,
				model: selectedModel,
				topicCache
			};
			if (chatMode === 'update' && selectedNoteId) {
				body.noteId = selectedNoteId;
			}
			const res = await fetch('/api/assistant/respond', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (res.ok) {
				const data = await res.json();
				const assistantContent: string = data.assistantMessage?.content ?? '';
				const citations: Citation[] = data.assistantMessage?.citations ?? [];
				const proposal: NoteProposal | null = data.proposal ?? null;

				if (data.topicCache && typeof data.topicCache === 'object') {
					topicCache = data.topicCache as Record<string, unknown>;
				}

				displayMessages = [
					...displayMessages,
					{ type: 'assistant', content: assistantContent, citations, proposal }
				];
				conversationHistory = [
					...conversationHistory,
					{ role: 'assistant', content: assistantContent }
				];
			} else {
				const err = await res.json().catch(() => ({}));
				const errMessage: string =
					(err as { error?: string }).error ?? 'Something went wrong. Please try again.';
				displayMessages = [
					...displayMessages,
					{ type: 'assistant', content: errMessage, citations: [], proposal: null }
				];
			}
		} catch {
			displayMessages = [
				...displayMessages,
				{ type: 'assistant', content: 'Network error. Please try again.', citations: [], proposal: null }
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
		<!-- Toolbar: provider, model, mode -->
		<div class="toolbar">
			<div class="toolbar-group">
				<select
					class="toolbar-select"
					bind:value={selectedProvider}
					onchange={() => {
						const prov = data.providers.find((p) => p.id === selectedProvider);
						if (prov) selectedModel = prov.defaultModel;
					}}
				>
					{#each data.providers as provider}
						<option value={provider.id}>{provider.label}</option>
					{/each}
				</select>
				<select class="toolbar-select" bind:value={selectedModel}>
					{#each currentProviderModels as m}
						<option value={m.id}>{m.label}</option>
					{/each}
				</select>
			</div>
			<div class="mode-toggle" role="group" aria-label="Chat mode">
				<button
					class="mode-btn"
					class:mode-btn--active={chatMode === 'chat'}
					onclick={() => (chatMode = 'chat')}
				>
					Chat
				</button>
				<button
					class="mode-btn"
					class:mode-btn--active={chatMode === 'create'}
					onclick={() => (chatMode = 'create')}
				>
					Create
				</button>
				<button
					class="mode-btn"
					class:mode-btn--active={chatMode === 'update'}
					onclick={() => { chatMode = 'update'; selectedNoteId = ''; }}
				>
					Update
				</button>
			</div>
		</div>

		{#if chatMode === 'update'}
			<div class="note-picker-row">
				<select class="note-picker" bind:value={selectedNoteId}>
					<option value="">— select a note to review —</option>
					{#each data.notes as note}
						<option value={note.id}>{note.title}</option>
					{/each}
				</select>
			</div>
		{/if}

		<div class="conversation-area" bind:this={conversationEl} aria-label="Conversation">
			{#if displayMessages.length === 0}
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
						<p class="empty-title">
							{chatMode === 'create'
								? 'Create a new note'
								: chatMode === 'update'
									? 'Review an existing note'
									: 'Ask about your notes'}
						</p>
						<p class="empty-hint">
							{chatMode === 'create'
								? 'Describe a technology or concept and the assistant will draft a note.'
								: chatMode === 'update'
									? 'Select a note above, then describe what to check or just ask for a review.'
									: 'The assistant answers questions grounded in your knowledge graph.'}
						</p>
					</div>
				{/if}
			{:else}
				<div class="messages-list">
					{#each displayMessages as msg}
						{#if msg.type === 'user'}
							<div class="user-message">
								<p class="user-bubble">{msg.content}</p>
							</div>
						{:else}
							<div class="assistant-message">
								<p class="summary-text">{msg.content}</p>
								{#if msg.citations?.length}
									<div class="citations-list">
										{#each msg.citations as citation}
											<a
												class="citation-link"
												href={citation.url}
												target="_blank"
												rel="noopener noreferrer"
											>{citation.title}</a>
										{/each}
									</div>
								{/if}
								{#if msg.proposal}
									{@const msgIdx = displayMessages.indexOf(msg)}
									{@const cs = commitStates[msgIdx]}
									{#if msg.proposal.type === 'create_note' && msg.proposal.draft}
										<div class="proposal-card">
											<div class="proposal-header">
												<span class="proposal-glyph">◈</span>
												<span class="proposal-label">Note draft</span>
											</div>
											<p class="proposal-title">{msg.proposal.draft.title}</p>
											{#if msg.proposal.draft.tags?.length}
												<div class="proposal-tags">
													{#each msg.proposal.draft.tags as tag}
														<span class="proposal-tag">{tag}</span>
													{/each}
												</div>
											{/if}
											{#if msg.proposal.linkedNotePatches?.length}
												<div class="linked-patches">
													<p class="linked-patches-label">Also updates:</p>
													<ul class="linked-patches-list">
														{#each msg.proposal.linkedNotePatches as patch}
															<li>{patch.title ?? patch.noteId}</li>
														{/each}
													</ul>
												</div>
											{/if}
											{#if cs?.status === 'done' && cs.note}
												<p class="commit-success">
													Saved — <a href="/notes/{cs.note.slug}">{cs.note.title}</a>
												</p>
											{:else if cs?.status === 'error'}
												<p class="commit-error">{cs.error}</p>
											{:else}
												<button
													class="commit-btn"
													disabled={cs?.status === 'pending'}
													onclick={() => commitProposal(msgIdx, msg.proposal!)}
												>
													{cs?.status === 'pending' ? 'Saving…' : 'Save note'}
												</button>
											{/if}
										</div>
									{:else if msg.proposal.type === 'update_note' && msg.proposal.draft}
										<div class="proposal-card proposal-card--update">
											<div class="proposal-header">
												<span class="proposal-glyph">↑</span>
												<span class="proposal-label">Update proposal</span>
											</div>
											<p class="proposal-title">{msg.proposal.draft.title}</p>
											{#if cs?.status === 'done' && cs.note}
												<p class="commit-success">
													Updated — <a href="/notes/{cs.note.slug}">{cs.note.title}</a>
												</p>
											{:else if cs?.status === 'error'}
												<p class="commit-error">{cs.error}</p>
											{:else}
												<button
													class="commit-btn"
													disabled={cs?.status === 'pending'}
													onclick={() => commitProposal(msgIdx, msg.proposal!)}
												>
													{cs?.status === 'pending' ? 'Applying…' : 'Apply update'}
												</button>
											{/if}
										</div>
									{:else if msg.proposal.type === 'delete_note'}
										<div class="proposal-card proposal-card--delete">
											<div class="proposal-header">
												<span class="proposal-glyph">✕</span>
												<span class="proposal-label">Delete note</span>
											</div>
											<p class="proposal-title">{msg.proposal.noteTitle ?? msg.proposal.noteId ?? 'Unknown note'}</p>
											{#if cs?.status === 'done'}
												<p class="commit-success">Note deleted.</p>
											{:else if cs?.status === 'error'}
												<p class="commit-error">{cs.error}</p>
											{:else}
												<button
													class="commit-btn commit-btn--danger"
													disabled={cs?.status === 'pending'}
													onclick={() => commitProposal(msgIdx, msg.proposal!)}
												>
													{cs?.status === 'pending' ? 'Deleting…' : 'Confirm delete'}
												</button>
											{/if}
										</div>
									{/if}
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
				placeholder={chatMode === 'create'
					? 'Describe a topic to create a note…'
					: chatMode === 'update'
						? 'Ask to review the selected note for updates…'
						: 'Ask about your notes…'}
				rows="2"
				disabled={isLoading}
				bind:value={composerValue}
				onkeydown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						sendMessage();
					}
				}}
			></textarea>
			<button
				class="send-btn"
				disabled={!composerValue.trim() || isLoading || (chatMode === 'update' && !selectedNoteId)}
				onclick={sendMessage}
			>
				Send
			</button>
		</div>
	</div>
</div>

<style>
	/* ── Page shell fills the viewport beside the left rail ── */
	.chat-shell {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 4rem);
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

	/* ── Toolbar ─────────────────────────────────────────────────────── */
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-shrink: 0;
	}

	.toolbar-group {
		display: flex;
		gap: 0.5rem;
	}

	.toolbar-select {
		background: var(--bg-surface);
		border: 1px solid var(--border-soft);
		border-radius: 8px;
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.78rem;
		padding: 0.3rem 0.6rem;
		cursor: pointer;
		transition: border-color 0.15s ease;
	}

	.toolbar-select:hover {
		border-color: var(--border-strong);
	}

	.mode-toggle {
		display: flex;
		background: var(--bg-surface);
		border: 1px solid var(--border-soft);
		border-radius: 8px;
		overflow: hidden;
	}

	.mode-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		font-family: inherit;
		font-size: 0.78rem;
		font-weight: 500;
		padding: 0.3rem 0.75rem;
		cursor: pointer;
		transition: color 0.15s ease, background 0.15s ease;
	}

	.mode-btn--active {
		background: var(--bg-raised);
		color: var(--text-primary);
	}

	/* ── Note picker row (update mode) ─────────────────────────────── */
	.note-picker-row {
		flex-shrink: 0;
	}

	.note-picker {
		width: 100%;
		background: var(--bg-surface);
		border: 1px solid var(--border-soft);
		border-radius: 8px;
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.85rem;
		padding: 0.4rem 0.7rem;
		cursor: pointer;
		transition: border-color 0.15s ease;
	}

	.note-picker:hover {
		border-color: var(--border-strong);
	}

	.note-picker:focus {
		outline: none;
		border-color: var(--accent-primary);
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

	/* ── Centred placeholder states ─────────────────────────────────── */
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

	.summary-text {
		font-size: 0.9rem;
		line-height: 1.75;
		color: var(--text-secondary);
		margin: 0;
	}

	/* ── Citations list ─────────────────────────────────────────────── */
	.citations-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: -0.25rem;
	}

	.citation-link {
		display: inline-block;
		background: var(--bg-raised);
		border: 1px solid var(--border-soft);
		border-radius: 6px;
		padding: 0.15rem 0.5rem;
		font-size: 0.72rem;
		color: var(--text-muted);
		text-decoration: none;
		transition: color 0.15s ease, border-color 0.15s ease;
		max-width: 220px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.citation-link:hover {
		color: var(--accent-primary);
		border-color: color-mix(in srgb, var(--accent-primary) 30%, transparent);
	}

	/* ── Note proposal card ──────────────────────────────────────────── */
	.proposal-card {
		background: var(--bg-raised);
		border: 1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent);
		border-radius: 10px;
		padding: 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.proposal-header {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.proposal-glyph {
		font-size: 0.75rem;
		color: var(--accent-primary);
		opacity: 0.8;
	}

	.proposal-label {
		font-size: 0.68rem;
		font-weight: 500;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--accent-primary);
	}

	.proposal-title {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
	}

	.proposal-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.proposal-tag {
		background: var(--accent-soft);
		border: 1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent);
		border-radius: 999px;
		padding: 0.15rem 0.55rem;
		font-size: 0.72rem;
		color: var(--accent-primary);
	}

	/* ── Linked-note patch preview ──────────────────────────────────── */
	.linked-patches {
		margin-top: 0.1rem;
	}

	.linked-patches-label {
		font-size: 0.68rem;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-muted);
		margin: 0 0 0.2rem;
	}

	.linked-patches-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.linked-patches-list li {
		background: var(--bg-surface);
		border: 1px solid var(--border-soft);
		border-radius: 6px;
		padding: 0.1rem 0.45rem;
		font-size: 0.72rem;
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

	.loading-dots span:nth-child(2) {
		animation-delay: 0.2s;
	}
	.loading-dots span:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes pulse {
		0%,
		80%,
		100% {
			opacity: 0.3;
			transform: scale(0.9);
		}
		40% {
			opacity: 1;
			transform: scale(1.1);
		}
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

	/* ── Proposal card variants ─────────────────────────────────────────── */
	.proposal-card--update {
		border-color: color-mix(in srgb, var(--color-sky-500, #0ea5e9) 30%, transparent);
	}

	.proposal-card--delete {
		border-color: color-mix(in srgb, var(--color-red-500, #ef4444) 30%, transparent);
	}

	/* ── Commit action button ────────────────────────────────────────────── */
	.commit-btn {
		align-self: flex-start;
		background: var(--accent-strong);
		color: #fff;
		border: none;
		border-radius: 9999px;
		padding: 0.3rem 0.8rem;
		font-family: inherit;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: opacity 0.15s ease;
		margin-top: 0.25rem;
	}

	.commit-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.commit-btn:not(:disabled):hover {
		opacity: 0.85;
	}

	.commit-btn--danger {
		background: color-mix(in srgb, var(--color-red-600, #dc2626) 80%, transparent);
	}

	/* ── Commit feedback ────────────────────────────────────────────────── */
	.commit-success {
		font-size: 0.78rem;
		color: var(--text-muted);
		margin: 0.25rem 0 0;
	}

	.commit-success a {
		color: var(--accent-primary);
		text-decoration: none;
	}

	.commit-success a:hover {
		text-decoration: underline;
	}

	.commit-error {
		font-size: 0.78rem;
		color: color-mix(in srgb, var(--color-red-500, #ef4444) 80%, var(--text-muted));
		margin: 0.25rem 0 0;
	}
</style>
