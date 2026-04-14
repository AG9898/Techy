<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { RadioGroup as MeltRadioGroup, Select as MeltSelect } from 'melt/builders';
	import { marked } from 'marked';
	import type { PageData } from './$types.js';
	import { loadGsap, prefersReducedMotion } from '$lib/client/motion';
	import { resolveWikilinks } from '$lib/utils/wikilinks.js';
	import { CANONICAL_NOTE_CATEGORIES } from '$lib/utils/note-taxonomy.js';

	type ProviderId = PageData['providers'][number]['id'];
	type AssistantMode = 'chat' | 'create' | 'update';
	type ComposerModeValue = 'auto' | 'create' | 'update';
	type NoteStatus = 'stub' | 'growing' | 'mature';
	type AssistantMessageInput = { role: 'user' | 'assistant'; content: string };
	type SubmitMessageOptions = { override?: AssistantMode | null; noteId?: string };
	type AssistantRequestBody = {
		messages: AssistantMessageInput[];
		provider: ProviderId;
		model: string;
		topicCache: Record<string, unknown>;
		conversationId?: string;
		override?: AssistantMode;
		noteId?: string;
	};

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

	interface CreateOffer {
		topic: string;
		prompt: string;
		label: string;
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
		createOffer: CreateOffer | null;
		routing: RoutingState | null;
	}

	interface SavedConversation {
		id: string;
		title: string | null;
		createdAt: Date | string;
		updatedAt: Date | string;
	}

	interface SavedConversationMessage {
		id: string;
		role: 'user' | 'assistant';
		content: string;
		createdAt: Date | string;
	}

	type ChatPageData = Omit<PageData, 'conversations' | 'conversation' | 'messages'> & {
		conversations?: SavedConversation[];
		conversation?: SavedConversation | null;
		messages?: SavedConversationMessage[];
	};

	type DisplayMessage = UserMessage | AssistantMessage;
	type ElementRefMap<T extends HTMLElement = HTMLElement> = Map<string, T>;

	const { data }: { data: ChatPageData } = $props();

	let selectedProvider = $state<ProviderId>(
		untrack(() => data.defaultProvider as ProviderId)
	);
	let selectedModel = $state(untrack(() => data.defaultModel));
	let overrideMode = $state<AssistantMode | null>(null);
	let selectedNoteId = $state('');
	let composerValue = $state('');
	let isLoading = $state(false);
	let topicCache = $state<Record<string, unknown>>({});
	let activeConversationId = $state(untrack(() => data.conversation?.id ?? ''));
	let isHistoryDrawerOpen = $state(false);
	let isNotebookOpen = $state(false);
	let conversationHistory = $state<AssistantMessageInput[]>(
		untrack(() => savedMessagesToHistory(data.messages ?? []))
	);
	let displayMessages = $state<DisplayMessage[]>(
		untrack(() => savedMessagesToDisplayMessages(data.messages ?? []))
	);
	let commitStates = $state<Record<string, CommitState>>({});
	let compactSuccessStates = $state<Record<string, boolean>>({});
	let draftStates = $state<Record<string, DraftEditorState>>({});
	let conversationEl: HTMLDivElement | null = null;
	let composerControlsEl: HTMLDivElement | null = null;
	let messageCounter = untrack(() => data.messages?.length ?? 0);
	let didMount = false;
	let lastAnimatedComposerMode: ComposerModeValue = 'auto';
	let cleanupComposerModeAnimation: (() => void) | null = null;
	let isSettingsOpen = $state(false);
	let settingsDialogEl: HTMLDialogElement | null = null;

	const assistantPanelRefs: ElementRefMap<HTMLDivElement> = new Map();
	const proposalPanelRefs: ElementRefMap<HTMLDivElement> = new Map();
	const previewPaneRefs: ElementRefMap<HTMLDivElement> = new Map();
	const commitFeedbackRefs: ElementRefMap<HTMLElement> = new Map();

	const modeOptions: Array<{ value: ComposerModeValue; label: string; icon: string }> = [
		{ value: 'auto', label: 'Auto', icon: 'A' },
		{ value: 'create', label: 'Create', icon: '+' },
		{ value: 'update', label: 'Update', icon: '↻' }
	];

	const composerMode: ComposerModeValue = $derived(
		overrideMode === 'create' || overrideMode === 'update' ? overrideMode : 'auto'
	);

	const modeRadioGroup = new MeltRadioGroup({
		value: () => composerMode,
		orientation: 'horizontal',
		name: 'assistant-mode',
		onValueChange: (value) => {
			const nextMode = value as ComposerModeValue;
			setOverride(nextMode === 'auto' ? null : nextMode);
		}
	});

	const providerSelect = new MeltSelect<ProviderId>({
		value: () => selectedProvider,
		onValueChange: (value) => {
			if (!value) return;
			selectedProvider = value;
			handleProviderChange();
		}
	});

	const modelSelect = new MeltSelect<string>({
		value: () => selectedModel,
		onValueChange: (value) => {
			if (!value) return;
			selectedModel = value;
		}
	});

	const noteTargetSelect = new MeltSelect<string>({
		value: () => selectedNoteId,
		onValueChange: (value) => {
			selectedNoteId = value ?? '';
		}
	});

	const currentProviderModels = $derived(
		data.providers.find((provider) => provider.id === selectedProvider)?.models ?? []
	);

	let savedConversations = $state<SavedConversation[]>(untrack(() => data.conversations ?? []));
	const hasSavedConversations = $derived(savedConversations.length > 0);
	const selectedNote = $derived.by(() => data.notes.find((note) => note.id === selectedNoteId) ?? null);
	const isComposerEmpty = $derived(composerValue.trim().length === 0);
	const isUpdateTargetMissing = $derived(overrideMode === 'update' && !selectedNoteId);
	const isSendDisabled = $derived(isComposerEmpty || isLoading || isUpdateTargetMissing);
	const sendButtonLabel = $derived.by(() => {
		if (isLoading) return 'Sending message';
		if (isUpdateTargetMissing) return 'Select a note before sending';
		if (isComposerEmpty) return 'Enter a message before sending';
		return 'Send message';
	});
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

	onMount(() => {
		didMount = true;

		function handleKeydown(event: KeyboardEvent) {
			if (event.key === 'Escape') isNotebookOpen = false;
		}
		function handleToggleNotebook() {
			isNotebookOpen = !isNotebookOpen;
		}
		window.addEventListener('keydown', handleKeydown);
		window.addEventListener('techy:toggle-notebook', handleToggleNotebook);

		return () => {
			cleanupComposerModeAnimation?.();
			window.removeEventListener('keydown', handleKeydown);
			window.removeEventListener('techy:toggle-notebook', handleToggleNotebook);
		};
	});

	$effect(() => {
		const nextMode = composerMode;
		const root = composerControlsEl;

		if (!didMount || !root) {
			lastAnimatedComposerMode = nextMode;
			return;
		}

		if (nextMode === lastAnimatedComposerMode) return;

		lastAnimatedComposerMode = nextMode;
		let cancelled = false;
		cleanupComposerModeAnimation?.();
		cleanupComposerModeAnimation = null;

		void animateComposerModeChange(root, nextMode).then((cleanup) => {
			if (cancelled) {
				cleanup?.();
				return;
			}

			cleanupComposerModeAnimation = cleanup;
		});

		return () => {
			cancelled = true;
			cleanupComposerModeAnimation?.();
			cleanupComposerModeAnimation = null;
		};
	});

	$effect(() => {
		const el = settingsDialogEl;
		const open = isSettingsOpen;
		if (!el) return;
		if (open) {
			if (!el.open) el.showModal();
		} else {
			if (el.open) el.close();
		}
	});

	function bindElementToMap<T extends HTMLElement>(
		node: T,
		params: { id: string; map: ElementRefMap<T> }
	) {
		let current = params;
		current.map.set(current.id, node);

		return {
			update(next: typeof current) {
				if (next.id === current.id && next.map === current.map) return;

				current.map.delete(current.id);
				next.map.set(next.id, node);
				current = next;
			},
			destroy() {
				current.map.delete(current.id);
			}
		};
	}

	function nextMessageId(prefix: string): string {
		messageCounter += 1;
		return `${prefix}-${messageCounter}`;
	}

	function savedMessagesToHistory(messages: SavedConversationMessage[]): AssistantMessageInput[] {
		return messages.map((message) => ({
			role: message.role,
			content: message.content
		}));
	}

	function savedMessagesToDisplayMessages(messages: SavedConversationMessage[]): DisplayMessage[] {
		return messages.map((message) => {
			if (message.role === 'user') {
				return {
					id: message.id,
					role: 'user',
					content: message.content
				};
			}

			return {
				id: message.id,
				role: 'assistant',
				content: message.content,
				citations: [],
				proposal: null,
				createOffer: null,
				routing: null
			};
		});
	}

	/**
	 * Returns the most recent `maxExchanges` complete user+assistant exchange pairs from
	 * `messages`. A complete exchange is one user message immediately followed by one
	 * assistant message. Any trailing message that does not form a complete pair is
	 * excluded so the slice is always pair-safe.
	 */
	function sliceLastExchanges(
		messages: AssistantMessageInput[],
		maxExchanges = 5
	): AssistantMessageInput[] {
		const pairs: [AssistantMessageInput, AssistantMessageInput][] = [];
		let i = 0;
		while (i < messages.length - 1) {
			if (messages[i].role === 'user' && messages[i + 1].role === 'assistant') {
				pairs.push([messages[i], messages[i + 1]]);
				i += 2;
			} else {
				i++;
			}
		}
		return pairs.slice(-maxExchanges).flat();
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

	function renderAssistantContent(content: string): string {
		const resolved = resolveWikilinks(content, noteSlugMap);
		return marked.parse(resolved) as string;
	}

	function primaryCitations(citations: Citation[]): Citation[] {
		return citations.slice(0, 3);
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

	function currentProviderLabel(): string {
		return data.providers.find((provider) => provider.id === selectedProvider)?.label ?? 'Provider';
	}

	function currentModelLabel(): string {
		return currentProviderModels.find((model) => model.id === selectedModel)?.label ?? 'Model';
	}

	function currentNoteTargetLabel(): string {
		return selectedNote?.title ?? 'Select a saved note';
	}

	function canSubmitAssistantMessage(
		content: string,
		requestOverride: AssistantMode | null,
		requestNoteId: string
	): boolean {
		if (!content || isLoading) return false;
		return requestOverride !== 'update' || Boolean(requestNoteId);
	}

	function buildAssistantRequestBody(
		messages: AssistantMessageInput[],
		options: SubmitMessageOptions
	): AssistantRequestBody {
		const requestOverride = options.override ?? null;
		const requestNoteId = options.noteId ?? '';
		// Window prior exchanges to the last 5, then re-append the current user turn.
		const currentTurn = messages[messages.length - 1];
		const priorHistory = messages.slice(0, -1);
		const replayMessages = [...sliceLastExchanges(priorHistory), currentTurn];
		const body: AssistantRequestBody = {
			messages: replayMessages,
			provider: selectedProvider,
			model: selectedModel,
			topicCache
		};

		if (requestOverride) {
			body.override = requestOverride;
		}

		if (requestOverride === 'update' && requestNoteId) {
			body.noteId = requestNoteId;
		}

		if (activeConversationId) {
			body.conversationId = activeConversationId;
		}

		return body;
	}

	function noteCardLabel(note: ChatNote): string {
		const category = note.category ? note.category : 'Uncategorised';
		return `${category} · ${note.status}`;
	}

	function conversationTitle(conversation: SavedConversation): string {
		return conversation.title?.trim() || 'Untitled chat';
	}

	async function scrollToBottom() {
		await tick();
		if (conversationEl) conversationEl.scrollTop = conversationEl.scrollHeight;
	}

	async function animateAssistantMessage(messageId: string) {
		if (!didMount || prefersReducedMotion()) return;

		const panel = assistantPanelRefs.get(messageId);
		if (!panel) return;

		const gsap = await loadGsap();
		if (!gsap) return;

		const proposal = proposalPanelRefs.get(messageId);
		const timeline = gsap.timeline({
			defaults: { duration: 0.22, ease: 'power2.out' }
		});

		timeline.fromTo(
			panel,
			{ autoAlpha: 0, y: 14 },
			{ autoAlpha: 1, y: 0, clearProps: 'opacity,transform' }
		);

		if (proposal) {
			timeline.fromTo(
				proposal,
				{ autoAlpha: 0, y: 10, scale: 0.985 },
				{
					autoAlpha: 1,
					y: 0,
					scale: 1,
					duration: 0.2,
					clearProps: 'opacity,transform'
				},
				0.06
			);
		}
	}

	async function animateCommitState(messageId: string, status: CommitState['status']) {
		if (prefersReducedMotion()) return;

		const gsap = await loadGsap();
		if (!gsap) return;

		const proposal = proposalPanelRefs.get(messageId);
		if (!proposal) return;

		if (status === 'pending') {
			gsap.fromTo(
				proposal,
				{ scale: 1 },
				{
					scale: 0.992,
					duration: 0.12,
					repeat: 1,
					yoyo: true,
					ease: 'power1.inOut',
					clearProps: 'transform'
				}
			);
			return;
		}

		const feedback = commitFeedbackRefs.get(messageId);
		if (!feedback) return;

		gsap.fromTo(
			feedback,
			{ autoAlpha: 0, y: 8 },
			{ autoAlpha: 1, y: 0, duration: 0.18, ease: 'power2.out', clearProps: 'opacity,transform' }
		);
	}

	async function animateComposerModeChange(root: HTMLElement, mode: ComposerModeValue) {
		if (prefersReducedMotion()) return null;

		const gsap = await loadGsap();
		if (!gsap) return null;

		const ctx = gsap.context(() => {
			const activeButton = root.querySelector<HTMLElement>(`[data-mode-value="${mode}"]`);
			if (!activeButton) return;

			const activeIcon = activeButton.querySelector<HTMLElement>('.mode-pill__icon');
			const activeLabel = activeButton.querySelector<HTMLElement>('.mode-pill__label');
			const inactiveLabels = Array.from(
				root.querySelectorAll<HTMLElement>(`.mode-pill:not([data-mode-value="${mode}"]) .mode-pill__label`)
			);
			const targets = [activeButton, activeIcon, activeLabel, ...inactiveLabels].filter(
				Boolean
			) as HTMLElement[];

			gsap.killTweensOf(targets);

			if (inactiveLabels.length) {
				gsap.to(inactiveLabels, {
					maxWidth: 0,
					autoAlpha: 0,
					duration: 0.14,
					ease: 'power2.out',
					clearProps: 'opacity,visibility'
				});
			}

			if (activeLabel) {
				gsap.fromTo(
					activeLabel,
					{ maxWidth: 0, autoAlpha: 0 },
					{
						maxWidth: activeLabel.scrollWidth,
						autoAlpha: 1,
						duration: 0.2,
						ease: 'power2.out',
						clearProps: 'max-width,opacity,visibility'
					}
				);
			}

			if (activeIcon) {
				gsap.fromTo(
					activeIcon,
					{ scale: 0.9, rotate: -8 },
					{
						scale: 1,
						rotate: 0,
						duration: 0.18,
						ease: 'back.out(2)',
						clearProps: 'transform'
					}
				);
			}

			gsap.fromTo(
				activeButton,
				{ scale: 0.985 },
				{ scale: 1, duration: 0.18, ease: 'power2.out', clearProps: 'transform' }
			);
		}, root);

		return () => ctx.revert();
	}

	async function collapseCreateProposal(messageId: string) {
		if (compactSuccessStates[messageId]) return;

		if (prefersReducedMotion()) {
			compactSuccessStates = { ...compactSuccessStates, [messageId]: true };
			await tick();
			void animateCommitState(messageId, 'done');
			return;
		}

		const proposal = proposalPanelRefs.get(messageId);
		const gsap = await loadGsap();

		if (proposal && gsap) {
			gsap.killTweensOf(proposal);
			await new Promise<void>((resolve) => {
				gsap.to(proposal, {
					height: 0,
					autoAlpha: 0,
					y: -10,
					overflow: 'hidden',
					duration: 0.2,
					ease: 'power2.in',
					onComplete: resolve
				});
			});
		}

		compactSuccessStates = { ...compactSuccessStates, [messageId]: true };
		await tick();
		void animateCommitState(messageId, 'done');
	}

	async function toggleDraftPreview(messageId: string, draftState: DraftEditorState) {
		const shouldOpen = !draftState.showPreview;

		if (shouldOpen) {
			draftState.showPreview = true;
			await tick();

			if (prefersReducedMotion()) return;

			const pane = previewPaneRefs.get(messageId);
			if (!pane) return;

			const gsap = await loadGsap();
			if (!gsap) return;

			gsap.killTweensOf(pane);
			gsap.fromTo(
				pane,
				{ height: 0, autoAlpha: 0, y: -8, overflow: 'hidden' },
				{
					height: 'auto',
					autoAlpha: 1,
					y: 0,
					duration: 0.2,
					ease: 'power2.out',
					clearProps: 'height,opacity,transform,overflow'
				}
			);
			return;
		}

		if (prefersReducedMotion()) {
			draftState.showPreview = false;
			return;
		}

		const pane = previewPaneRefs.get(messageId);
		if (!pane) {
			draftState.showPreview = false;
			return;
		}

		const gsap = await loadGsap();
		if (!gsap) {
			draftState.showPreview = false;
			return;
		}

		gsap.killTweensOf(pane);
		await new Promise<void>((resolve) => {
			gsap.to(pane, {
				height: 0,
				autoAlpha: 0,
				y: -8,
				overflow: 'hidden',
				duration: 0.16,
				ease: 'power2.in',
				onComplete: resolve
			});
		});
		draftState.showPreview = false;
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
		await tick();
		void animateCommitState(messageId, 'pending');

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
					if (payload.type === 'create_note') {
						await collapseCreateProposal(messageId);
					} else {
						await tick();
						void animateCommitState(messageId, 'done');
					}
					return;
				}

			const error = (body as { error?: string }).error ?? 'Commit failed';
			commitStates = { ...commitStates, [messageId]: { status: 'error', error } };
			await tick();
			void animateCommitState(messageId, 'error');
		} catch {
			commitStates = {
				...commitStates,
				[messageId]: { status: 'error', error: 'Network error' }
			};
			await tick();
			void animateCommitState(messageId, 'error');
		}
	}

	function mergeConversationIntoList(conv: { id: string; title: string | null; updatedAt: string }) {
		const existingIndex = savedConversations.findIndex((c) => c.id === conv.id);
		const merged: SavedConversation = {
			id: conv.id,
			title: conv.title,
			createdAt: existingIndex >= 0 ? savedConversations[existingIndex].createdAt : conv.updatedAt,
			updatedAt: conv.updatedAt
		};
		const without = existingIndex >= 0
			? savedConversations.filter((_, i) => i !== existingIndex)
			: [...savedConversations];
		savedConversations = [merged, ...without];
	}

	async function submitMessage(content: string, options: SubmitMessageOptions = {}) {
		const trimmedContent = content.trim();
		const requestOverride = options.override ?? null;
		const requestNoteId = options.noteId ?? '';

		if (!canSubmitAssistantMessage(trimmedContent, requestOverride, requestNoteId)) return;

		const userMessage: UserMessage = {
			id: nextMessageId('user'),
			role: 'user',
			content: trimmedContent
		};

		const nextConversationHistory = [...conversationHistory, { role: 'user' as const, content: trimmedContent }];

		displayMessages = [...displayMessages, userMessage];
		conversationHistory = nextConversationHistory;
		isLoading = true;
		await scrollToBottom();

		try {
			const body = buildAssistantRequestBody(nextConversationHistory, options);

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
				const createOffer: CreateOffer | null = data.createOffer ?? null;
				const routing: RoutingState | null = data.routing ?? null;
				const responseConversationId: string | undefined = data.conversationId;
				const assistantMessage: AssistantMessage = {
					id: nextMessageId('assistant'),
					role: 'assistant',
					content: assistantContent,
					citations,
					proposal,
					createOffer,
					routing
				};

				if (data.topicCache && typeof data.topicCache === 'object') {
					topicCache = data.topicCache as Record<string, unknown>;
				}

				if (responseConversationId) {
					activeConversationId = responseConversationId;
				}

				if (data.conversation && typeof data.conversation === 'object') {
					mergeConversationIntoList(data.conversation as { id: string; title: string | null; updatedAt: string });
				}

				displayMessages = [...displayMessages, assistantMessage];
				conversationHistory = [
					...nextConversationHistory,
					{ role: 'assistant', content: assistantContent }
				];

				if (
					(assistantMessage.proposal?.type === 'create_note' ||
						assistantMessage.proposal?.type === 'update_note') &&
					assistantMessage.proposal.draft
				) {
					registerProposalDraft(assistantMessage.id, assistantMessage.proposal);
				}

				await tick();
				void animateAssistantMessage(assistantMessage.id);
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
						createOffer: null,
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
					createOffer: null,
					routing: null
				}
			];
		}

		isLoading = false;
		await scrollToBottom();
	}

	async function sendMessage() {
		const content = composerValue.trim();
		if (isSendDisabled) return;

		composerValue = '';
		await submitMessage(content, {
			override: overrideMode,
			noteId: overrideMode === 'update' ? selectedNoteId : undefined
		});
	}

	async function triggerCreateOffer(createOffer: CreateOffer) {
		await submitMessage(createOffer.prompt, { override: 'create' });
	}

	function openSettings() {
		isSettingsOpen = true;
	}

	function closeSettings() {
		isSettingsOpen = false;
	}
