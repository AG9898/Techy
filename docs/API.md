# API Reference — Techy

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
Notes list with category filter chips and orphan detection.

**Server load returns:**
```ts
{
  notes: { id, title, slug, tags, category, status, createdAt }[],
  orphanIds: string[]   // IDs of notes with no incoming or outgoing links
}
```

---

### `GET /notes/export`
Download all notes as a zip archive of Markdown files.

**Response:** `application/zip` binary with `Content-Disposition: attachment; filename="techy-notes-YYYY-MM-DD.zip"`

Each note is serialised to `{slug}.md` with YAML frontmatter (`title`, `tags`, `aliases`, `category`, `status`) followed by the body. The format is compatible with `POST /notes?/import`.

**Errors:** `500` on DB or zip failure

---

### `GET /notes/new`
Create note form. No server load data.

---

### `GET /notes/[slug]`
Note detail page.

**Path param:** `slug` — URL-safe note identifier

**Server load returns:**
```ts
{
  note: Note,                          // full note row
  htmlBody: string,                    // rendered HTML (wikilinks resolved + marked)
  outgoing: { id, title, slug, status }[],  // notes this note links to
  incoming: { id, title, slug, status }[]   // notes that link to this note
}
```

**Errors:** `404` if slug not found

---

### `GET /notes/[slug]/edit`
Edit note form. Pre-populated with existing note data.

**Server load returns:** `{ note: Note }`

**Errors:** `404` if slug not found

---

### `GET /notes/[slug]/history`
Revision history list for a note, ordered most-recent first.

**Server load returns:**
```ts
{
  note: { id, title, slug },
  revisions: NoteRevision[]  // ordered by revisedAt DESC
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
  htmlBody: string           // rendered Markdown with wikilinks resolved
}
```

**Errors:** `404` if slug or revisionId not found, or revision does not belong to this note

---

### `GET /search`
Search results page.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Title or category substring (case-insensitive) |
| `tags` | string | Comma-separated tag list (notes must have ≥1 matching tag) |
| `category` | string | Category substring (case-insensitive) |

**Server load returns:**
```ts
{
  results: { id, title, slug, tags, category, status, createdAt }[],
  q: string,
  tagsParam: string,
  category: string
}
```

Empty query (all params absent or blank) returns `results: []`.

---

### `GET /chat`
Dedicated assistant chat page. Auth-protected via the `(app)` layout guard.

**Server load returns:** `{}` (scaffold — no data required for the shell)

**Page layout:**
- Primary conversation surface (`bg-surface`, 16px radius) filling available viewport height
- Empty state: centred glyph, title, and hint text
- Loading state: animated three-dot pulse while the assistant responds
- Persistent composer region at the bottom (`bg-surface`, 14px radius) with a textarea and Send button
- Conversation column capped at 720px width, centred within the page shell
- All styling uses design-token variables; no hardcoded hex values

---

## Form Actions

### `POST /notes/new`
Create a new note.

**Form fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `title` | yes | Note title. Drives the slug. Must be unique. |
| `body` | no | Markdown body. `[[wikilinks]]` are parsed on save. |
| `category` | no | One of the hub categories. |
| `status` | no | `stub` \| `growing` \| `mature`. Default: `stub`. |
| `tags` | no | Comma-separated string (e.g. `svelte, javascript`). |
| `aliases` | no | Comma-separated string of alternate names. |

**Success:** Redirects `303` to `/notes/[slug]`

**Errors:**
- `400` — title missing
- `400` — slug derived from title already exists

---

### `POST /notes?/import`
Batch-import notes from uploaded Markdown files. Files must have a YAML frontmatter block at the top.

**Form encoding:** `multipart/form-data`

**Form fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `files` | yes | One or more `.md` files (multipart, `multiple`) |

**Behaviour:**
- Parses `title`, `tags`, `aliases`, `category`, `status` from YAML frontmatter; falls back to first `# Heading` for title.
- If a note with the same title already exists it is **updated** (body, tags, aliases, category, status). Otherwise a new note is **inserted**.
- `[[wikilinks]]` in each imported note are synced to `note_links` after all upserts complete, so cross-file links resolve correctly.
- Files that fail validation are collected as errors; they do not block the import of valid files.

**Success:** Returns `{ importResult: { imported: number, errors: { file: string, message: string }[] } }`

**Errors:**
- `400` — no files provided
- Per-file validation errors: not `.md`, missing frontmatter block, missing title, slug collision with a different-titled note

---

### `POST /notes?/delete`
Delete a note by ID.

**Form fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Note UUID |

**Success:** Returns `{ success: true }` (stays on `/notes`)

**Errors:** `400` — id missing or invalid

---

### `POST /notes/[slug]/edit?/update`
Update an existing note.

**Form fields:** Same as `POST /notes/new` (title, body, category, status, tags, aliases)

**Behaviour:** Re-syncs `note_links` — deletes old links for this note, re-inserts from current body's `[[wikilinks]]`.

**Success:** Redirects `303` to `/notes/[slug]`

**Errors:**
- `400` — title missing
- `404` — note not found

---

### `POST /notes/[slug]/edit?/delete`
Delete a note by slug.

**Success:** Redirects `303` to `/notes`

