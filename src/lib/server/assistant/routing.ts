import type { ConversationMessage } from '$lib/server/ai/claude.js';

export type AssistantRouteMode = 'chat' | 'create' | 'update';

export interface AssistantRoutingNote {
	id: string;
	title: string;
	slug: string;
	aliases: string[];
}

export interface AssistantResolvedNote {
	id: string;
	title: string;
	slug: string;
	matchType: 'selected' | 'title' | 'alias';
	matchedText: string;
}

export interface AssistantRoutingMetadata {
	intent: 'conversational' | 'create' | 'review';
	resolvedMode: AssistantRouteMode;
	override: AssistantRouteMode | null;
	overrideSource: 'override' | 'mode' | 'none';
	matchedNote: AssistantResolvedNote | null;
	targetNote: AssistantResolvedNote | null;
	noteId: string | null;
	latestUserMessage: string;
}

interface ResolveAssistantRoutingInput {
	messages: ConversationMessage[];
	override?: unknown;
	legacyMode?: unknown;
	noteId?: unknown;
	notes: AssistantRoutingNote[];
}

const CREATE_INTENT_PATTERNS = [
	/\b(create|draft|write|generate|make)\b.{0,40}\b(notes?|entry)\b/,
	/\bnew\b.{0,20}\b(notes?|entry)\b/,
	/\badd\b.{0,20}\b(notes?|entry)\b/,
	/\badd\b.{0,25}\b(this|it|that)\b.{0,25}\bto\b.{0,10}\b(my\s+)?notes?\b/,
	/\b(save|store)\b.{0,20}\b(this|it|that)\b.{0,20}\b(to|in|as)\b.{0,10}\b(my\s+)?notes?\b/,
	/\bturn\b.{0,20}\b(this|it|that)\b.{0,20}\binto\b.{0,10}\b(a\s+)?note\b/
];

const REVIEW_INTENT_PATTERNS = [
	/\b(review|update|refresh|revise|improve|expand|fix|audit|check)\b/,
	/\b(outdated|out of date|missing|stale|current)\b/
];

const TOPIC_LEARNING_PROMPT_PATTERNS = [
	/^\s*(?:please\s+)?(?:what is|what are)\b/i,
	/^\s*(?:please\s+)?(?:what can you teach me about|what can you tell me about)\b/i,
	/^\s*(?:please\s+)?(?:can you teach me about|can you tell me about)\b/i,
	/^\s*(?:please\s+)?(?:tell me about|tell me more about|teach me about|learn me about|learn about)\b/i,
	/^\s*(?:please\s+)?(?:explain|describe|show me)\b/i,
	/^\s*(?:please\s+)?(?:overview of|give me an overview of)\b/i
];

const TOPIC_LEARNING_LEAD_INS = [
	/^\s*(?:please\s+)?what can you teach me about\s+/i,
	/^\s*(?:please\s+)?what can you tell me about\s+/i,
	/^\s*(?:please\s+)?can you teach me about\s+/i,
	/^\s*(?:please\s+)?can you tell me about\s+/i,
	/^\s*(?:please\s+)?tell me more about\s+/i,
	/^\s*(?:please\s+)?tell me about\s+/i,
	/^\s*(?:please\s+)?teach me about\s+/i,
	/^\s*(?:please\s+)?learn me about\s+/i,
	/^\s*(?:please\s+)?learn about\s+/i,
	/^\s*(?:please\s+)?explain\s+/i,
	/^\s*(?:please\s+)?describe\s+/i,
	/^\s*(?:please\s+)?show me\s+/i,
	/^\s*(?:please\s+)?what is\s+/i,
	/^\s*(?:please\s+)?what are\s+/i,
	/^\s*(?:please\s+)?give me an overview of\s+/i,
	/^\s*(?:please\s+)?overview of\s+/i
];

const MATCH_LEAD_INS = [
	/^(please\s+)?tell me about\s+/,
	/^(please\s+)?teach me about\s+/,
	/^(please\s+)?learn me about\s+/,
	/^(please\s+)?learn about\s+/,
	/^(please\s+)?explain\s+/,
	/^(please\s+)?describe\s+/,
	/^(please\s+)?show me\s+/,
	/^(please\s+)?what is\s+/,
	/^(please\s+)?what are\s+/,
	/^(please\s+)?give me an overview of\s+/,
	/^(please\s+)?overview of\s+/,
	/^(please\s+)?review\s+/,
	/^(please\s+)?update\s+/,
	/^(please\s+)?refresh\s+/,
	/^(please\s+)?revise\s+/,
	/^(please\s+)?improve\s+/,
	/^(please\s+)?expand\s+/,
	/^(please\s+)?check\s+/,
	/^(please\s+)?audit\s+/,
	/^(please\s+)?create (?:a )?note about\s+/,
	/^(please\s+)?write (?:a )?note about\s+/,
	/^(please\s+)?draft (?:a )?note about\s+/,
	/^(please\s+)?generate (?:a )?note about\s+/
];

