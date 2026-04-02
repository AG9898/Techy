# API Reference — Techy

This document reflects the **target assistant-first API direction** agreed for the next work phase. Some endpoints described here replace current routes that still exist in code today; the workboard will track that migration explicitly.

All routes are SvelteKit. Page routes return SSR HTML. Form actions use `application/x-www-form-urlencoded`. JSON API routes use `application/json`.

Protected app routes are grouped under `src/routes/(app)` and enforced by `src/routes/(app)/+layout.server.ts`. Public auth routes remain outside that group at `/signin`, `/auth/*`, and `/debug/auth/*`.

See [`docs/schema.md`](schema.md) for persisted-table reference and [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) for runtime subsystem boundaries.

---

## Page Routes

### `GET /`
Home page. Loads all notes and links for the D3 force graph.

**Server load returns:**
```ts
{
  nodes: { id, slug, title, status, category }[],
  links: { source: string, target: string }[]
}
```

---

### `GET /notes`
Unified notes repository surface with integrated search, category filtering, and orphan detection.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Title or category substring for repository search |
| `tags` | string | Comma-separated tag list |
| `category` | string | Category filter |
| `orphans` | string | Optional truthy flag to focus orphan notes |

**Server load returns:**
```ts
{
  notes: { id, title, slug, tags, category, status, createdAt }[],
  orphanIds: string[],
  q?: string,
  tagsParam?: string,
  category?: string,
  showOrphans?: boolean
}
```

**Notes:**
- `/notes` is the unified browsing, search, and management surface for existing notes.
- The first implementation pass may keep filtering on the client over the loaded notes dataset.
- `orphanIds` is server-computed from notes with no incoming and no outgoing `note_links`.
- New note creation is no longer expected to originate from a dedicated `/notes/new` page.
- Standalone `/search` is being retired after the notes-page migration lands.

---

### `GET /notes/export`
Download all notes as a zip archive of Markdown files.

**Response:** `application/zip` binary with `Content-Disposition: attachment; filename="techy-notes-YYYY-MM-DD.zip"`

Each note is serialised to `{slug}.md` with YAML frontmatter (`title`, `tags`, `aliases`, `category`, `status`) followed by the body.

**Errors:** `500` on DB or zip failure

---

### `GET /notes/[slug]`
Note detail page.

**Path param:** `slug` — URL-safe note identifier

**Server load returns:**
```ts
{
  note: Note,
  htmlBody: string,
  outgoing: { id, title, slug, status }[],
  incoming: { id, title, slug, status }[]
}
```

**Errors:** `404` if slug not found

---

### `GET /notes/[slug]/edit`
Legacy direct edit route for an existing note. The assistant-first direction shifts primary authoring into `/chat`, but direct edit may remain temporarily during migration.

**Server load returns:** `{ note: Note }`

**Errors:** `404` if slug not found

---

### `GET /notes/[slug]/history`
Revision history list for a note, ordered most-recent first.

**Server load returns:**
```ts
{
  note: { id, title, slug },
  revisions: NoteRevision[]
}
```

**Errors:** `404` if slug not found

---

### `GET /notes/[slug]/history/[revisionId]`
Full content of a specific revision, rendered as HTML.

**Server load returns:**
```ts
{
  note: { id, title, slug },
  revision: NoteRevision,
  htmlBody: string
}
```

**Errors:** `404` if slug or revisionId not found, or revisionId does not belong to this note

---

### `GET /search`
Legacy standalone search page during migration.

**Notes:**
- This route is being retired in favor of integrated repository search on `/notes`.
- Once the notes-page migration lands, navigation and documentation should stop treating `/search` as a first-class route.

---

### `GET /chat`
Primary assistant surface for conversation and note authoring.

