import { and, asc, desc, eq } from 'drizzle-orm';

import { db } from '$lib/server/db/index.js';
import {
	conversationMessages,
	conversations,
	type Conversation,
	type ConversationMessage
} from '$lib/server/db/schema.js';

type MessageInput = Pick<ConversationMessage, 'role' | 'content'>;

export async function createConversation(userId: string, title?: string): Promise<Conversation> {
	const [conversation] = await db
		.insert(conversations)
		.values({
			userId,
			title
		})
		.returning();

	return conversation;
}

export async function appendMessages(
	conversationId: string,
	messages: MessageInput[]
): Promise<void> {
	if (messages.length === 0) {
		return;
	}

	await db.insert(conversationMessages).values(
		messages.map((message) => ({
			conversationId,
			role: message.role,
			content: message.content
		}))
	);

	await db
		.update(conversations)
		.set({ updatedAt: new Date() })
		.where(eq(conversations.id, conversationId));
}

export async function getConversation(
	conversationId: string,
	userId: string
): Promise<{ conversation: Conversation; messages: ConversationMessage[] } | null> {
	const [conversation] = await db
		.select()
		.from(conversations)
		.where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
		.limit(1);

	if (!conversation) {
		return null;
	}

	const messages = await db
		.select()
		.from(conversationMessages)
		.where(eq(conversationMessages.conversationId, conversationId))
		.orderBy(asc(conversationMessages.createdAt));

	return { conversation, messages };
}

export async function listRecentConversations(
	userId: string,
	limit = 20
): Promise<Conversation[]> {
	return db
		.select()
		.from(conversations)
		.where(eq(conversations.userId, userId))
		.orderBy(desc(conversations.updatedAt))
		.limit(limit);
}
