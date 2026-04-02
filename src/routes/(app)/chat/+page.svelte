<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { marked } from 'marked';
	import type { PageData } from './$types.js';
	import { resolveWikilinks } from '$lib/utils/wikilinks.js';
	import { CANONICAL_NOTE_CATEGORIES } from '$lib/utils/note-taxonomy.js';

	type ProviderId = 'anthropic' | 'openai';
	type AssistantMode = 'chat' | 'create' | 'update';
	type NoteStatus = 'stub' | 'growing' | 'mature';

	interface ChatNote {
		id: string;
		title: string;
		slug: string;
		aliases: string[];
		category: string | null;
		status: NoteStatus;
		updatedAt: Date;
	}

	interface Citation {
		title: string;
		url: string;
	}

	interface ResolvedNote {
		id: string;
		title: string;
		slug: string;
		matchType: 'selected' | 'title' | 'alias';
		matchedText: string;
	}

	interface RoutingState {
		intent: 'conversational' | 'create' | 'review';
		resolvedMode: AssistantMode;
		override: AssistantMode | null;
		overrideSource: 'override' | 'mode' | 'none';
		matchedNote: ResolvedNote | null;
		targetNote: ResolvedNote | null;
		noteId: string | null;
		latestUserMessage: string;
	}

	interface NoteDraft {
		title: string;
		body: string;
		tags: string[];
		aliases: string[];
		category: string;
		status: NoteStatus;
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

	interface DraftEditorState {
		title: string;
		body: string;
		tagsText: string;
		aliasesText: string;
		category: string;
		status: NoteStatus;
		showPreview: boolean;
	}

	interface UserMessage {
		id: string;
		role: 'user';
		content: string;
	}

	interface AssistantMessage {
		id: string;
		role: 'assistant';
		content: string;
		citations: Citation[];
		proposal: NoteProposal | null;
		routing: RoutingState | null;
	}

	type DisplayMessage = UserMessage | AssistantMessage;

	const { data }: { data: PageData } = $props();

	let selectedProvider = $state<ProviderId>(
		untrack(() => data.defaultProvider as ProviderId)
	);
	let selectedModel = $state(untrack(() => data.defaultModel));
	let overrideMode = $state<AssistantMode | null>(null);
	let selectedNoteId = $state('');
	let composerValue = $state('');
	let isLoading = $state(false);
	let topicCache = $state<Record<string, unknown>>({});
	let conversationHistory = $state<{ role: 'user' | 'assistant'; content: string }[]>([]);
	let displayMessages = $state<DisplayMessage[]>([]);
	let commitStates = $state<Record<string, CommitState>>({});
	let draftStates = $state<Record<string, DraftEditorState>>({});
	let conversationEl: HTMLDivElement | null = null;
	let messageCounter = 0;

	const currentProviderModels = $derived(
		data.providers.find((provider) => provider.id === selectedProvider)?.models ?? []
	);

	const selectedNote = $derived.by(() => data.notes.find((note) => note.id === selectedNoteId) ?? null);
	const noteLookupById = $derived.by(
		() => new Map(data.notes.map((note) => [note.id, note] as const))
	);
	const noteSlugMap = $derived.by(() => {
		const map = new Map<string, string>();
		for (const note of data.notes) {
			map.set(note.title, note.slug);
			for (const alias of note.aliases) {
				map.set(alias, note.slug);
			}
		}
		return map;
	});

	function nextMessageId(prefix: string): string {
		messageCounter += 1;
		return `${prefix}-${messageCounter}`;
	}

	function setOverride(mode: AssistantMode | null) {
		overrideMode = mode;
		if (mode !== 'update') {
			selectedNoteId = '';
		}
	}

	function handleProviderChange() {
		const provider = data.providers.find((entry) => entry.id === selectedProvider);
		if (!provider) return;
		if (!provider.models.some((entry) => entry.id === selectedModel)) {
			selectedModel = provider.defaultModel;
		}
	}

	function updateSelectedNote(noteId: string) {
		selectedNoteId = noteId;
		overrideMode = 'update';
	}

	function splitCommaList(value: string): string[] {
		return value
			.split(',')
			.map((part) => part.trim())
			.filter(Boolean);
	}

	function createDraftState(draft: NoteDraft): DraftEditorState {
		return {
			title: draft.title,
			body: draft.body,
			tagsText: draft.tags.join(', '),
			aliasesText: draft.aliases.join(', '),
			category: draft.category ?? '',
			status: draft.status,
			showPreview: false
		};
	}

	function normaliseDraftState(state: DraftEditorState, source: NoteDraft): NoteDraft {
		return {
			...source,
			title: state.title.trim(),
			body: state.body,
			tags: splitCommaList(state.tagsText),
			aliases: splitCommaList(state.aliasesText),
			category: state.category.trim(),
			status: state.status
		};
	}

	function registerProposalDraft(messageId: string, proposal: NoteProposal) {
		if (!proposal.draft) return;
		draftStates = {
			...draftStates,
			[messageId]: createDraftState(proposal.draft)
		};
	}

	function buildCommitProposal(messageId: string, proposal: NoteProposal): NoteProposal {
		if (!proposal.draft) return proposal;
		const draftState = draftStates[messageId];
		if (!draftState) return proposal;
		return {
			...proposal,
			draft: normaliseDraftState(draftState, proposal.draft)
		};
	}

	function renderDraftPreview(body: string): string {
		const resolved = resolveWikilinks(body, noteSlugMap);
		return marked.parse(resolved) as string;
	}

	function formatRelativeTime(value: Date | string): string {
		const time = new Date(value).getTime();
		if (Number.isNaN(time)) return '';

		const diffSeconds = Math.round((time - Date.now()) / 1000);
		const thresholds: Array<[Intl.RelativeTimeFormatUnit, number]> = [
			['year', 60 * 60 * 24 * 365],
			['month', 60 * 60 * 24 * 30],
			['week', 60 * 60 * 24 * 7],
			['day', 60 * 60 * 24],
			['hour', 60 * 60],
			['minute', 60]
		];

		for (const [unit, size] of thresholds) {
			if (Math.abs(diffSeconds) >= size) {
				return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
					Math.round(diffSeconds / size),
					unit
				);
			}
		}

		return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(diffSeconds, 'second');
	}

	function modeLabel(mode: AssistantMode): string {
		if (mode === 'create') return 'Create';
		if (mode === 'update') return 'Update';
		return 'Chat';
	}

	function intentLabel(intent: RoutingState['intent']): string {
		if (intent === 'create') return 'Create';
		if (intent === 'review') return 'Review';
		return 'Conversation';
	}

	function noteCardLabel(note: ChatNote): string {
		const category = note.category ? note.category : 'Uncategorised';
		return `${category} · ${note.status}`;
	}

	async function scrollToBottom() {
		await tick();
		if (conversationEl) conversationEl.scrollTop = conversationEl.scrollHeight;
	}

	function beginReview(noteId: string) {
		updateSelectedNote(noteId);
		composerValue = composerValue || 'Review this note for gaps, corrections, and next steps.';
	}

	function beginResearch(noteTitle: string) {
		overrideMode = null;
		selectedNoteId = '';
		composerValue = `Tell me more about ${noteTitle}.`;
	}

	function resetDraft(messageId: string, proposal: NoteProposal) {
		if (!proposal.draft) return;
		draftStates = {
			...draftStates,
			[messageId]: createDraftState(proposal.draft)
		};
	}

	async function commitProposal(messageId: string, proposal: NoteProposal) {
		const payload = buildCommitProposal(messageId, proposal);
		commitStates = { ...commitStates, [messageId]: { status: 'pending' } };

		try {
			const response = await fetch('/api/assistant/commit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ proposal: payload })
			});
			const body = await response.json();

			if (response.ok) {
				const result = (body as {
					result: { type: string; note?: CommitResultNote; noteId?: string };
				}).result;
				commitStates = {
					...commitStates,
					[messageId]: { status: 'done', note: result.note, noteId: result.noteId }
				};
				return;
			}

			const error = (body as { error?: string }).error ?? 'Commit failed';
			commitStates = { ...commitStates, [messageId]: { status: 'error', error } };
		} catch {
			commitStates = {
				...commitStates,
				[messageId]: { status: 'error', error: 'Network error' }
			};
		}
	}

	async function sendMessage() {
		const content = composerValue.trim();
		if (!content || isLoading) return;
		if (overrideMode === 'update' && !selectedNoteId) return;

		const userMessage: UserMessage = {
			id: nextMessageId('user'),
			role: 'user',
			content
		};

		composerValue = '';
		displayMessages = [...displayMessages, userMessage];
		conversationHistory = [...conversationHistory, { role: 'user', content }];
		isLoading = true;
		await scrollToBottom();

		try {
			const body: Record<string, unknown> = {
				messages: conversationHistory,
				provider: selectedProvider,
				model: selectedModel,
				topicCache
			};

			if (overrideMode) {
				body.override = overrideMode;
			}

			if (overrideMode === 'update' && selectedNoteId) {
				body.noteId = selectedNoteId;
			}

			const response = await fetch('/api/assistant/respond', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (response.ok) {
				const data = await response.json();
				const assistantContent: string = data.assistantMessage?.content ?? '';
				const citations: Citation[] = data.assistantMessage?.citations ?? [];
				const proposal: NoteProposal | null = data.proposal ?? null;
				const routing: RoutingState | null = data.routing ?? null;
				const assistantMessage: AssistantMessage = {
					id: nextMessageId('assistant'),
					role: 'assistant',
					content: assistantContent,
					citations,
					proposal,
					routing
				};

				if (data.topicCache && typeof data.topicCache === 'object') {
					topicCache = data.topicCache as Record<string, unknown>;
				}

				displayMessages = [...displayMessages, assistantMessage];
				conversationHistory = [
					...conversationHistory,
					{ role: 'assistant', content: assistantContent }
				];

				if (
					(assistantMessage.proposal?.type === 'create_note' ||
						assistantMessage.proposal?.type === 'update_note') &&
					assistantMessage.proposal.draft
				) {
					registerProposalDraft(assistantMessage.id, assistantMessage.proposal);
				}
			} else {
				const err = await response.json().catch(() => ({}));
				const errMessage: string =
					(err as { error?: string }).error ?? 'Something went wrong. Please try again.';
				displayMessages = [
					...displayMessages,
					{
						id: nextMessageId('assistant-error'),
						role: 'assistant',
						content: errMessage,
						citations: [],
						proposal: null,
						routing: null
					}
				];
			}
		} catch {
			displayMessages = [
				...displayMessages,
				{
					id: nextMessageId('assistant-error'),
					role: 'assistant',
					content: 'Network error. Please try again.',
					citations: [],
					proposal: null,
					routing: null
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

<div class="chat-page">
	<header class="chat-header">
		<div class="chat-heading">
			<p class="eyebrow">Assistant-first surface</p>
			<h1>Chat</h1>
			<p class="lede">
				Keep the conversation flowing, surface matched notes inline, and review create/update/delete
				proposals without leaving the thread.
			</p>
		</div>
		<div class="chat-summary">
			<span class="summary-pill">Providers live</span>
			<span class="summary-pill">Inline proposals</span>
			<span class="summary-pill">Resolved routing</span>
		</div>
	</header>

	<section class="chat-shell">
		<div class="conversation-column">
			<div class="conversation-stream" bind:this={conversationEl} aria-label="Conversation">
				{#if displayMessages.length === 0}
					<div class="empty-state">
						<p class="empty-kicker">No conversation yet</p>
						<h2>{overrideMode === 'create' ? 'Draft a note' : 'Start a thread'}</h2>
						<p>
							Ask a question, request a note draft, or use the compact override controls to review an
							existing note.
						</p>
						<div class="empty-notes">
							<div class="empty-note">
								<span>Auto</span>
								<p>Inference-first chat that chooses the route for you.</p>
							</div>
							<div class="empty-note">
								<span>Create</span>
								<p>Generate a new note draft inline before you save it.</p>
							</div>
							<div class="empty-note">
								<span>Update</span>
								<p>Pick a saved note and review it without forcing mutation.</p>
							</div>
						</div>
					</div>
				{:else}
					{#each displayMessages as msg}
						{#if msg.role === 'user'}
							<article class="message message--user">
								<div class="message-bubble message-bubble--user">
									<p>{msg.content}</p>
								</div>
							</article>
						{:else}
							<article class="message message--assistant">
								<div class="assistant-panel">
									<div class="message-meta">
										<span class="message-role">Assistant</span>
										{#if msg.routing}
											<span class="meta-pill">{modeLabel(msg.routing.resolvedMode)}</span>
											<span class="meta-pill meta-pill--soft">{intentLabel(msg.routing.intent)}</span>
											{#if msg.routing.overrideSource !== 'none'}
												<span class="meta-pill meta-pill--accent">
													{msg.routing.overrideSource === 'override' ? 'Manual override' : 'Legacy mode'}
												</span>
											{/if}
										{/if}
									</div>

									<div class="assistant-copy">
										<p>{msg.content}</p>
									</div>

									{#if msg.citations.length}
										<div class="citation-row" aria-label="Assistant citations">
											{#each msg.citations as citation}
												<a
													class="citation-chip"
													href={citation.url}
													target="_blank"
													rel="noopener noreferrer"
												>
													{citation.title}
												</a>
											{/each}
										</div>
									{/if}

									{#if msg.routing?.matchedNote && msg.routing.resolvedMode === 'chat'}
										{@const matched = noteLookupById.get(msg.routing.matchedNote.id)}
										<div class="match-card">
											<div class="match-card__head">
												<div>
													<p class="match-card__eyebrow">Matched saved note</p>
													<h3>{matched?.title ?? msg.routing.matchedNote.title}</h3>
												</div>
												<a class="match-card__link" href={`/notes/${msg.routing.matchedNote.slug}`}>
													Open note
												</a>
											</div>
											<p class="match-card__body">
												{msg.routing.matchedNote.matchType === 'alias'
													? `Alias match for “${msg.routing.matchedNote.matchedText}”.`
													: `Exact title match for “${msg.routing.matchedNote.matchedText}”.`}
											</p>
											{#if matched}
												<div class="match-card__detail-row">
													<span class="match-detail">{noteCardLabel(matched)}</span>
													<span class="match-detail">Updated {formatRelativeTime(matched.updatedAt)}</span>
												</div>
											{/if}
											<div class="match-card__actions">
												<button
													type="button"
													class="ghost-btn"
													onclick={() => beginReview(msg.routing!.matchedNote!.id)}
												>
													Review note
												</button>
												<button
													type="button"
													class="ghost-btn"
													onclick={() => beginResearch(msg.routing!.matchedNote!.title)}
												>
													Research follow-up
												</button>
											</div>
										</div>
									{/if}

									{#if msg.routing?.targetNote && msg.routing.resolvedMode === 'update'}
										{@const target = noteLookupById.get(msg.routing.targetNote.id)}
										<div class="match-card match-card--target">
											<div class="match-card__head">
												<div>
													<p class="match-card__eyebrow">Review target</p>
													<h3>{target?.title ?? msg.routing.targetNote.title}</h3>
												</div>
												<a class="match-card__link" href={`/notes/${msg.routing.targetNote.slug}`}>
													Open note
												</a>
											</div>
											<p class="match-card__body">
												{msg.routing.intent === 'review'
													? 'The assistant resolved this as a review/update turn.'
													: 'The assistant routed this turn to an existing saved note.'}
											</p>
										</div>
									{/if}

									{#if msg.proposal}
										{@const commitState = commitStates[msg.id]}
										{#if msg.proposal.type === 'create_note' || msg.proposal.type === 'update_note'}
											{@const draftState = draftStates[msg.id]}
											<div class="proposal-panel">
												<div class="proposal-head">
													<div>
														<p class="proposal-eyebrow">
															{msg.proposal.type === 'create_note' ? 'Create note' : 'Update note'}
														</p>
														<h3>{draftState?.title ?? msg.proposal.draft?.title}</h3>
													</div>
													<div class="proposal-head__flags">
														{#if msg.proposal.draft?.aiGenerated}
															<span class="meta-pill meta-pill--accent">AI drafted</span>
														{/if}
														{#if msg.proposal.draft?.aiModel}
															<span class="meta-pill meta-pill--soft">{msg.proposal.draft.aiModel}</span>
														{/if}
													</div>
												</div>

												{#if msg.proposal.draft?.aiPrompt}
													<p class="proposal-note">
														Prompted from “{msg.proposal.draft.aiPrompt}”.
													</p>
												{/if}

												{#if msg.citations.length}
													<div class="citation-row citation-row--proposal">
														{#each msg.citations as citation}
															<a
																class="citation-chip"
																href={citation.url}
																target="_blank"
																rel="noopener noreferrer"
															>
																{citation.title}
															</a>
														{/each}
													</div>
												{/if}

												{#if draftState}
													<div class="proposal-grid">
														<label class="field">
															<span>Title</span>
															<input type="text" bind:value={draftState.title} />
														</label>

														<label class="field">
															<span>Primary category</span>
															<select bind:value={draftState.category}>
																<option value="">Select a category</option>
																{#each CANONICAL_NOTE_CATEGORIES as category}
																	<option value={category}>{category}</option>
																{/each}
															</select>
														</label>

														<label class="field">
															<span>Status</span>
															<select bind:value={draftState.status}>
																<option value="stub">Stub</option>
																<option value="growing">Growing</option>
																<option value="mature">Mature</option>
															</select>
														</label>

														<label class="field">
															<span>Tags</span>
															<input type="text" bind:value={draftState.tagsText} />
														</label>

														<label class="field">
															<span>Aliases</span>
															<input type="text" bind:value={draftState.aliasesText} />
														</label>
													</div>

													<label class="field field--body">
														<span>Body</span>
														<textarea rows="10" bind:value={draftState.body}></textarea>
													</label>

													<div class="proposal-toolbar">
														<div class="proposal-toolbar__left">
															<button
																type="button"
																class="ghost-btn"
																onclick={() => (draftState.showPreview = !draftState.showPreview)}
															>
																{draftState.showPreview ? 'Hide preview' : 'Preview body'}
															</button>
															<button
																type="button"
																class="ghost-btn"
																onclick={() => resetDraft(msg.id, msg.proposal!)}
															>
																Reset draft
															</button>
														</div>
														<button
															type="button"
															class="primary-btn"
															disabled={commitState?.status === 'pending'}
															onclick={() => commitProposal(msg.id, msg.proposal!)}
														>
															{commitState?.status === 'pending'
																? msg.proposal.type === 'create_note'
																	? 'Saving…'
																	: 'Applying…'
																: msg.proposal.type === 'create_note'
																	? 'Save note'
																	: 'Apply update'}
														</button>
													</div>

													{#if draftState.showPreview}
														<div class="preview-pane">
															{#if draftState.body.trim()}
																{@html renderDraftPreview(draftState.body)}
															{:else}
																<p class="preview-empty">Nothing to preview yet.</p>
															{/if}
														</div>
													{/if}
												{/if}

												{#if msg.proposal.linkedNotePatches?.length}
													<div class="linked-patches">
														<p class="linked-patches__label">Also updates</p>
														<ul class="linked-patches__list">
															{#each msg.proposal.linkedNotePatches as patch}
																<li>{patch.title ?? patch.noteId}</li>
															{/each}
														</ul>
													</div>
												{/if}

												{#if commitState?.status === 'done' && commitState.note}
													<p class="commit-success">
														Saved
														<a href={`/notes/${commitState.note.slug}`}>{commitState.note.title}</a>
													</p>
												{:else if commitState?.status === 'error'}
													<p class="commit-error">{commitState.error}</p>
												{/if}
											</div>
										{:else if msg.proposal.type === 'delete_note'}
											<div class="proposal-panel proposal-panel--delete">
												<div class="proposal-head">
													<div>
														<p class="proposal-eyebrow">Delete note</p>
														<h3>{msg.proposal.noteTitle ?? 'Untitled note'}</h3>
													</div>
													<span class="meta-pill meta-pill--danger">Confirmation required</span>
												</div>

												<p class="proposal-note">
													This permanently removes the note and its graph connections. There is no typed
													confirmation step, so the action stays compact and deliberate.
												</p>

												{#if msg.proposal.noteId}
													<p class="proposal-note">Target id: {msg.proposal.noteId}</p>
												{/if}

										<div class="proposal-toolbar">
													<div class="proposal-toolbar__left">
														<a
															class="ghost-btn ghost-btn--link"
															href={
																msg.proposal.noteId && noteLookupById.get(msg.proposal.noteId)
																	? `/notes/${noteLookupById.get(msg.proposal.noteId)?.slug}`
																	: '/notes'
															}
														>
															Keep note
														</a>
													</div>
													<button
														type="button"
														class="danger-btn"
														disabled={commitState?.status === 'pending'}
														onclick={() => commitProposal(msg.id, msg.proposal!)}
													>
														{commitState?.status === 'pending' ? 'Deleting…' : 'Delete note'}
													</button>
												</div>

												{#if commitState?.status === 'done'}
													<p class="commit-success">Note deleted.</p>
												{:else if commitState?.status === 'error'}
													<p class="commit-error">{commitState.error}</p>
												{/if}
											</div>
										{/if}
									{/if}
								</div>
							</article>
						{/if}
					{/each}

					{#if isLoading}
						<div class="loading-row" aria-live="polite">
							<div class="loading-dots">
								<span></span>
								<span></span>
								<span></span>
							</div>
							<p>Thinking…</p>
						</div>
					{/if}
				{/if}
			</div>

			<div class="composer-dock">
				<div class="composer-topline">
					<div class="composer-selects">
						<label class="select-chip" for="provider-select">
							<span>Provider</span>
							<select
								id="provider-select"
								bind:value={selectedProvider}
								onchange={handleProviderChange}
							>
								{#each data.providers as provider}
									<option value={provider.id}>{provider.label}</option>
								{/each}
							</select>
						</label>

						<label class="select-chip" for="model-select">
							<span>Model</span>
							<select id="model-select" bind:value={selectedModel}>
								{#each currentProviderModels as model}
									<option value={model.id}>{model.label}</option>
								{/each}
							</select>
						</label>
					</div>

					<div class="override-group" role="group" aria-label="Create and update overrides">
						<button
							type="button"
							class="override-btn"
							class:override-btn--active={overrideMode === null}
							aria-pressed={overrideMode === null}
							onclick={() => setOverride(null)}
						>
							Auto
						</button>
						<button
							type="button"
							class="override-btn"
							class:override-btn--active={overrideMode === 'create'}
							aria-pressed={overrideMode === 'create'}
							onclick={() => setOverride('create')}
						>
							Create
						</button>
						<button
							type="button"
							class="override-btn"
							class:override-btn--active={overrideMode === 'update'}
							aria-pressed={overrideMode === 'update'}
							onclick={() => setOverride('update')}
						>
							Update
						</button>
					</div>
				</div>

				{#if overrideMode === 'create'}
					<p class="composer-context">Create mode stays compact. The assistant will draft a new note.</p>
				{:else if overrideMode === 'update' && selectedNote}
					<p class="composer-context">
						Update mode is pinned to <a href={`/notes/${selectedNote.slug}`}>{selectedNote.title}</a>.
					</p>
				{:else if overrideMode === 'update'}
					<p class="composer-context">Pick a saved note before sending a review or update request.</p>
				{:else}
					<p class="composer-context">
						Auto mode lets the assistant infer whether to chat, draft, or review a note.
					</p>
				{/if}

				{#if overrideMode === 'update'}
					<div class="note-select-row">
						<label class="field field--select" for="note-select">
							<span>Review target</span>
							<select id="note-select" bind:value={selectedNoteId}>
								<option value="">Select a saved note</option>
								{#each data.notes as note}
									<option value={note.id}>
										{note.title}{note.category ? ` · ${note.category}` : ''} · {note.status}
									</option>
								{/each}
							</select>
						</label>
					</div>
				{/if}

				<div class="composer-row">
					<textarea
						class="composer-input"
						placeholder={overrideMode === 'create'
							? 'Describe the note you want drafted…'
							: overrideMode === 'update'
								? 'Ask to review, revise, or fix the selected note…'
								: 'Ask about your notes, request a draft, or start a review…'}
						rows="3"
						disabled={isLoading}
						bind:value={composerValue}
						onkeydown={(event) => {
							if (event.key === 'Enter' && !event.shiftKey) {
								event.preventDefault();
								sendMessage();
							}
						}}
					></textarea>
					<button
						type="button"
						class="send-btn"
						disabled={!composerValue.trim() || isLoading || (overrideMode === 'update' && !selectedNoteId)}
						onclick={sendMessage}
					>
						{#if isLoading}
							Sending…
						{:else}
							Send
						{/if}
					</button>
				</div>
			</div>
		</div>
	</section>
</div>

<style>
	.chat-page {
		min-height: calc(100vh - 4rem);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.chat-header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		padding-bottom: 0.25rem;
	}

	.chat-heading {
		display: grid;
		gap: 0.35rem;
		max-width: 52rem;
	}

	.eyebrow {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-subtle);
	}

	h1 {
		margin: 0;
		font-size: clamp(2rem, 3vw, 2.8rem);
		line-height: 1;
		letter-spacing: -0.04em;
		color: var(--text-primary);
	}

	.lede {
		margin: 0;
		max-width: 52rem;
		color: var(--text-secondary);
		font-size: 0.95rem;
		line-height: 1.6;
	}

	.chat-summary {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	.summary-pill {
		padding: 0.45rem 0.7rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--accent-soft) 26%, var(--bg-raised));
		border: 1px solid var(--border-soft);
		color: var(--text-secondary);
		font-size: 0.76rem;
		font-weight: 600;
	}

	.chat-shell {
		flex: 1;
		min-height: 0;
	}

	.conversation-column {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-height: 0;
		max-width: 62rem;
		margin: 0 auto;
	}

	.conversation-stream {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		overflow: auto;
		padding-right: 0.25rem;
		scrollbar-gutter: stable;
	}

	.empty-state {
		display: grid;
		gap: 0.7rem;
		padding: 1.5rem;
		border-radius: 1.25rem;
		border: 1px solid var(--border-soft);
		background:
			linear-gradient(180deg, color-mix(in srgb, var(--bg-raised) 92%, transparent), var(--bg-surface)),
			var(--bg-surface);
	}

	.empty-kicker {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-subtle);
	}

	.empty-state h2 {
		margin: 0;
		font-size: 1.3rem;
		color: var(--text-primary);
	}

	.empty-state p {
		margin: 0;
		color: var(--text-secondary);
		line-height: 1.6;
	}

	.empty-notes {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.empty-note {
		display: grid;
		gap: 0.35rem;
		padding: 0.9rem;
		border-radius: 0.95rem;
		background: var(--bg-raised);
		border: 1px solid var(--border-soft);
	}

	.empty-note span {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--accent-primary);
	}

	.empty-note p {
		font-size: 0.9rem;
		color: var(--text-muted);
		line-height: 1.45;
	}

	.message {
		display: flex;
		flex-direction: column;
	}

	.message-bubble {
		max-width: 48rem;
		padding: 0.95rem 1.05rem;
		border-radius: 1rem;
		border: 1px solid var(--border-soft);
		background: var(--bg-surface);
		box-shadow: 0 10px 30px rgb(0 0 0 / 0.08);
	}

	.message-bubble p,
	.assistant-copy p,
	.proposal-note,
	.match-card__body,
	.commit-success,
	.commit-error {
		margin: 0;
		line-height: 1.6;
	}

	.message-bubble--user {
		margin-left: auto;
		background: color-mix(in srgb, var(--accent-soft) 24%, var(--bg-surface));
		border-color: color-mix(in srgb, var(--accent-strong) 18%, var(--border-soft));
		color: var(--text-primary);
	}

	.assistant-panel {
		display: grid;
		gap: 0.9rem;
		padding: 1rem;
		border-radius: 1.25rem;
		border: 1px solid var(--border-soft);
		background:
			linear-gradient(180deg, color-mix(in srgb, var(--bg-raised) 80%, transparent), var(--bg-surface)),
			var(--bg-surface);
	}

	.message-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.45rem;
	}

	.message-role,
	.meta-pill {
		display: inline-flex;
		align-items: center;
		border-radius: 999px;
		border: 1px solid var(--border-soft);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.message-role {
		padding: 0.3rem 0.6rem;
		color: var(--text-primary);
		background: var(--bg-raised);
	}

	.meta-pill {
		padding: 0.3rem 0.55rem;
		background: var(--bg-raised);
		color: var(--text-muted);
	}

	.meta-pill--soft {
		background: color-mix(in srgb, var(--accent-soft) 28%, var(--bg-raised));
		color: var(--accent-primary);
	}

	.meta-pill--accent {
		background: color-mix(in srgb, var(--accent-strong) 16%, var(--bg-raised));
		color: var(--accent-strong);
	}

	.meta-pill--danger {
		background: color-mix(in srgb, var(--accent-red) 14%, var(--bg-raised));
		color: var(--accent-red);
	}

	.assistant-copy {
		color: var(--text-primary);
		font-size: 0.95rem;
	}

	.citation-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.citation-chip {
		display: inline-flex;
		align-items: center;
		padding: 0.35rem 0.6rem;
		border-radius: 999px;
		border: 1px solid var(--border-soft);
		background: var(--bg-raised);
		color: var(--text-secondary);
		font-size: 0.8rem;
		text-decoration: none;
		transition:
			border-color 150ms ease,
			color 150ms ease,
			transform 150ms ease;
	}

	.citation-chip:hover {
		border-color: var(--border-strong);
		color: var(--accent-primary);
		transform: translateY(-1px);
	}

	.match-card,
	.proposal-panel {
		display: grid;
		gap: 0.85rem;
		padding: 1rem;
		border-radius: 1rem;
		border: 1px solid var(--border-soft);
		background: var(--bg-raised);
	}

	.match-card--target {
		background: color-mix(in srgb, var(--accent-soft) 18%, var(--bg-raised));
	}

	.match-card__head,
	.proposal-head {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.match-card__eyebrow,
	.proposal-eyebrow,
	.linked-patches__label {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-subtle);
	}

	.match-card h3,
	.proposal-head h3 {
		margin: 0.25rem 0 0;
		font-size: 1rem;
		color: var(--text-primary);
	}

	.match-card__link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.42rem 0.7rem;
		border-radius: 999px;
		border: 1px solid var(--border-soft);
		background: var(--bg-surface);
		color: var(--accent-primary);
		font-size: 0.8rem;
		font-weight: 600;
		text-decoration: none;
	}

	.match-card__body,
	.proposal-note {
		color: var(--text-secondary);
	}

	.match-card__detail-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.match-detail {
		display: inline-flex;
		align-items: center;
		padding: 0.3rem 0.55rem;
		border-radius: 999px;
		background: var(--bg-surface);
		border: 1px solid var(--border-soft);
		color: var(--text-muted);
		font-size: 0.75rem;
	}

	.match-card__actions,
	.proposal-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.65rem;
	}

	.proposal-head__flags,
	.proposal-toolbar__left {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.proposal-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.field {
		display: grid;
		gap: 0.35rem;
		color: var(--text-secondary);
		font-size: 0.82rem;
	}

	.field span {
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.field input,
	.field select,
	.field textarea,
	.select-chip select {
		width: 100%;
		border: 1px solid var(--border-soft);
		border-radius: 0.85rem;
		background: var(--bg-surface);
		color: var(--text-primary);
		font: inherit;
		padding: 0.72rem 0.8rem;
		transition:
			border-color 150ms ease,
			box-shadow 150ms ease,
			background 150ms ease;
	}

	.field input:focus,
	.field select:focus,
	.field textarea:focus,
	.select-chip select:focus,
	.composer-input:focus {
		outline: none;
		border-color: color-mix(in srgb, var(--accent-strong) 70%, var(--border-soft));
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-strong) 16%, transparent);
	}

	.field textarea {
		resize: vertical;
		min-height: 9rem;
	}

	.field--body,
	.field--select {
		grid-column: 1 / -1;
	}

	.preview-pane {
		border-radius: 1rem;
		border: 1px solid var(--border-soft);
		background: var(--bg-surface);
		padding: 1rem;
		color: var(--text-primary);
	}

	.preview-pane :global(p) {
		margin: 0 0 0.9rem;
		line-height: 1.65;
	}

	.preview-pane :global(p:last-child) {
		margin-bottom: 0;
	}

	.preview-pane :global(.wikilink) {
		color: var(--accent-green-muted);
	}

	.preview-pane :global(.wikilink-broken) {
		color: var(--accent-red);
		text-decoration: line-through;
	}

	.preview-empty {
		margin: 0;
		color: var(--text-muted);
	}

	.linked-patches {
		display: grid;
		gap: 0.45rem;
		padding-top: 0.35rem;
		border-top: 1px solid var(--border-soft);
	}

	.linked-patches__list {
		margin: 0;
		padding-left: 1.15rem;
		display: grid;
		gap: 0.2rem;
		color: var(--text-secondary);
		font-size: 0.85rem;
	}

	.commit-success {
		color: var(--accent-green);
		font-weight: 600;
	}

	.commit-success a {
		color: inherit;
		text-decoration: none;
	}

	.commit-error {
		color: var(--accent-red);
		font-weight: 600;
	}

	.proposal-panel--delete {
		background: color-mix(in srgb, var(--accent-red) 8%, var(--bg-raised));
	}

	.primary-btn,
	.danger-btn,
	.ghost-btn,
	.send-btn,
	.override-btn {
		border: 1px solid var(--border-soft);
		border-radius: 999px;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
		transition:
			transform 150ms ease,
			border-color 150ms ease,
			background 150ms ease,
			color 150ms ease;
	}

	.primary-btn,
	.danger-btn,
	.send-btn {
		padding: 0.8rem 1rem;
		background: var(--accent-strong);
		color: var(--bg-base);
	}

	.danger-btn {
		background: color-mix(in srgb, var(--accent-red) 78%, var(--bg-surface));
		color: white;
	}

	.ghost-btn,
	.override-btn {
		padding: 0.55rem 0.8rem;
		background: var(--bg-surface);
		color: var(--text-secondary);
		text-decoration: none;
	}

	.ghost-btn--link {
		display: inline-flex;
		align-items: center;
	}

	.primary-btn:hover,
	.danger-btn:hover,
	.ghost-btn:hover,
	.send-btn:hover,
	.override-btn:hover {
		transform: translateY(-1px);
		border-color: var(--border-strong);
	}

	.override-btn--active {
		background: color-mix(in srgb, var(--accent-soft) 30%, var(--bg-surface));
		color: var(--accent-primary);
		border-color: color-mix(in srgb, var(--accent-strong) 40%, var(--border-soft));
	}

	.danger-btn:disabled,
	.primary-btn:disabled,
	.send-btn:disabled,
	.override-btn:disabled {
		cursor: not-allowed;
		opacity: 0.65;
		transform: none;
	}

	.composer-dock {
		display: grid;
		gap: 0.85rem;
		padding: 1rem;
		border-radius: 1.25rem;
		border: 1px solid var(--border-soft);
		background:
			linear-gradient(180deg, color-mix(in srgb, var(--bg-raised) 84%, transparent), var(--bg-surface)),
			var(--bg-surface);
		box-shadow: 0 12px 40px rgb(0 0 0 / 0.1);
	}

	.composer-topline {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.composer-selects {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.select-chip {
		display: grid;
		gap: 0.35rem;
		min-width: 11rem;
		color: var(--text-muted);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.select-chip select {
		padding-block: 0.7rem;
		text-transform: none;
		letter-spacing: normal;
	}

	.override-group {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.composer-context {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.84rem;
	}

	.composer-context a {
		color: var(--accent-primary);
		text-decoration: none;
	}

	.note-select-row {
		display: grid;
	}

	.composer-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.75rem;
		align-items: end;
	}

	.composer-input {
		width: 100%;
		min-height: 5.5rem;
		padding: 0.9rem 0.95rem;
		border-radius: 1rem;
		border: 1px solid var(--border-soft);
		background: var(--bg-surface);
		color: var(--text-primary);
		font: inherit;
		resize: vertical;
	}

	.loading-row {
		display: inline-flex;
		align-items: center;
		gap: 0.65rem;
		color: var(--text-muted);
		font-size: 0.88rem;
	}

	.loading-dots {
		display: inline-flex;
		gap: 0.25rem;
	}

	.loading-dots span {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 999px;
		background: var(--accent-primary);
		animation: pulse 1.1s infinite ease-in-out;
	}

	.loading-dots span:nth-child(2) {
		animation-delay: 0.15s;
	}

	.loading-dots span:nth-child(3) {
		animation-delay: 0.3s;
	}

	@keyframes pulse {
		0%,
		80%,
		100% {
			transform: scale(0.75);
			opacity: 0.45;
		}
		40% {
			transform: scale(1);
			opacity: 1;
		}
	}

	@media (max-width: 960px) {
		.chat-header {
			align-items: start;
			flex-direction: column;
		}

		.chat-summary {
			justify-content: flex-start;
		}

		.empty-notes,
		.proposal-grid {
			grid-template-columns: 1fr;
		}

		.composer-row {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 680px) {
		.chat-page {
			min-height: auto;
		}

		.chat-shell,
		.conversation-column {
			min-height: auto;
		}

		.message-bubble,
		.assistant-panel,
		.empty-state,
		.composer-dock {
			padding: 0.9rem;
		}

		.composer-selects,
		.override-group,
		.match-card__actions,
		.proposal-toolbar {
			flex-direction: column;
			align-items: stretch;
		}

		.select-chip {
			min-width: 0;
		}
	}
</style>
