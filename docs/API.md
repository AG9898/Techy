# API Reference — Techy

All routes are SvelteKit. Page routes return SSR HTML. Form actions use `application/x-www-form-urlencoded`. JSON API routes use `application/json`.

Authentication is enforced globally via `hooks.server.ts` — all routes except `/auth/*` require a valid session cookie.

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
Dedicated assistant chat page.

**Status:** Planned — not implemented yet.

This route will host the primary assistant UI, using a familiar chat layout with a persistent composer and supporting grounded-note context.

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

**Response (planned):**
```json
{ "body": "# SvelteKit\n\n..." }
```

**Current response:**
```json
{ "error": "AI research not yet implemented" }
```
HTTP `501`

---

### `POST /api/ai/generate-note`
Generate a complete note and insert it into the database.

**Status:** Stub — returns `501` until AI-001 / AI-002 are implemented.

**Request body:**
```json
{
  "topic": "SvelteKit",
  "provider": "claude"
}
```

**Response (planned):**
```json
{
  "note": { "id": "...", "slug": "sveltekit", "title": "SvelteKit" }
}
```

**Current response:**
```json
{ "error": "AI note generation not yet implemented" }
```
HTTP `501`

---

### `POST /api/assistant/query`
Look up an existing note from a natural-language request and return a note-grounded assistant response.

**Status:** Planned — not implemented yet.

**Request body:**
```json
{
  "query": "tell me about SvelteKit"
}
```

| Field | Required | Values |
|-------|----------|--------|
| `query` | yes | Natural-language request that should resolve to an existing note |

**Response (planned):**
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

**Planned behaviour:**
- Resolve the target note primarily by title and aliases
- `summary` should be grounded in the saved note content, not a free-form answer detached from the knowledge base
- `possibleGaps` must be presented as suggested additions or underdeveloped areas, not guaranteed omissions
- `newTopicIdeas` must contain exactly 3 suggestions
- `newTopicIdeas` must exclude topics that already exist as note titles or aliases

**Errors (planned):**
- `400` — query missing
- `404` — no matching note found

---

## Auth Routes

All auth routes are handled by Auth.js (`@auth/sveltekit`) via the catch-all at `src/routes/auth/[...auth]/+server.ts`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/auth/signin` | Sign-in page (rendered by Auth.js) |
| `GET` | `/auth/callback/github` | GitHub OAuth callback — do not call directly |
| `POST` | `/auth/signout` | Sign out (form POST from Nav) |
| `GET` | `/auth/error` | Auth error page (e.g. `?error=AccessDenied`) |

**Sign-out usage** (from any Svelte component):
```html
<form method="POST" action="/auth/signout">
  <button type="submit">Sign out</button>
</form>
```
