# API Reference — Techy

This document reflects the **target assistant-first API direction** agreed for the next work phase. Some endpoints described here replace current routes that still exist in code today; the workboard will track that migration explicitly.

All routes are SvelteKit. Page routes return SSR HTML. Form actions use `application/x-www-form-urlencoded`. JSON API routes use `application/json`.

Protected app routes are grouped under `src/routes/(app)` and enforced by `src/routes/(app)/+layout.server.ts`. Public auth routes remain outside that group at `/signin`, `/auth/*`, and `/debug/auth/*`.

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
  defaultModel: string
}
```

**Page behaviour:**
- Standard conversation stays available at all times.
- The composer includes an explicit create-mode toggle.
- The page submits full conversation state to `POST /api/assistant/respond`.
- Assistant responses may include a structured proposal for `create_note`, `update_note`, or `delete_note`.
- Create/update proposals render as editable draft panels in chat before save.
- Delete proposals render as explicit confirmation UI.
- Live web citations may be shown in chat review, but are not persisted as dedicated source metadata.

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
- If a note with the same title already exists it is **updated**. Otherwise a new note is **inserted**.
- `[[wikilinks]]` in each imported note are synced to `note_links` after all upserts complete.

**Success:** Returns `{ importResult: { imported: number, errors: { file: string, message: string }[] } }`

**Errors:**
- `400` — no files provided
- Per-file validation errors for malformed markdown/frontmatter or slug/title conflicts

---

### `POST /notes/[slug]/edit?/update`
Legacy direct update action for an existing note.

**Behaviour:** Re-syncs `note_links` and preserves revision history.

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

**Request body:**
```json
{
  "messages": [
    { "role": "user", "content": "Create a note about SvelteKit adapters" }
  ],
  "mode": "create",
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
| `messages` | yes | Full conversation transcript for the current client-side session |
| `mode` | yes | `"chat"` \| `"create"` \| `"update"` |
| `provider` | yes | `"anthropic"` \| `"openai"` |
| `model` | yes | A server-approved model identifier for the chosen provider |
| `topicCache` | no | Per-conversation research cache used to avoid re-researching the same topic repeatedly |
| `noteId` | conditional | UUID of the note to compare; required when `mode` is `"update"` |

**Response (200):**
```json
{
  "assistantMessage": {
    "content": "SvelteKit adapters determine how the app is deployed...",
    "citations": [
      { "title": "SvelteKit docs", "url": "https://..." }
    ]
  },
  "proposal": {
    "type": "create_note",
    "draft": {
      "title": "SvelteKit Adapters",
      "body": "# SvelteKit Adapters\n\n...",
      "tags": ["framework"],
      "aliases": [],
      "category": "Web Frameworks",
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
- In all modes, the assistant remains conversational.
- In create mode, the assistant may return a `create_note` proposal while still answering conversationally about the topic.
- In update mode, the server looks up the saved note body by `noteId` and injects it into the system prompt alongside live research context. The assistant compares the two and only returns an `update_note` proposal when the note is materially wrong, materially outdated, or substantially incomplete. Minor or cosmetic differences do not trigger a proposal.
- Live web research is performed for all modes including update, so the comparison is always grounded in current information.
- If the same topic is already known in the current conversation cache, the assistant should reuse that context rather than re-run the same live research.
- Citations are review-only and are not persisted as dedicated DB metadata in this phase.

**Errors:**
- `400` — invalid body, missing messages, invalid mode, invalid provider/model combination, or missing/invalid `noteId` for update mode
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
      "category": "Web Frameworks",
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
- `400` — invalid proposal shape
- `404` — target note not found for update/delete, or a `linkedNotePatches` target ID does not exist at commit time
- `409` — title/slug conflict on create
- `500` — DB or sync failure

---

### `POST /api/ai/research`
Legacy helper endpoint. No longer the intended product entry point once the assistant-first flow lands.

---

### `POST /api/ai/generate-note`
Legacy helper endpoint. No longer the intended product entry point once the assistant-first flow lands.

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