</script>

<svelte:head>
	<title>Chat — Techy</title>
</svelte:head>

<div class="chat-page">
	<div class="history-mobile">
		<details class="history-drawer" bind:open={isHistoryDrawerOpen}>
			<summary>
				<span>Recent chats</span>
				<span class="history-drawer__count">{savedConversations.length}</span>
			</summary>
			<div class="history-drawer__body">
				<a class="history-new history-new--mobile" href="/chat" onclick={() => (isHistoryDrawerOpen = false)}>
					<span>New chat</span>
					<span aria-hidden="true">+</span>
				</a>
				{#if hasSavedConversations}
					<nav class="history-list" aria-label="Saved conversations">
						{#each savedConversations as conversation}
							<a
								class="history-item"
								class:history-item--active={conversation.id === activeConversationId}
								href={`/chat/${conversation.id}`}
								aria-current={conversation.id === activeConversationId ? 'page' : undefined}
								onclick={() => (isHistoryDrawerOpen = false)}
							>
								<span class="history-item__title">{conversationTitle(conversation)}</span>
								<span class="history-item__time">{formatRelativeTime(conversation.updatedAt)}</span>
							</a>
						{/each}
					</nav>
				{:else}
					<p class="history-empty">Saved chats will collect here after the first reply.</p>
				{/if}
			</div>
		</details>
	</div>

	<div class="chat-shell">
		{#if isNotebookOpen}
			<div
				class="notebook-backdrop"
				role="presentation"
				aria-hidden="true"
				onclick={() => (isNotebookOpen = false)}
			></div>
		{/if}

		<aside
			id="notebook-overlay"
			class="notebook-overlay"
			class:notebook-overlay--open={isNotebookOpen}
			aria-label="Notebook index"
			aria-hidden={!isNotebookOpen}
			inert={!isNotebookOpen}
		>
			<div class="notebook-overlay__head">
				<div>
					<p>Notebook index</p>
					<h2>Recent</h2>
				</div>
				<div class="notebook-overlay__head-controls">
					<a class="history-new" href="/chat" aria-label="Start a new chat">
						<span aria-hidden="true">+</span>
					</a>
					<button
						type="button"
						class="notebook-close-btn"
						onclick={() => (isNotebookOpen = false)}
						aria-label="Close notebook index"
					>✕</button>
				</div>
			</div>

			{#if hasSavedConversations}
				<nav class="history-list" aria-label="Saved conversations">
					{#each savedConversations as conversation}
						<a
							class="history-item"
							class:history-item--active={conversation.id === activeConversationId}
							href={`/chat/${conversation.id}`}
							aria-current={conversation.id === activeConversationId ? 'page' : undefined}
							onclick={() => (isNotebookOpen = false)}
						>
							<span class="history-item__title">{conversationTitle(conversation)}</span>
							<span class="history-item__time">{formatRelativeTime(conversation.updatedAt)}</span>
						</a>
					{/each}
				</nav>
			{:else}
				<p class="history-empty">Saved chats will collect here after the first reply.</p>
			{/if}
		</aside>

		<section class="chat-main" aria-label="Active conversation">
			<div class="chat-topbar">
				<button
					type="button"
					class="notebook-toggle-btn"
					aria-expanded={isNotebookOpen}
					aria-controls="notebook-overlay"
					onclick={() => (isNotebookOpen = !isNotebookOpen)}
				>
					<span class="notebook-toggle-btn__icon" aria-hidden="true">≡</span>
					<span>Notebook</span>
				</button>
			</div>
			<div class="conversation-stream" class:conversation-stream--empty={displayMessages.length === 0} bind:this={conversationEl} aria-label="Conversation">
				{#if displayMessages.length === 0}
					<div class="empty-stage">
						<p class="empty-brand">Techy</p>
						<h1>New chat</h1>
						<p class="empty-copy">This thread is empty. Start here or reopen a saved chat from Recent.</p>
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
								<div
									class="assistant-panel"
									use:bindElementToMap={{ id: msg.id, map: assistantPanelRefs }}
								>
							<div class="message-meta">
								<span class="message-role">Assistant</span>
								{#if msg.routing}
									{#if msg.routing.resolvedMode !== 'chat'}
										<span class="meta-pill">{modeLabel(msg.routing.resolvedMode)}</span>
									{/if}
									{#if msg.routing.overrideSource !== 'none'}
										<span class="meta-pill meta-pill--accent">
											{msg.routing.overrideSource === 'override' ? 'Manual override' : 'Legacy mode'}
										</span>
									{/if}
								{/if}
							</div>

							<div class="assistant-copy">
								{@html renderAssistantContent(msg.content)}
							</div>

									{#if msg.citations.length}
										<details class="citation-disclosure">
											<summary>
												Sources
												<span class="citation-count">{primaryCitations(msg.citations).length}</span>
											</summary>
											<div class="citation-row" aria-label="Assistant citations">
												{#each primaryCitations(msg.citations) as citation}
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
										</details>
									{/if}

							{#if msg.createOffer}
								<div class="create-offer-card">
									<div>
										<p class="create-offer__eyebrow">Save this topic</p>
										<h3>{msg.createOffer.topic}</h3>
										<p class="create-offer__body">
											Open a structured draft for review without leaving the conversation.
										</p>
									</div>
									<button
										type="button"
										class="primary-btn"
										disabled={isLoading}
										onclick={() => triggerCreateOffer(msg.createOffer!)}
									>
										{msg.createOffer.label}
									</button>
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
									{@const showCompactCreateSuccess =
										msg.proposal.type === 'create_note' &&
										commitState?.status === 'done' &&
										commitState.note &&
										compactSuccessStates[msg.id]}
									{#if showCompactCreateSuccess}
										{@const successfulNote = commitState?.note}
										<div
											class="commit-card"
											use:bindElementToMap={{ id: msg.id, map: commitFeedbackRefs }}
										>
											<p class="commit-card__eyebrow">Create note complete</p>
											{#if successfulNote}
												<p class="commit-success">
													Saved
													<a href={`/notes/${successfulNote.slug}`}>{successfulNote.title}</a>
												</p>
											{/if}
										</div>
									{:else}
										<div
											class="proposal-panel"
											use:bindElementToMap={{ id: msg.id, map: proposalPanelRefs }}
										>
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
												<details class="citation-disclosure citation-disclosure--proposal">
													<summary>
														Sources
														<span class="citation-count">{primaryCitations(msg.citations).length}</span>
													</summary>
													<div class="citation-row citation-row--proposal">
														{#each primaryCitations(msg.citations) as citation}
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
												</details>
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
															onclick={() => toggleDraftPreview(msg.id, draftState)}
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
													<div
														class="preview-pane"
														use:bindElementToMap={{ id: msg.id, map: previewPaneRefs }}
													>
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
												<p
													class="commit-success"
													use:bindElementToMap={{ id: msg.id, map: commitFeedbackRefs }}
												>
													Saved
													<a href={`/notes/${commitState.note.slug}`}>{commitState.note.title}</a>
												</p>
											{:else if commitState?.status === 'error'}
												<p
													class="commit-error"
													use:bindElementToMap={{ id: msg.id, map: commitFeedbackRefs }}
												>
													{commitState.error}
												</p>
											{/if}
										</div>
									{/if}
								{:else if msg.proposal.type === 'delete_note'}
									<div
										class="proposal-panel proposal-panel--delete"
										use:bindElementToMap={{ id: msg.id, map: proposalPanelRefs }}
									>
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
											<p
												class="commit-success"
												use:bindElementToMap={{ id: msg.id, map: commitFeedbackRefs }}
											>
												Note deleted.
											</p>
										{:else if commitState?.status === 'error'}
											<p
												class="commit-error"
												use:bindElementToMap={{ id: msg.id, map: commitFeedbackRefs }}
											>
												{commitState.error}
											</p>
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

			<div class="composer-shell">
				<div class="composer-dock">
					<textarea
						class="composer-input"
						placeholder={overrideMode === 'create'
							? 'Describe the note you want drafted...'
							: overrideMode === 'update'
								? 'Ask to review, revise, or fix the selected note...'
								: 'Ask about your notes, request a draft, or start a review...'}
						rows="2"
						disabled={isLoading}
						bind:value={composerValue}
						onkeydown={(event) => {
							if (event.key === 'Enter' && !event.shiftKey) {
								event.preventDefault();
								sendMessage();
							}
						}}
					></textarea>

					<div class="composer-actions">
						<div class="composer-actions__left">
							<div class="mode-pill-group" bind:this={composerControlsEl} {...modeRadioGroup.root}>
								<span id={modeRadioGroup.ids.label} class="sr-only">Assistant mode</span>
								{#each modeOptions as option}
									{@const modeItem = modeRadioGroup.getItem(option.value)}
									<button
										type="button"
										class="mode-pill"
										class:mode-pill--active={modeItem.checked}
										data-mode-value={option.value}
										{...modeItem.attrs}
									>
										<span class="mode-pill__icon" aria-hidden="true">{option.icon}</span>
										<span class="mode-pill__label">{option.label}</span>
									</button>
								{/each}
								<input {...modeRadioGroup.hiddenInput} />
							</div>

							<div class="composer-divider" aria-hidden="true"></div>

							<button
								type="button"
								class="settings-trigger-btn"
								aria-label="Open assistant settings"
								aria-expanded={isSettingsOpen}
								aria-controls="settings-dialog"
								onclick={openSettings}
							>
								<span class="settings-trigger-btn__icon" aria-hidden="true">⚙</span>
								<span class="settings-trigger-btn__label">{currentModelLabel()}</span>
							</button>
						</div>

						<button
							type="button"
							class="send-btn"
							aria-label={sendButtonLabel}
							disabled={isSendDisabled}
							onclick={sendMessage}
						>
							<span aria-hidden="true">{isLoading ? '...' : '↑'}</span>
						</button>
					</div>

					{#if overrideMode === 'update'}
						<div class="note-select-row">
							<div class="select-wrap select-wrap--full">
								<button
									type="button"
									class="note-select-trigger"
									{...noteTargetSelect.trigger}
								>
									<span class="note-select-label">
										{#if selectedNote}
											Reviewing
										{:else}
											Review target
										{/if}
									</span>
									<span class="composer-select-value">{currentNoteTargetLabel()}</span>
									<span class="composer-select-chevron" aria-hidden="true">⌄</span>
								</button>
								<div class="composer-select-menu composer-select-menu--note" {...noteTargetSelect.content}>
									<div
										class="composer-select-option"
										class:composer-select-option--selected={noteTargetSelect.isSelected('')}
										{...noteTargetSelect.getOption('', 'Select a saved note')}
									>
										<span>Select a saved note</span>
									</div>
									{#each data.notes as note}
										<div
											class="composer-select-option composer-select-option--stacked"
											class:composer-select-option--selected={noteTargetSelect.isSelected(note.id)}
											{...noteTargetSelect.getOption(
												note.id,
												`${note.title}${note.category ? ` · ${note.category}` : ''} · ${note.status}`
											)}
										>
											<span>{note.title}</span>
											<span class="composer-select-meta">
												{note.category ? `${note.category} · ` : ''}{note.status}
											</span>
										</div>
									{/each}
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</section>
	</div>
</div>

<dialog
	id="settings-dialog"
	class="settings-dialog"
	bind:this={settingsDialogEl}
	onclose={closeSettings}
	onclick={(e) => { if (e.currentTarget === e.target) closeSettings(); }}
>
	<div class="settings-dialog__inner">
		<div class="settings-dialog__head">
			<h2>Assistant settings</h2>
			<button
				type="button"
				class="settings-close-btn"
				onclick={closeSettings}
				aria-label="Close settings"
			>✕</button>
		</div>

		<div class="settings-dialog__body">
			<div class="settings-section">
				<p class="settings-section__label">Provider</p>
				<div class="select-wrap">
					<button type="button" class="settings-select-trigger" {...providerSelect.trigger}>
						<span>{currentProviderLabel()}</span>
						<span class="composer-select-chevron" aria-hidden="true">⌄</span>
					</button>
					<div class="composer-select-menu" {...providerSelect.content}>
						{#each data.providers as provider}
							<div
								class="composer-select-option"
								class:composer-select-option--selected={providerSelect.isSelected(provider.id)}
								{...providerSelect.getOption(provider.id, provider.label)}
							>
								<span>{provider.label}</span>
								{#if providerSelect.isSelected(provider.id)}
									<span class="composer-select-check" aria-hidden="true">•</span>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			</div>

			<div class="settings-section">
				<p class="settings-section__label">Model</p>
				<div class="select-wrap">
					<button type="button" class="settings-select-trigger" {...modelSelect.trigger}>
						<span>{currentModelLabel()}</span>
						<span class="composer-select-chevron" aria-hidden="true">⌄</span>
					</button>
					<div class="composer-select-menu" {...modelSelect.content}>
						{#each currentProviderModels as model}
							<div
								class="composer-select-option"
								class:composer-select-option--selected={modelSelect.isSelected(model.id)}
								{...modelSelect.getOption(model.id, model.label)}
							>
								<span>{model.label}</span>
								{#if modelSelect.isSelected(model.id)}
									<span class="composer-select-check" aria-hidden="true">•</span>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>
</dialog>

<style>
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.chat-page {
		min-height: calc(100vh - 4rem);
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.chat-shell {
		position: relative;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 54rem;
		margin: 0 auto;
	}

	.chat-main {
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		flex: 1;
		gap: 1.25rem;
	}

	.history-mobile {
		display: none;
	}

	/* Notebook overlay (replaces permanent history rail) */
	.notebook-backdrop {
		position: absolute;
		inset: 0;
		z-index: 18;
		background: color-mix(in srgb, var(--bg-base) 20%, transparent);
	}

	.notebook-overlay {
		position: absolute;
		top: 0;
		left: 0;
		bottom: 0;
		width: 13.75rem;
		z-index: 20;
		display: grid;
		grid-template-rows: auto 1fr;
		gap: 0.85rem;
		overflow: hidden;
		padding: 0.6rem;
		border: 1px solid color-mix(in srgb, var(--border-soft) 78%, transparent);
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--bg-surface) 94%, transparent);
		backdrop-filter: blur(14px);
		box-shadow: 0 8px 32px rgb(0 0 0 / 0.16);
		transform: translateX(calc(-100% - 1rem));
		transition:
			transform 240ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
			visibility 240ms;
		visibility: hidden;
		pointer-events: none;
	}

	.notebook-overlay--open {
		transform: translateX(0);
		visibility: visible;
		pointer-events: auto;
	}

	.notebook-overlay__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.15rem 0.15rem 0.35rem;
		border-bottom: 1px solid color-mix(in srgb, var(--border-soft) 72%, transparent);
	}

	.notebook-overlay__head p {
		margin: 0;
		color: var(--text-subtle);
		font-size: 0.64rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.notebook-overlay__head h2 {
		margin: 0.12rem 0 0;
		color: var(--text-secondary);
		font-size: 0.92rem;
		line-height: 1.2;
	}

	.notebook-overlay__head-controls {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.notebook-close-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		border: 1px solid var(--border-soft);
		border-radius: 999px;
		background: transparent;
		color: var(--text-muted);
		font: inherit;
		font-size: 0.75rem;
		cursor: pointer;
		transition:
			border-color 150ms ease,
			background 150ms ease,
			color 150ms ease;
	}

	.notebook-close-btn:hover {
		border-color: var(--border-strong);
		background: color-mix(in srgb, var(--bg-raised) 60%, transparent);
		color: var(--text-primary);
	}

	/* Chat topbar with notebook toggle */
	.chat-topbar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.1rem 0 0.25rem;
	}

	.notebook-toggle-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.42rem;
		padding: 0.4rem 0.72rem;
		border: 1px solid var(--border-soft);
		border-radius: 999px;
		background: transparent;
		color: var(--text-muted);
		font: inherit;
		font-size: 0.75rem;
		font-weight: 700;
		cursor: pointer;
		transition:
			border-color 150ms ease,
			background 150ms ease,
			color 150ms ease;
	}

	.notebook-toggle-btn:hover,
	.notebook-toggle-btn[aria-expanded='true'] {
		border-color: color-mix(in srgb, var(--accent-strong) 40%, var(--border-soft));
		background: color-mix(in srgb, var(--accent-soft) 16%, var(--bg-raised));
		color: var(--accent-primary);
	}

	.notebook-toggle-btn__icon {
		font-size: 0.88rem;
		line-height: 1;
	}

	.history-new {
		display: inline-flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.45rem;
		min-height: 2rem;
		padding: 0.45rem 0.62rem;
		border: 1px solid var(--border-soft);
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--accent-soft) 18%, var(--bg-raised));
		color: var(--accent-primary);
		font-size: 0.82rem;
		font-weight: 700;
		text-decoration: none;
		transition:
			border-color 150ms ease,
			background 150ms ease,
			color 150ms ease;
	}

	.history-new:hover {
		border-color: var(--border-strong);
		color: var(--accent-strong);
	}

	.history-list {
		display: grid;
		gap: 0.22rem;
		overflow: auto;
		padding-right: 0.1rem;
	}

	.history-item {
		display: grid;
		gap: 0.2rem;
		padding: 0.58rem 0.62rem;
		border: 1px solid transparent;
		border-radius: 0.5rem;
		color: var(--text-muted);
		text-decoration: none;
		transition:
			background 150ms ease,
			border-color 150ms ease,
			color 150ms ease;
	}

	.history-item:hover,
	.history-item--active {
		border-color: color-mix(in srgb, var(--accent-strong) 24%, var(--border-soft));
		background: color-mix(in srgb, var(--accent-soft) 14%, var(--bg-raised));
		color: var(--text-primary);
	}

	.history-item__title {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.82rem;
		font-weight: 700;
		line-height: 1.25;
	}

	.history-item__time,
	.history-empty {
		color: var(--text-subtle);
		font-size: 0.72rem;
		line-height: 1.45;
	}

	.history-empty {
		margin: 0;
		padding: 0.2rem 0.15rem;
	}

	.history-drawer {
		border: 1px solid color-mix(in srgb, var(--border-soft) 78%, transparent);
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--bg-surface) 76%, transparent);
	}

	.history-drawer summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		min-height: 2.6rem;
		padding: 0.55rem 0.7rem;
		color: var(--text-secondary);
		font-size: 0.82rem;
		font-weight: 700;
		cursor: pointer;
		list-style: none;
	}

	.history-drawer summary::-webkit-details-marker {
		display: none;
	}

	.history-drawer summary::after {
		content: '⌄';
		color: var(--text-subtle);
		font-size: 0.72rem;
		transition: transform 150ms ease;
	}

	.history-drawer[open] summary::after {
		transform: rotate(180deg);
	}

	.history-drawer__count {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.5rem;
		padding: 0.12rem 0.42rem;
		border: 1px solid var(--border-soft);
		border-radius: 999px;
		color: var(--text-subtle);
		font-size: 0.72rem;
	}

	.history-drawer__body {
		display: grid;
		gap: 0.55rem;
		padding: 0 0.55rem 0.6rem;
	}

	.history-new--mobile {
		width: 100%;
	}

	.conversation-stream {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 1.15rem;
		overflow: auto;
		padding-right: 0.25rem;
		scrollbar-gutter: stable;
		max-width: 54rem;
		width: 100%;
		margin: 0 auto;
	}

	.conversation-stream--empty {
		justify-content: center;
	}

	.empty-stage {
		display: grid;
		place-items: center;
		gap: 0.45rem;
		min-height: 24vh;
		text-align: center;
		padding: 0.75rem 0 0.9rem;
	}

	.empty-brand {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text-subtle);
	}

	.empty-stage h1 {
		margin: 0;
		font-size: clamp(2rem, 4vw, 3.25rem);
		line-height: 1;
		color: var(--text-primary);
	}

	.empty-copy {
		max-width: 24rem;
		margin: 0;
		color: var(--text-muted);
		font-size: 0.9rem;
		line-height: 1.55;
	}

	.message {
		display: flex;
		flex-direction: column;
		max-width: 100%;
	}

	.message-bubble {
		max-width: 50rem;
		padding: 0.1rem 0;
		border-radius: 0;
		border: 1px solid var(--border-soft);
		border-width: 0 0 1px;
		background: transparent;
		box-shadow: none;
	}

	.message-bubble p,
	.proposal-note,
	.match-card__body,
	.commit-success,
	.commit-error {
		margin: 0;
		line-height: 1.6;
	}

	.message-bubble--user {
		margin-left: auto;
		padding: 0.8rem 0.95rem;
		border-width: 1px;
		border-color: color-mix(in srgb, var(--accent-strong) 16%, var(--border-soft));
		border-radius: 0.95rem;
		background: color-mix(in srgb, var(--accent-soft) 18%, var(--bg-surface));
		color: var(--text-primary);
	}

	.assistant-panel {
		display: grid;
		gap: 0.8rem;
		padding: 0.2rem 0 1rem;
		border-top: 1px solid var(--border-soft);
		border-radius: 0;
		background: transparent;
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
		color: var(--text-muted);
		background: transparent;
	}

	.meta-pill {
		padding: 0.3rem 0.55rem;
		background: color-mix(in srgb, var(--bg-raised) 60%, transparent);
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
		display: grid;
		gap: 0.75rem;
	}

	.assistant-copy :global(h1),
	.assistant-copy :global(h2),
	.assistant-copy :global(h3),
	.assistant-copy :global(h4) {
		margin: 0;
		color: var(--text-primary);
		line-height: 1.25;
	}

	.assistant-copy :global(h1) {
		font-size: 1.08rem;
	}

	.assistant-copy :global(h2) {
		font-size: 1rem;
	}

	.assistant-copy :global(h3),
	.assistant-copy :global(h4) {
		font-size: 0.92rem;
	}

	.assistant-copy :global(p),
	.assistant-copy :global(ul),
	.assistant-copy :global(ol),
	.assistant-copy :global(pre),
	.assistant-copy :global(blockquote) {
		margin: 0;
		line-height: 1.65;
	}

	.assistant-copy :global(ul),
	.assistant-copy :global(ol) {
		padding-left: 1.2rem;
		display: grid;
		gap: 0.25rem;
		color: var(--text-secondary);
	}

	.assistant-copy :global(li > p) {
		margin: 0;
	}

	.assistant-copy :global(strong) {
		color: var(--text-primary);
	}

	.assistant-copy :global(a),
	.assistant-copy :global(.wikilink) {
		color: var(--accent-primary);
		text-decoration: none;
	}

	.assistant-copy :global(.wikilink-broken) {
		color: var(--accent-red);
		text-decoration: line-through;
	}

	.assistant-copy :global(code) {
		padding: 0.1rem 0.32rem;
		border-radius: 0.4rem;
		background: color-mix(in srgb, var(--bg-raised) 72%, var(--bg-surface));
		border: 1px solid var(--border-soft);
		font-size: 0.84em;
	}

	.assistant-copy :global(pre) {
		overflow-x: auto;
		padding: 0.8rem 0.9rem;
		border-radius: 0.85rem;
		border: 1px solid var(--border-soft);
		background: var(--bg-surface);
	}

	.assistant-copy :global(pre code) {
		padding: 0;
		border: 0;
		background: transparent;
	}

	.assistant-copy :global(blockquote) {
		padding-left: 0.9rem;
		border-left: 2px solid var(--border-soft);
		color: var(--text-secondary);
	}

	.citation-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.citation-disclosure {
		display: grid;
		gap: 0.6rem;
	}

	.citation-disclosure summary {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		width: fit-content;
		cursor: pointer;
		list-style: none;
		color: var(--text-muted);
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.04em;
	}

	.citation-disclosure summary::-webkit-details-marker {
		display: none;
	}

	.citation-disclosure summary::before {
		content: '▸';
		font-size: 0.72rem;
		color: var(--text-subtle);
		transition: transform 150ms ease;
	}

	.citation-disclosure[open] summary::before {
		transform: rotate(90deg);
	}

	.citation-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		padding: 0.12rem 0.35rem;
		border-radius: 999px;
		border: 1px solid var(--border-soft);
		background: var(--bg-raised);
		color: var(--text-subtle);
		font-size: 0.72rem;
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
	.create-offer-card,
	.commit-card,
	.proposal-panel {
		display: grid;
		gap: 0.85rem;
		padding: 1rem;
		border-radius: 0.9rem;
		border: 1px solid var(--border-soft);
		background: color-mix(in srgb, var(--bg-raised) 72%, var(--bg-surface));
		box-shadow: none;
	}

	.match-card--target {
		background: color-mix(in srgb, var(--accent-soft) 18%, var(--bg-raised));
	}

	.create-offer-card {
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		background: color-mix(in srgb, var(--accent-soft) 16%, var(--bg-raised));
	}

	.commit-card {
		background: color-mix(in srgb, var(--accent-green) 9%, var(--bg-raised));
	}

	.match-card__head,
	.proposal-head {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.match-card__eyebrow,
	.create-offer__eyebrow,
	.commit-card__eyebrow,
	.proposal-eyebrow,
	.linked-patches__label {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-subtle);
	}

	.create-offer-card h3 {
		margin: 0.25rem 0 0;
		font-size: 0.98rem;
		color: var(--text-primary);
	}

	.create-offer__body {
		margin: 0.35rem 0 0;
		color: var(--text-secondary);
		line-height: 1.55;
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
		border-radius: 0.7rem;
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
		border-radius: 0.65rem;
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
	.field textarea {
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
		border-radius: 0.9rem;
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

	.composer-shell {
		width: 100%;
		max-width: 31.25rem;
		margin: 0 auto;
	}

	.composer-dock {
		display: grid;
		gap: 0.35rem;
		padding: 0.85rem 0.9rem 0.65rem;
		border-radius: 1.35rem;
		border: 1px solid var(--border-soft);
		background:
			linear-gradient(180deg, color-mix(in srgb, var(--bg-raised) 44%, transparent), var(--bg-surface)),
			var(--bg-surface);
		box-shadow: 0 12px 28px rgb(0 0 0 / 0.1);
	}

	.select-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		min-width: 0;
		padding: 0.18rem 0;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--text-muted);
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.select-chip--primary {
		padding-right: 0.4rem;
	}

	.select-chip--secondary {
		opacity: 0.78;
		padding-right: 0.35rem;
	}

	.select-chip span {
		white-space: nowrap;
	}

	.select-wrap {
		position: relative;
	}

	.select-wrap--full {
		width: 100%;
	}

	.composer-select-trigger,
	.note-select-trigger {
		display: inline-flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.3rem;
		min-width: 0;
		border: 0;
		background: transparent;
		color: var(--text-primary);
		font-size: 0.72rem;
		font-weight: 600;
		padding: 0;
		box-shadow: none;
		text-transform: none;
		letter-spacing: normal;
		cursor: pointer;
	}

	.composer-select-trigger:focus,
	.note-select-trigger:focus {
		outline: none;
	}

	.composer-select-trigger:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--accent-strong) 70%, transparent);
		outline-offset: 0.18rem;
		border-radius: 0.35rem;
	}

	.composer-select-value {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.composer-select-chevron {
		flex: 0 0 auto;
		font-size: 0.7rem;
		color: var(--text-subtle);
		transform: translateY(-0.02rem);
		transition: transform 150ms ease;
	}

	.select-chip:has([aria-expanded='true']) .composer-select-chevron,
	.note-select-trigger:has(+ [data-open]) .composer-select-chevron {
		transform: rotate(180deg);
	}

	.composer-select-menu {
		width: max-content;
		min-width: max(100%, 10.5rem);
		max-width: min(18rem, calc(100vw - 2rem));
		padding: 0.3rem;
		border: 1px solid var(--border-soft);
		border-radius: 0.95rem;
		background: color-mix(in srgb, var(--bg-overlay) 90%, var(--bg-surface));
		color: var(--text-primary);
		box-shadow: 0 18px 38px rgb(0 0 0 / 0.22);
		backdrop-filter: blur(10px);
		z-index: 40;
	}

	.composer-select-menu--note {
		width: 100%;
		min-width: 100%;
		max-width: min(100%, 32rem);
		max-height: min(20rem, 55vh);
		overflow: auto;
	}

	.composer-select-option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.55rem 0.65rem;
		border-radius: 0.72rem;
		color: var(--text-secondary);
		font-size: 0.84rem;
		cursor: pointer;
		transition:
			background 150ms ease,
			color 150ms ease;
	}

	.composer-select-option[data-highlighted],
	.composer-select-option:hover {
		background: color-mix(in srgb, var(--accent-soft) 24%, var(--bg-raised));
		color: var(--text-primary);
	}

	.composer-select-option--selected {
		background: color-mix(in srgb, var(--accent-soft) 18%, var(--bg-raised));
		color: var(--accent-primary);
	}

	.composer-select-option--stacked {
		display: grid;
		justify-content: stretch;
		gap: 0.18rem;
	}

	.composer-select-meta {
		color: var(--text-muted);
		font-size: 0.72rem;
	}

	.composer-select-check {
		flex: 0 0 auto;
		color: var(--accent-primary);
		font-size: 0.95rem;
		line-height: 1;
	}

	.select-chip--primary .composer-select-trigger {
		max-width: 8.75rem;
	}

	.select-chip--secondary .composer-select-trigger {
		max-width: 5.75rem;
		color: var(--text-secondary);
	}

	.select-chip:focus-within,
	.select-chip:has([aria-expanded='true']) {
		color: var(--text-primary);
	}

	.note-select-row {
		display: grid;
		padding-top: 0.35rem;
		border-top: 1px solid color-mix(in srgb, var(--border-soft) 72%, transparent);
	}

	.note-select-row .field {
		gap: 0.3rem;
		font-size: 0.76rem;
	}

	.note-select-row .field span {
		font-size: 0.64rem;
		letter-spacing: 0.08em;
	}

	.note-select-trigger {
		width: 100%;
		padding: 0.52rem 0.6rem;
		border: 1px solid var(--border-soft);
		border-radius: 0.75rem;
		background: color-mix(in srgb, var(--bg-raised) 48%, var(--bg-surface));
	}

	.note-select-label {
		flex: 0 0 auto;
		color: var(--text-muted);
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.note-select-trigger:focus,
	.note-select-trigger:focus-visible,
	.note-select-trigger:has(+ [data-open]) {
		border-color: color-mix(in srgb, var(--accent-strong) 70%, var(--border-soft));
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-strong) 16%, transparent);
	}

	.field select option {
		background: var(--bg-overlay);
		color: var(--text-primary);
	}

	:global(html[data-theme='dark']) .field select {
		color-scheme: dark;
	}

	:global(html[data-theme='light']) .field select {
		color-scheme: light;
	}

	.composer-input {
		width: 100%;
		min-height: 3.25rem;
		padding: 0.15rem 0.15rem 0.35rem;
		border: 0;
		border-radius: 0;
		background: transparent;
		color: var(--text-primary);
		font: inherit;
		resize: none;
	}

	.composer-input::placeholder {
		color: var(--text-muted);
	}

	.composer-actions {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		justify-content: space-between;
		gap: 0.65rem;
		min-height: 2.45rem;
	}

	.composer-actions__left {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.mode-pill-group {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		width: 10.6rem;
		padding: 0.12rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--bg-raised) 64%, transparent);
	}

	.mode-pill {
		flex: 0 0 2rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.32rem;
		min-width: 0;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--text-muted);
		font: inherit;
		font-size: 0.72rem;
		font-weight: 700;
		line-height: 1;
		padding: 0.46rem 0.58rem;
		cursor: pointer;
		overflow: hidden;
		transition:
			background 150ms ease,
			color 150ms ease;
	}

	.mode-pill--active {
		flex: 1 1 auto;
		background: color-mix(in srgb, var(--accent-soft) 36%, var(--bg-surface));
		color: var(--accent-primary);
	}

	.mode-pill:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--accent-strong) 70%, transparent);
		outline-offset: 0.12rem;
	}

	.mode-pill__icon {
		flex: 0 0 auto;
		display: inline-grid;
		place-items: center;
		width: 0.85rem;
		line-height: 1;
	}

	.mode-pill__label {
		display: inline-block;
		max-width: 0;
		overflow: hidden;
		opacity: 0;
		white-space: nowrap;
		transition:
			max-width 180ms ease,
			opacity 150ms ease;
	}

	.mode-pill--active .mode-pill__label {
		max-width: 4rem;
		opacity: 1;
	}

	.composer-divider {
		width: 1px;
		height: 1.35rem;
		background: color-mix(in srgb, var(--border-soft) 78%, transparent);
	}

	.send-btn {
		flex: 0 0 auto;
		display: inline-grid;
		place-items: center;
		width: 2.15rem;
		height: 2.15rem;
		min-width: 2.15rem;
		padding: 0;
		border-radius: 999px;
		font-size: 1rem;
		line-height: 1;
	}

	.send-btn span {
		transform: translateY(-0.03rem);
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
		.chat-topbar,
		.notebook-overlay,
		.notebook-backdrop {
			display: none;
		}

		.history-mobile {
			display: block;
			width: 100%;
			max-width: 54rem;
			margin: 0 auto;
		}

		.empty-stage {
			min-height: 22vh;
		}

		.proposal-grid {
			grid-template-columns: 1fr;
		}

		.composer-shell {
			max-width: 100%;
		}
	}

	@media (max-width: 680px) {
		.chat-page {
			min-height: auto;
		}

		.history-mobile,
		.chat-shell {
			max-width: 100%;
		}

		.message-bubble,
		.assistant-panel,
		.composer-dock {
			padding: 0.9rem;
		}

		.composer-actions,
		.match-card__actions,
		.proposal-toolbar {
			flex-wrap: wrap;
			align-items: stretch;
		}

		.composer-actions__left {
			width: 100%;
		}

		.create-offer-card {
			grid-template-columns: 1fr;
		}

		.select-chip {
			justify-content: space-between;
			width: 100%;
		}

		.select-wrap,
		.mode-pill-group {
			width: 100%;
		}

		.mode-pill-group {
			justify-content: space-between;
			width: 100%;
		}

		.mode-pill {
			flex: 1;
		}

		.composer-select-trigger,
		.select-chip--primary .composer-select-trigger,
		.select-chip--secondary .composer-select-trigger {
			max-width: none;
			width: 100%;
		}

		.composer-select-menu,
		.composer-select-menu--note {
			min-width: min(100%, calc(100vw - 2rem));
			max-width: min(100%, calc(100vw - 2rem));
		}
	}

	/* Settings trigger */
	.settings-trigger-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
		padding: 0.38rem 0.62rem;
		border: 1px solid var(--border-soft);
		border-radius: 999px;
		background: transparent;
		color: var(--text-muted);
		font: inherit;
		font-size: 0.72rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			border-color 150ms ease,
			background 150ms ease,
			color 150ms ease;
	}

	.settings-trigger-btn:hover,
	.settings-trigger-btn[aria-expanded='true'] {
		border-color: color-mix(in srgb, var(--accent-strong) 40%, var(--border-soft));
		background: color-mix(in srgb, var(--accent-soft) 16%, var(--bg-raised));
		color: var(--accent-primary);
	}

	.settings-trigger-btn:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--accent-strong) 70%, transparent);
		outline-offset: 0.18rem;
		border-radius: 999px;
	}

	.settings-trigger-btn__icon {
		flex: 0 0 auto;
		font-size: 0.8rem;
		line-height: 1;
	}

	.settings-trigger-btn__label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 8.5rem;
	}

	/* Settings dialog */
	.settings-dialog {
		width: min(28rem, calc(100vw - 2rem));
		padding: 0;
		border: 1px solid var(--border-soft);
		border-radius: 1.1rem;
		background: var(--bg-overlay);
		color: var(--text-primary);
		box-shadow: 0 20px 50px rgb(0 0 0 / 0.28);
		backdrop-filter: blur(14px);
		overflow: visible;
	}

	.settings-dialog::backdrop {
		background: color-mix(in srgb, var(--bg-base) 44%, transparent);
		backdrop-filter: blur(2px);
	}

	.settings-dialog__inner {
		display: grid;
		grid-template-rows: auto 1fr;
	}

	.settings-dialog__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.88rem 1rem 0.78rem;
		border-bottom: 1px solid color-mix(in srgb, var(--border-soft) 72%, transparent);
	}

	.settings-dialog__head h2 {
		margin: 0;
		font-size: 0.92rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.settings-close-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		border: 1px solid var(--border-soft);
		border-radius: 999px;
		background: transparent;
		color: var(--text-muted);
		font: inherit;
		font-size: 0.75rem;
		cursor: pointer;
		transition:
			border-color 150ms ease,
			background 150ms ease,
			color 150ms ease;
	}

	.settings-close-btn:hover {
		border-color: var(--border-strong);
		background: color-mix(in srgb, var(--bg-raised) 60%, transparent);
		color: var(--text-primary);
	}

	.settings-dialog__body {
		display: grid;
		gap: 1.15rem;
		padding: 1rem;
		overflow: visible;
	}

	.settings-section {
		display: grid;
		gap: 0.5rem;
	}

	.settings-section__label {
		margin: 0;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.settings-select-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0.65rem 0.75rem;
		border: 1px solid var(--border-soft);
		border-radius: 0.85rem;
		background: var(--bg-surface);
		color: var(--text-primary);
		font: inherit;
		font-size: 0.88rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			border-color 150ms ease,
			box-shadow 150ms ease;
	}

	.settings-select-trigger:focus-visible {
		outline: none;
		border-color: color-mix(in srgb, var(--accent-strong) 70%, var(--border-soft));
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-strong) 16%, transparent);
	}

	.settings-select-trigger[aria-expanded='true'] {
		border-color: color-mix(in srgb, var(--accent-strong) 70%, var(--border-soft));
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-strong) 16%, transparent);
	}

	@media (prefers-reduced-motion: reduce) {
		.citation-disclosure summary::before,
		.citation-chip,
		.field input,
		.field select,
		.field textarea,
		.primary-btn,
		.danger-btn,
		.ghost-btn,
		.send-btn,
		.mode-pill,
		.mode-pill__label,
		.composer-select-chevron,
		.composer-select-option,
		.history-drawer summary::after,
		.history-new,
		.history-item,
		.notebook-overlay,
		.notebook-toggle-btn,
		.notebook-close-btn,
		.settings-trigger-btn,
		.settings-close-btn,
		.settings-select-trigger,
		.loading-dots span {
			transition: none;
		}

		.loading-dots span {
			animation: none;
			opacity: 0.75;
			transform: none;
		}
	}
</style>