export function resolveAssistantRouting({
	messages,
	override,
	legacyMode,
	noteId,
	notes
}: ResolveAssistantRoutingInput): AssistantRoutingMetadata {
	const latestUserMessage = getLatestUserMessage(messages);
	const normalizedOverride = normalizeOverride(override);
	const normalizedLegacyMode = normalizeOverride(legacyMode);
	const selectedNote = resolveSelectedNote(noteId, notes);
	const matchedNote = matchExistingNote(latestUserMessage, notes);
	const appliedOverride = normalizedOverride ?? normalizedLegacyMode;

	const resolvedMode =
		appliedOverride ??
		inferAssistantMode(latestUserMessage, {
			matchedNote,
			selectedNote
		});

	const intent =
		resolvedMode === 'create'
			? 'create'
			: resolvedMode === 'update'
				? 'review'
				: 'conversational';

	const targetNote =
		resolvedMode === 'update'
			? selectedNote ?? matchedNote
			: null;

	return {
		intent,
		resolvedMode,
		override: appliedOverride,
		overrideSource: normalizedOverride ? 'override' : normalizedLegacyMode ? 'mode' : 'none',
		matchedNote,
		targetNote,
		noteId: targetNote?.id ?? null,
		latestUserMessage
	};
}

export function isTopicLearningPrompt(message: string): boolean {
	return TOPIC_LEARNING_PROMPT_PATTERNS.some((pattern) => pattern.test(message.trim()));
}

export function extractLearningTopic(message: string): string | null {
	if (!isTopicLearningPrompt(message)) {
		return null;
	}

	let stripped = message.trim();

	for (const pattern of TOPIC_LEARNING_LEAD_INS) {
		stripped = stripped.replace(pattern, '');
	}

	const topic = stripped
		.replace(/^[`"'“”‘’(\[]+/, '')
		.replace(/[`"'“”‘’)\].,!?;:]+$/, '')
		.trim();

	return topic || null;
}

function getLatestUserMessage(messages: ConversationMessage[]): string {
	return [...messages].reverse().find((message) => message.role === 'user')?.content.trim() ?? '';
}

function normalizeOverride(value: unknown): AssistantRouteMode | null {
	return value === 'chat' || value === 'create' || value === 'update' ? value : null;
}

function inferAssistantMode(
	message: string,
	{
		matchedNote,
		selectedNote
	}: {
		matchedNote: AssistantResolvedNote | null;
		selectedNote: AssistantResolvedNote | null;
	}
): AssistantRouteMode {
	const normalizedMessage = normalizeText(message);
	if (!normalizedMessage) {
		return 'chat';
	}

	if (CREATE_INTENT_PATTERNS.some((pattern) => pattern.test(normalizedMessage))) {
		return 'create';
	}

	if ((matchedNote || selectedNote) && REVIEW_INTENT_PATTERNS.some((pattern) => pattern.test(normalizedMessage))) {
		return 'update';
	}

	return 'chat';
}

function resolveSelectedNote(
	noteId: unknown,
	notes: AssistantRoutingNote[]
): AssistantResolvedNote | null {
	if (typeof noteId !== 'string' || !noteId) {
		return null;
	}

	const note = notes.find((candidate) => candidate.id === noteId);
	if (!note) {
		return null;
	}

	return {
		id: note.id,
		title: note.title,
		slug: note.slug,
		matchType: 'selected',
		matchedText: note.title
	};
}

function matchExistingNote(
	message: string,
	notes: AssistantRoutingNote[]
): AssistantResolvedNote | null {
	const variants = buildMatchVariants(message);
	if (!variants.length) {
		return null;
	}

	for (const variant of variants) {
		for (const note of notes) {
			if (normalizeText(note.title) === variant) {
				return {
					id: note.id,
					title: note.title,
					slug: note.slug,
					matchType: 'title',
					matchedText: note.title
				};
			}

			const aliasMatch = note.aliases.find((alias) => normalizeText(alias) === variant);
			if (aliasMatch) {
				return {
					id: note.id,
					title: note.title,
					slug: note.slug,
					matchType: 'alias',
					matchedText: aliasMatch
				};
			}
		}
	}

	const titlePhraseMatches = notes.filter((note) =>
		containsExactPhrase(normalizeText(message), normalizeText(note.title))
	);

	if (titlePhraseMatches.length !== 1) {
		return null;
	}

	const note = titlePhraseMatches[0];
	return {
		id: note.id,
		title: note.title,
		slug: note.slug,
		matchType: 'title',
		matchedText: note.title
	};
}

function buildMatchVariants(message: string): string[] {
	const normalized = normalizeText(message);
	if (!normalized) {
		return [];
	}

	const variants = new Set<string>([normalized, stripLeadIn(normalized)]);
	for (const variant of [...variants]) {
		variants.add(stripSurroundingQuotes(variant));
	}

	return [...variants].filter(Boolean);
}

function stripLeadIn(message: string): string {
	let stripped = message;

	for (const pattern of MATCH_LEAD_INS) {
		stripped = stripped.replace(pattern, '');
	}

	stripped = stripped.replace(/^(the|a|an)\s+/, '');
	return stripSurroundingQuotes(stripped);
}

function stripSurroundingQuotes(message: string): string {
	return message.replace(/^["'`]+/, '').replace(/["'`]+$/, '').trim();
}

function normalizeText(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]+/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function containsExactPhrase(haystack: string, needle: string): boolean {
	if (!needle || needle.length < 3) {
		return false;
	}

	const pattern = new RegExp(`(^|\\s)${escapeRegExp(needle)}(\\s|$)`, 'u');
	return pattern.test(haystack);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