**Server load returns:**
```ts
{
  providers: {
    id: 'anthropic' | 'openai',
    label: string,
    models: { id: string, label: string }[],
    defaultModel: string
  }[],
  defaultProvider: 'anthropic' | 'openai',
  defaultModel: string,
  notes: {
    id: string,
    title: string,
    slug: string,
    aliases: string[],
    category: string | null,
    status: 'stub' | 'growing' | 'mature',
    updatedAt: string
  }[],
  conversations?: { id: string, title: string | null, updatedAt: string, lastMessagePreview?: string }[],
  activeConversation?: {
    id: string,
    title: string | null,
    messages: {
      id: string,
      role: 'user' | 'assistant',
      content: string,
      citations?: { title: string, url: string }[],
      proposal?: unknown | null,
      createdAt: string
    }[]
  } | null
}
```

**Page behaviour:**
- Standard conversation stays available at all times.
- The page may show a persisted conversation list so an older chat can be resumed without leaving `/chat`.
- Starting a new chat does not require deleting older conversations.
- The composer remains a single unified entry point rather than a primary mode switcher.
- The UI may expose compact create/update override controls near the composer, but inference is the default routing path.
- If the assistant detects a strong match to an existing note, the page may surface that note inline and offer research or review actions without forcing an immediate update flow.
- The page may render create/update proposals as editable inline draft panels and delete proposals as explicit confirmation cards.
- The page submits full conversation state to `POST /api/assistant/respond`.
- Provider/model options come from the server-side registry in `src/lib/server/ai/models.ts`.
- Respond-time prompt grounding also includes the shared canonical note-category list and a bounded deterministic list of existing lower-case note tags so create/update drafts reuse established taxonomy when possible.
- Assistant proposals must follow the standard note skeleton from `docs/NOTES.md`: `Overview`, `Description`, `Key Concepts`, `Connections`, and `Resources`, with only the approved optional sections allowed between `Key Concepts` and `Connections`.
- The initial `/chat` selection defaults to OpenAI with `gpt-5-mini`.
- The current OpenAI chat allowlist includes `gpt-5.2`, `gpt-5-mini`, `gpt-4o`, and `gpt-4o-mini`. The current OpenAI default is `gpt-5-mini`.
- The current Anthropic default is `claude-haiku-4-5-20251001`.
- Assistant responses may include a structured proposal for `create_note`, `update_note`, or `delete_note`.
- Create/update proposals render as editable draft panels in chat before save.
- Delete proposals render as explicit confirmation UI.
- Live web citations may be shown in chat review, but are not persisted as dedicated source metadata.
- Persisted chat history stores the app-owned transcript, not provider-managed hidden conversation state.
- Resuming a conversation reconstructs the `messages` payload from saved chat history before calling the assistant again.
- The response payload also includes `routing`, which exposes the resolved mode, matched note, target note, and override source so the chat UI can show the selected branch without inferring it client-side.

---

### `GET /chat/[conversationId]`
Resume a previously saved assistant conversation.

**Path param:** `conversationId` — UUID of the saved chat conversation

**Server load returns:**
```ts
{
  conversation: {
    id: string,
    title: string | null,
    createdAt: string,
    updatedAt: string
  },
  messages: {
    id: string,
    role: 'user' | 'assistant',
    content: string,
    citations?: { title: string, url: string }[],
    proposal?: unknown | null,
    createdAt: string
  }[],
  providers: {
    id: 'anthropic' | 'openai',
    label: string,
    models: { id: string, label: string }[],
    defaultModel: string
  }[],
  defaultProvider: 'anthropic' | 'openai',
  defaultModel: string,
  notes: { id: string, title: string, slug: string, aliases: string[] }[]
}
```

**Notes:**
- The saved transcript is the canonical source of resumed chat state.
- Provider-specific conversation IDs or hidden memory are not part of the route contract.
- Older messages may later be truncated or summarized when rebuilding model context, but the saved transcript remains the product source of truth.

---

## Form Actions

### `POST /notes?/import`
Batch-import notes from uploaded Markdown files. Files must have a YAML frontmatter block at the top.

**Form encoding:** `multipart/form-data`

