import { pgTable, uuid, text, boolean, timestamp, primaryKey, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ── Auth.js required tables ──────────────────────────────────────────────────

export const users = pgTable('users', {
	id: text('id').notNull().primaryKey(),
	name: text('name'),
	email: text('email').notNull().unique(),
	emailVerified: timestamp('email_verified', { mode: 'date' }),
	image: text('image')
});

export const accounts = pgTable(
	'accounts',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		type: text('type').notNull(),
		provider: text('provider').notNull(),
		providerAccountId: text('provider_account_id').notNull(),
		refresh_token: text('refresh_token'),
		access_token: text('access_token'),
		expires_at: integer('expires_at'),
		token_type: text('token_type'),
		scope: text('scope'),
		id_token: text('id_token'),
		session_state: text('session_state')
	},
	(account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })]
);

export const sessions = pgTable('sessions', {
	sessionToken: text('session_token').notNull().primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expires: timestamp('expires', { mode: 'date' }).notNull()
});

export const verificationTokens = pgTable(
	'verification_tokens',
	{
		identifier: text('identifier').notNull(),
		token: text('token').notNull(),
		expires: timestamp('expires', { mode: 'date' }).notNull()
	},
	(vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// ── Application tables ────────────────────────────────────────────────────────

export const notes = pgTable('notes', {
	id: uuid('id')
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	title: text('title').notNull(),
	slug: text('slug').notNull().unique(),
	body: text('body').notNull().default(''),
	tags: text('tags')
		.array()
		.notNull()
		.default(sql`'{}'::text[]`),
	aliases: text('aliases')
		.array()
		.notNull()
		.default(sql`'{}'::text[]`),
	category: text('category'),
	status: text('status', { enum: ['stub', 'growing', 'mature'] })
		.notNull()
		.default('stub'),
	aiGenerated: boolean('ai_generated').notNull().default(false),
	aiModel: text('ai_model'),
	aiPrompt: text('ai_prompt'),
	createdAt: timestamp('created_at', { mode: 'date' })
		.notNull()
		.default(sql`now()`),
	updatedAt: timestamp('updated_at', { mode: 'date' })
		.notNull()
		.default(sql`now()`)
});

export const noteLinks = pgTable('note_links', {
	id: uuid('id')
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	sourceNoteId: uuid('source_note_id')
		.notNull()
		.references(() => notes.id, { onDelete: 'cascade' }),
	targetNoteId: uuid('target_note_id')
		.notNull()
		.references(() => notes.id, { onDelete: 'cascade' })
});

export const noteRevisions = pgTable('note_revisions', {
	id: uuid('id')
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	noteId: uuid('note_id')
		.notNull()
		.references(() => notes.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	body: text('body').notNull().default(''),
	tags: text('tags')
		.array()
		.notNull()
		.default(sql`'{}'::text[]`),
	aliases: text('aliases')
		.array()
		.notNull()
		.default(sql`'{}'::text[]`),
	category: text('category'),
	status: text('status', { enum: ['stub', 'growing', 'mature'] })
		.notNull()
		.default('stub'),
	revisedAt: timestamp('revised_at', { mode: 'date' })
		.notNull()
		.default(sql`now()`)
});

// ── Assistant conversation tables ─────────────────────────────────────────────

export const conversations = pgTable('conversations', {
	id: uuid('id')
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	title: text('title'),
	createdAt: timestamp('created_at', { mode: 'date' })
		.notNull()
		.default(sql`now()`),
	updatedAt: timestamp('updated_at', { mode: 'date' })
		.notNull()
		.default(sql`now()`)
});

export const conversationMessages = pgTable('conversation_messages', {
	id: uuid('id')
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	conversationId: uuid('conversation_id')
		.notNull()
		.references(() => conversations.id, { onDelete: 'cascade' }),
	role: text('role', { enum: ['user', 'assistant'] }).notNull(),
	content: text('content').notNull(),
	createdAt: timestamp('created_at', { mode: 'date' })
		.notNull()
		.default(sql`now()`)
});

// ── Inferred TypeScript types ─────────────────────────────────────────────────

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type NoteLink = typeof noteLinks.$inferSelect;
export type NoteRevision = typeof noteRevisions.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type NewConversationMessage = typeof conversationMessages.$inferInsert;