**Errors:** `404` — note not found

---

## JSON API Endpoints

### `POST /api/ai/research`
Research a topic using an AI provider and return a draft note body.

**Status:** Stub — returns `501` until AI-001 / AI-002 are implemented.

**Request body:**
```json
{
  "topic": "SvelteKit",
  "provider": "claude"
}
```

| Field | Required | Values |
|-------|----------|--------|
| `topic` | yes | Any technology or concept name |
| `provider` | no | `"claude"` (default) \| `"chatgpt"` |

**Response (200):**
```json
{ "body": "# SvelteKit\n\n...", "model": "claude-opus-4-6" }
```

`model` is the identifier of the AI model that produced the body (`"claude-opus-4-6"` for Claude, `"gpt-4o"` for ChatGPT). The New Note page stores this value in the `ai_model` field when the user submits the form after researching.

---

### `POST /api/ai/generate-note`
Generate a complete note and insert it into the database.

**Request body:**
```json
{
  "topic": "SvelteKit",
  "provider": "claude"
}
```

| Field | Required | Values |
|-------|----------|--------|
| `topic` | yes | Any technology or concept name |
| `provider` | no | `"claude"` (default; `"chatgpt"` planned in AI-002) |

**Response (201):**
```json
{
  "note": { "id": "...", "slug": "sveltekit", "title": "SvelteKit" }
}
```

**Behaviour:**
- Calls `generateNote(topic)` via `claude-opus-4-6` using `NOTE_GENERATION_SYSTEM_PROMPT`
- Parses frontmatter (`title`, `category`, `tags`, `status`) from the generated Markdown
- Derives slug with `slugify(title)`
- Inserts the note with `ai_generated=true`, `ai_model='claude-opus-4-6'`, `ai_prompt=topic`
- Parses `[[wikilinks]]` from the note body and syncs `note_links`

**Errors:**
- `400` — topic missing or empty
- `401` — invalid or missing ANTHROPIC_API_KEY
- `409` — slug or title already exists (body includes `conflictId`)
- `429` — Claude rate limit exceeded
- `500` — generation or DB failure

---

### `POST /api/assistant/query`
Look up an existing note from a natural-language request and return a note-grounded assistant response.

**Request body:**
```json
{
  "query": "tell me about SvelteKit"
}
```

| Field | Required | Values |
|-------|----------|--------|
| `query` | yes | Natural-language request that should resolve to an existing note |

**Response (200):**
```json
{
  "matchedNote": {
    "id": "...",
    "title": "SvelteKit",
    "slug": "sveltekit",
    "url": "/notes/sveltekit"
  },
  "summary": "SvelteKit is ...",
  "possibleGaps": [
    "Deployment adapter tradeoffs",
    "How form actions differ from API routes"
  ],
  "newTopicIdeas": [
    "Vite",
    "Svelte 5 runes",
    "SvelteKit adapters"
  ]
}
```

**Behaviour:**
- Note resolution uses a 5-tier matching cascade (most-to-least exact):
  1. Exact title match (case-insensitive)
  2. Exact alias match (case-insensitive)
  3. Title appears anywhere in the query (handles "tell me about SvelteKit" → note titled "SvelteKit")
  4. Any alias appears anywhere in the query
  5. Partial title ilike match (fallback)
- `summary` is grounded in the saved note content, produced by `claude-opus-4-6` via `ASSISTANT_QUERY_SYSTEM_PROMPT`
- `possibleGaps` are phrased as suggested additions or underdeveloped areas, not guaranteed omissions; may be `[]`
- `newTopicIdeas` contains exactly 3 suggestions; topics already present as note titles or aliases are excluded before the AI call

**Errors:**
- `400` — query missing or empty
- `401` — invalid or missing ANTHROPIC_API_KEY
- `404` — no matching note found
- `429` — Claude rate limit exceeded
- `500` — AI call or JSON parsing failure

---

## Auth Routes

Auth.js actions are handled by the catch-all at `src/routes/auth/[...auth]/+server.ts`. The custom sign-in UI is a normal SvelteKit page at `src/routes/signin/+page.svelte`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/signin` | Custom sign-in page |
| `GET` | `/auth/callback/github` | GitHub OAuth callback — do not call directly |
| `POST` | `/auth/signout` | Sign out (form POST from Nav) |
| `GET` | `/signin?error=...` | Sign-in page with auth error message (e.g. `?error=AccessDenied`) |
| `GET` / `POST` | `/debug/auth/login` | Debug-only bypass login. Requires `DEBUG_AUTH_BYPASS_ENABLED=true` and the correct secret. |
| `GET` / `POST` | `/debug/auth/logout` | Clears the debug bypass session cookie |

**Sign-out usage** (from any Svelte component):
```html
<form method="POST" action="/auth/signout">
  <button type="submit">Sign out</button>
</form>
```

**Debug bypass usage**:
```bash
curl -i "http://localhost:5173/debug/auth/login?secret=<DEBUG_AUTH_BYPASS_SECRET>&redirectTo=/notes"
```

The debug bypass creates a signed app session without GitHub OAuth. It is intended for local testing and agent-driven Playwright runs against deployments where the same secret is configured.