**Form fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `files` | yes | One or more `.md` files |

**Behaviour:**
- Parses `title`, `tags`, `aliases`, `category`, `status` from YAML frontmatter; falls back to first `# Heading` for title.
- `category` must resolve to one of the canonical categories from `docs/NOTES.md`; invalid category strings are reported per file and skipped rather than persisted.
- If a note with the same title already exists it is **updated**. Otherwise a new note is **inserted**.
- `[[wikilinks]]` in each imported note are synced to `note_links` after all upserts complete.

**Success:** Returns `{ importResult: { imported: number, errors: { file: string, message: string }[] } }`

**Errors:**
- `400` — no files provided
- Per-file validation errors for malformed markdown/frontmatter, invalid category values, or slug/title conflicts

---

### `POST /notes/[slug]/edit?/update`
Legacy direct update action for an existing note.

**Behaviour:**
- Re-syncs `note_links` and preserves revision history.
- Rejects non-canonical `category` values with `400` before any revision snapshot or note update is written.

---

### `POST /notes/[slug]/edit?/delete`
Legacy direct delete action for an existing note.

**Success:** Redirects `303` to `/notes`

**Errors:** `404` — note not found

---

## JSON API Endpoints

### `POST /api/assistant/query` *(legacy endpoint)*
Legacy assistant endpoint. Superseded by `/api/assistant/respond` (now live). Can be removed now that `/api/assistant/commit` (ASSIST-007) has landed and the mutation boundary is established.

**Request body:**
```json
{ "query": "string" }
```

**Response (200):**
```json
{
  "matchedNote": { "id": "...", "title": "...", "slug": "...", "url": "..." },
  "summary": "string",
  "possibleGaps": ["string"],
  "newTopicIdeas": ["string"]
}
```

`matchedNote` is `null` when no note closely matches the query. `possibleGaps` and `newTopicIdeas` are assistant-generated suggestions for expanding the graph.

---

### `POST /api/assistant/respond`
Primary assistant endpoint for conversation, live research, and proposal generation.

Target direction: the assistant resolves intent server-side from the conversation and optional UI overrides. The current runtime still accepts the legacy explicit `mode` contract during migration, but the intended steady state is intent inference first, override second.

