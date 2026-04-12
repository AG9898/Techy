import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import { PROVIDERS, DEFAULT_PROVIDER, DEFAULT_MODEL } from '$lib/server/ai/models.js';
import {
	getConversation,
	listRecentConversations
} from '$lib/server/assistant/conversations.js';
import { db } from '$lib/server/db/index.js';
import { notes } from '$lib/server/db/schema.js';
import { asc } from 'drizzle-orm';

function providerOptions() {
	return {
		providers: PROVIDERS.map((p) => ({
			id: p.id,
			label: p.label,
			models: p.models,
			defaultModel: p.defaultModel
		})),
		defaultProvider: DEFAULT_PROVIDER,
		defaultModel: DEFAULT_MODEL
	};
}

async function listChatNotes() {
	return db
		.select({
			id: notes.id,
			title: notes.title,
			slug: notes.slug,
			aliases: notes.aliases,
			category: notes.category,
			status: notes.status,
			updatedAt: notes.updatedAt
		})
		.from(notes)
		.orderBy(asc(notes.title));
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const session = await locals.auth();
	const userId = session?.user?.id;

	if (!userId) {
		redirect(303, '/signin');
	}

	const savedConversation = await getConversation(params.conversationId, userId);

	if (!savedConversation) {
		redirect(303, '/chat');
	}

	const [notesList, conversations] = await Promise.all([
		listChatNotes(),
		listRecentConversations(userId)
	]);

	return {
		...providerOptions(),
		notes: notesList,
		conversations,
		conversation: savedConversation.conversation,
		messages: savedConversation.messages
	};
};
