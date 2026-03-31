import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { isValidProviderModel } from '$lib/server/ai/models.js';
import { respondConversation as respondWithClaude } from '$lib/server/ai/claude.js';
import { respondConversation as respondWithOpenAI } from '$lib/server/ai/chatgpt.js';
import type { ConversationMessage } from '$lib/server/ai/claude.js';

/**
 * POST /api/assistant/respond
 *
 * Unified assistant endpoint. Accepts a conversation, provider/model choice, and mode.
 * Returns a conversational reply plus an optional structured note proposal.
 */
export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return json({ error: 'Request body must be a JSON object' }, { status: 400 });
	}

	const { messages, mode, provider, model, topicCache } = body as Record<string, unknown>;

	// Validate messages
	if (!Array.isArray(messages) || messages.length === 0) {
		return json({ error: 'messages must be a non-empty array' }, { status: 400 });
	}

	for (const msg of messages) {
		if (
			typeof msg !== 'object' ||
			msg === null ||
			((msg as Record<string, unknown>).role !== 'user' &&
				(msg as Record<string, unknown>).role !== 'assistant') ||
			typeof (msg as Record<string, unknown>).content !== 'string'
		) {
			return json(
				{ error: 'Each message must have role ("user" | "assistant") and content (string)' },
				{ status: 400 }
			);
		}
	}

	// Validate mode
	if (mode !== 'chat' && mode !== 'create') {
		return json({ error: 'mode must be "chat" or "create"' }, { status: 400 });
	}

	// Validate provider/model
	if (typeof provider !== 'string' || typeof model !== 'string') {
		return json({ error: 'provider and model must be strings' }, { status: 400 });
	}

	if (!isValidProviderModel(provider, model)) {
		return json(
			{ error: `Invalid provider/model combination: ${provider}/${model}` },
			{ status: 400 }
		);
	}

	const typedMessages = messages as ConversationMessage[];

	try {
		let result;
		if (provider === 'anthropic') {
			result = await respondWithClaude(typedMessages, mode, model);
		} else {
			result = await respondWithOpenAI(typedMessages, mode, model);
		}

		// Attach server-side metadata to any create_note proposal draft
		if (result.proposal?.type === 'create_note' && result.proposal.draft) {
			const lastUserMsg = [...typedMessages].reverse().find((m) => m.role === 'user');
			result.proposal.draft.aiGenerated = true;
			result.proposal.draft.aiModel = model;
			result.proposal.draft.aiPrompt = lastUserMsg?.content ?? '';
		}

		return json({
			assistantMessage: result.assistantMessage,
			proposal: result.proposal ?? null,
			topicCache: topicCache ?? {}
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (
			message.includes('401') ||
			message.includes('invalid_api_key') ||
			message.includes('authentication') ||
			message.includes('Incorrect API key') ||
			message.includes('No auth credentials')
		) {
			return json({ error: 'Invalid or missing provider API key' }, { status: 401 });
		}
		if (
			message.includes('429') ||
			message.includes('rate_limit') ||
			message.includes('Rate limit')
		) {
			return json({ error: 'Provider rate limit exceeded — try again later' }, { status: 429 });
		}
		console.error('[/api/assistant/respond]', err);
		return json({ error: 'Assistant request failed' }, { status: 500 });
	}
};