**Request body:**
```json
{
  "messages": [
    { "role": "user", "content": "Create a note about SvelteKit adapters" }
  ],
  "override": "create",
  "provider": "anthropic",
  "model": "claude-opus-4-6",
  "topicCache": {
    "sveltekit adapters": {
      "summary": "...",
      "citations": [
        { "title": "SvelteKit docs", "url": "https://..." }
      ]
    }
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `messages` | yes | Full conversation transcript for the active chat runtime; may be rebuilt from saved history when resuming |
| `override` | no | Optional hard override for the assistant router: `"chat"` \| `"create"` \| `"update"`. The default path is server-side inference from the conversation. |
| `provider` | yes | `"anthropic"` \| `"openai"` |
| `model` | yes | A server-approved model identifier for the chosen provider |
| `topicCache` | no | Ephemeral per-conversation research cache used to avoid re-researching the same topic repeatedly during an active runtime |
| `noteId` | conditional | UUID of the selected note to compare. Required only when the resolved intent is `"update"` and no strong exact title/alias note match can be resolved from the latest user turn. |
| `mode` | temporary | Legacy compatibility field during migration. Its semantics match `override`, and when both are present `override` wins. |

**Response (200):**
```json
{
  "assistantMessage": {
    "content": "SvelteKit adapters determine how the app is deployed...",
    "citations": [
      { "title": "SvelteKit docs", "url": "https://..." }
    ]
  },
  "routing": {
    "intent": "create",
    "resolvedMode": "create",
    "override": "create",
    "overrideSource": "override",
    "matchedNote": null,
    "targetNote": null,
    "noteId": null,
    "latestUserMessage": "Create a note about SvelteKit adapters"
  },
  "proposal": {
    "type": "create_note",
    "draft": {
      "title": "SvelteKit Adapters",
      "body": "# SvelteKit Adapters\n\n...",
      "tags": ["framework"],
      "aliases": [],
      "category": "Frameworks & Libraries",
      "status": "growing",
      "aiGenerated": true,
      "aiModel": "claude-opus-4-6",
      "aiPrompt": "Create a note about SvelteKit adapters"
    },
    "linkedNotePatches": [
      {
        "noteId": "existing-note-id",
        "title": "SvelteKit",
        "updatedBody": "... [[SvelteKit Adapters]] ..."
      }
    ]
  },
  "topicCache": {
    "sveltekit adapters": {
      "summary": "...",
      "citations": [
        { "title": "SvelteKit docs", "url": "https://..." }
      ]
    }
  }
}
```

**Behaviour:**
- The assistant remains conversational regardless of the resolved intent.
- The endpoint is stateless with respect to provider-managed hidden conversation memory.
- The endpoint contract is provider-agnostic, but the adapters may differ internally: Anthropic currently uses the Messages API while OpenAI currently uses the Responses API.
- Prompt assembly starts from one shared assistant identity and layers routed skill instructions for conversation, create, update, and explicit-delete behavior on top.
- The router resolves whether the turn is best treated as chat, create, or update based on the latest user turn plus any explicit override.
- `routing.overrideSource` is `"override"`, `"mode"`, or `"none"` so the UI can tell whether the resolved branch came from the new override field, the legacy compatibility alias, or pure inference.
- `routing.matchedNote` reports a conservative exact-match note hit from the latest user turn when one exists. `routing.targetNote` reports the effective note target for update flows, whether it came from an explicit `noteId` selection or inferred title/alias match.
- Intent inference is conservative. Strong exact-title or alias matches may route into note-review behavior; weaker similarity should stay conversational and ask or suggest instead of silently picking a note target.
- A prompt like "teach me about Django" should remain conversational even if a `Django` note exists. The server injects the matched note body for that chat turn so the assistant can summarize what is already saved and offer to research more or review it for updates without forcing an `update_note` proposal.
- When the resolved intent is create, the assistant may return a `create_note` proposal while still answering conversationally about the topic.
- For note proposals, `draft.category` is expected to be one of the canonical categories documented in [`docs/NOTES.md`](NOTES.md). The DB still stores `category` as `text`, but the product contract treats it as a controlled vocabulary.
- For note proposals, `draft.tags` remain flexible `text[]` values, but the assistant should prefer already-established tags from the graph when they fit rather than inventing near-duplicates.
- When the resolved intent is update, the server looks up the effective target note title and saved note body using either the selected `noteId` or a strong exact title/alias match, uses that title as the research topic, and injects both title and saved body into the system prompt alongside live research context. Empty saved bodies are still passed through explicitly so the assistant can treat them as incomplete notes rather than asking the user to restate the note.
- Update proposals are server-normalized before being returned to the client: the selected `noteId` is attached to the proposal payload and the canonical saved note title remains the update target.
- `delete_note` proposals remain explicit-intent only. The prompt layer only exposes a delete target when the latest user turn clearly asks to delete/remove a specifically selected or strongly matched saved note.
- Existing-note detection is proposal-first, not mutation-first. Finding a related note may change the assistant's response framing, but it never commits changes without the explicit commit step.
- Live web research is performed for create and update-style turns, including update review flows, so the comparison is always grounded in current information.
- If the same topic is already known in the current conversation cache, the assistant should reuse that context rather than re-run the same live research.
- Citations are review-only and are not persisted as dedicated DB metadata in this phase.
- OpenAI GPT-5-family requests may include adapter-level reasoning configuration without changing this endpoint contract.
- No provider-side conversation identifier is part of this endpoint contract.
- When chat history is resumed, the caller rebuilds the `messages` array from the saved transcript and sends that reconstructed conversation back through this same endpoint.
- `topicCache` is an ephemeral optimization and is not intended to be the persisted source of truth for chat history.

**Errors:**
- `400` — invalid body, missing messages, invalid provider/model combination, invalid selected `noteId`, or update routing with neither a selected note nor a strong exact match
- `401` — invalid or missing provider API key
- `429` — provider rate limit exceeded
- `500` — assistant orchestration or provider failure

---

### `POST /api/assistant/commit`
Persist a confirmed assistant proposal.

**Request body:**
```json
{
  "proposal": {
    "type": "create_note",
    "draft": {
      "title": "SvelteKit Adapters",
      "body": "# SvelteKit Adapters\n\n...",
      "tags": ["framework"],
      "aliases": [],
      "category": "Frameworks & Libraries",
      "status": "growing",
      "aiGenerated": true,
      "aiModel": "claude-opus-4-6",
      "aiPrompt": "Create a note about SvelteKit adapters"
    },
    "linkedNotePatches": [
      {
        "noteId": "existing-note-id",
        "updatedBody": "... [[SvelteKit Adapters]] ..."
      }
    ]
  }
}
```

**Proposal types:**
- `create_note`
- `update_note`
- `delete_note`

**Behaviour:**
- This endpoint is the assistant mutation boundary for confirmed create, update, and delete proposals.
- Create/update drafts must use a canonical note category; non-canonical category strings are rejected with `400`.
- `create_note` inserts the note, parses `[[wikilinks]]`, and syncs `note_links` immediately.
- If `linkedNotePatches` are included, the commit also updates those existing note bodies to include the new `[[wikilink]]` and re-syncs their `note_links` rows before returning.
- `update_note` stores a revision snapshot before updating the note and re-syncs links.
- `delete_note` removes the note after explicit UI confirmation.

**Response (200/201):**
```json
{
  "result": {
    "type": "create_note",
    "note": { "id": "...", "slug": "sveltekit-adapters", "title": "SvelteKit Adapters" }
  }
}
```

**Errors:**
- `400` — invalid proposal shape or non-canonical category in a create/update draft
- `404` — target note not found for update/delete, or a `linkedNotePatches` target ID does not exist at commit time
- `409` — title/slug conflict on create
- `500` — DB or sync failure

---

### `POST /api/ai/research`
Legacy helper endpoint. No longer the intended product entry point once the assistant-first flow lands.

**Request body:**
```json
{ "topic": "string", "provider": "claude" }
```

**Behaviour:**
- Accepts `provider: "claude" | "chatgpt"`; defaults to `"claude"`.
- Returns `{ body, model }`, where `model` reflects the current provider default.
- The current defaults are `claude-haiku-4-5-20251001` for Anthropic and `gpt-5-mini` for OpenAI.

---

### `POST /api/ai/generate-note`
Legacy helper endpoint. No longer the intended product entry point once the assistant-first flow lands.

**Request body:**
```json
{ "topic": "string", "provider": "claude" }
```

**Behaviour:**
- Accepts `provider: "claude" | "chatgpt"`; defaults to `"claude"`.
- Generates and immediately persists a note, then syncs `note_links` and returns note metadata plus `nextNoteIdeas`.
- The saved note writes `ai_model` using the current provider default.
- The current defaults are `claude-haiku-4-5-20251001` for Anthropic and `gpt-5-mini` for OpenAI.

---

## Auth Routes

Auth.js actions are handled by the catch-all at `src/routes/auth/[...auth]/+server.ts`. The custom sign-in UI is a normal SvelteKit page at `src/routes/signin/+page.svelte`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/signin` | Custom sign-in page |
| `GET` | `/auth/callback/github` | GitHub OAuth callback — do not call directly |
| `POST` | `/auth/signout` | Sign out |
| `GET` | `/signin?error=...` | Sign-in page with auth error message |
| `GET` / `POST` | `/debug/auth/login` | Debug-only bypass login |
| `GET` / `POST` | `/debug/auth/logout` | Clears the debug bypass session cookie |
