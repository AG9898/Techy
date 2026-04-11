# Database Schema — Techy

This document is the database-schema reference for Techy. It separates the current persisted schema from planned assistant-first schema additions so the docs do not imply tables already exist when they are still target-direction only.

Primary source of truth for the current implemented schema:
- `src/lib/server/db/schema.ts`

Related docs:
- [`docs/NOTES.md`](NOTES.md) for note-authoring semantics, wikilinks, and field usage
- [`docs/API.md`](API.md) for route and endpoint contracts
- [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) for runtime boundaries and subsystem flows

---

## Current Implemented Tables

### Auth.js tables

These tables are required by Auth.js and the Drizzle adapter.

#### `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` | Primary key |
| `name` | `text` | Optional display name |
| `email` | `text` | Required, unique |
| `email_verified` | `timestamp` | Optional verification timestamp |
| `image` | `text` | Optional avatar URL |

#### `accounts`

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | `text` | Required, references `users.id`, `ON DELETE CASCADE` |
| `type` | `text` | Required Auth.js account type |
| `provider` | `text` | Required provider name |
| `provider_account_id` | `text` | Required provider account identifier |
| `refresh_token` | `text` | Optional |
| `access_token` | `text` | Optional |
| `expires_at` | `integer` | Optional expiry epoch |
| `token_type` | `text` | Optional |
| `scope` | `text` | Optional |
| `id_token` | `text` | Optional |
| `session_state` | `text` | Optional |

Composite primary key:
- `provider`
- `provider_account_id`

#### `sessions`

| Column | Type | Notes |
|--------|------|-------|
| `session_token` | `text` | Primary key |
| `user_id` | `text` | Required, references `users.id`, `ON DELETE CASCADE` |
| `expires` | `timestamp` | Required |

#### `verification_tokens`

| Column | Type | Notes |
|--------|------|-------|
| `identifier` | `text` | Required |
| `token` | `text` | Required |
| `expires` | `timestamp` | Required |

Composite primary key:
- `identifier`
- `token`

### App tables

#### `notes`

Primary knowledge-graph entity table.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key, defaults to `gen_random_uuid()` |
| `title` | `text` | Required |
| `slug` | `text` | Required, unique |
| `body` | `text` | Required, defaults to empty string |
| `tags` | `text[]` | Required, defaults to empty array |
| `aliases` | `text[]` | Required, defaults to empty array |
| `category` | `text` | Optional |
| `status` | `text` | Required enum: `stub` \| `growing` \| `mature`; defaults to `stub` |
| `ai_generated` | `boolean` | Required, defaults to `false` |
| `ai_model` | `text` | Optional |
| `ai_prompt` | `text` | Optional |
| `created_at` | `timestamp` | Required, defaults to `now()` |
| `updated_at` | `timestamp` | Required, defaults to `now()` |

Important constraints:
- `slug` is globally unique
- `updated_at` must be set explicitly by application updates

#### `note_links`

Graph edge table derived from `[[wikilinks]]` in note bodies.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key, defaults to `gen_random_uuid()` |
| `source_note_id` | `uuid` | Required, references `notes.id`, `ON DELETE CASCADE` |
| `target_note_id` | `uuid` | Required, references `notes.id`, `ON DELETE CASCADE` |

Behavior notes:
- rows are re-synced from note bodies on save
- deleting a note deletes its outgoing and incoming edge rows through cascades

#### `note_revisions`

Immutable snapshot table for note history.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key, defaults to `gen_random_uuid()` |
| `note_id` | `uuid` | Required, references `notes.id`, `ON DELETE CASCADE` |
| `title` | `text` | Required snapshot value |
| `body` | `text` | Required snapshot value, defaults to empty string |
| `tags` | `text[]` | Required snapshot value, defaults to empty array |
| `aliases` | `text[]` | Required snapshot value, defaults to empty array |
| `category` | `text` | Optional snapshot value |
| `status` | `text` | Required enum: `stub` \| `growing` \| `mature`; defaults to `stub` |
| `revised_at` | `timestamp` | Required, defaults to `now()` |

Behavior notes:
- snapshots are taken before note updates
- revisions are read-only after insert
- deleting a note deletes its revisions through cascade

#### `conversations`

Container table for app-owned assistant conversation history.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key, defaults to `gen_random_uuid()` |
| `user_id` | `text` | Required, references `users.id`, `ON DELETE CASCADE` |
| `title` | `text` | Optional conversation title |
| `created_at` | `timestamp` | Required, defaults to `now()` |
| `updated_at` | `timestamp` | Required, defaults to `now()` |

#### `conversation_messages`

Transcript table linked to `conversations`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key, defaults to `gen_random_uuid()` |
| `conversation_id` | `uuid` | Required, references `conversations.id`, `ON DELETE CASCADE` |
| `role` | `text` | Required enum: `user` \| `assistant` |
| `content` | `text` | Required message content |
| `created_at` | `timestamp` | Required, defaults to `now()` |

Persistence rules:
- store app-owned canonical transcript data only
- do not persist provider-managed conversation IDs or ephemeral live-research payloads

---

## Ownership Boundaries

Use this doc when the change affects:
- table definitions
- column names or types
- uniqueness and foreign-key constraints
- cascade behavior
- what is or is not persisted durably

Use other docs instead when the change affects:
- note-authoring rules or wikilink semantics: [`docs/NOTES.md`](NOTES.md)
- route inputs/outputs and endpoint behavior: [`docs/API.md`](API.md)
- runtime architecture and subsystem boundaries: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)
