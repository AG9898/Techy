# Architecture — Techy

## System Overview

Techy is a **server-rendered SvelteKit 5 application** with a PostgreSQL database hosted on Neon. There is no separate backend service — all data access happens in SvelteKit's server-only `+page.server.ts` and `+server.ts` files, which run at request time in a serverless environment.

```
Browser
  │
  ├─ GET /                    → +page.server.ts (graph data) → ForceGraph.svelte (D3, client-only)
  ├─ GET /notes               → +page.server.ts (all notes)
  ├─ GET /notes/export        → +server.ts (zip all notes as Markdown)
  ├─ GET /notes/[slug]                  → +page.server.ts (note + links + rendered HTML)
  ├─ GET /notes/[slug]/history          → +page.server.ts (revision list for note)
  ├─ GET /notes/[slug]/history/[id]     → +page.server.ts (single revision, rendered HTML)
  ├─ POST /notes/new                    → +page.server.ts action (insert + wikilink sync)
  ├─ POST /notes/[slug]/edit            → +page.server.ts actions (snapshot + update / delete)
  ├─ GET /search              → +page.server.ts (ilike + arrayOverlaps query)
  ├─ GET /chat                → (app)/chat/+page.server.ts + +page.svelte (assistant chat UI — calls POST /api/assistant/query client-side)
  ├─ POST /api/ai/research      → +server.ts → researchTopic() → Claude API (claude-opus-4-6)
  ├─ POST /api/ai/generate-note → +server.ts → generateNote() → Claude API → insert note + sync links
  ├─ POST /api/assistant/query  → +server.ts → queryAssistant() → Claude API (claude-opus-4-6)
  ├─ GET /signin             → +page.server.ts / +page.svelte (custom sign-in UI)
  ├─ /debug/auth/login       → +server.ts (secret-gated debug session cookie)
  ├─ /debug/auth/logout      → +server.ts (clear debug session cookie)
  └─ /auth/[...auth]          → Auth.js catch-all (GitHub OAuth)
```

See [`docs/API.md`](API.md) for the full route reference including request params, response shapes, and form action fields.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend framework | SvelteKit | 2.50 |
| UI components | Svelte 5 (rune mode) | 5.54 |
| UI primitives | Melt UI | 0.44 |
| Styling | Tailwind CSS | 4.2 |
| Animation tooling | GSAP | 3.14 |
| Language | TypeScript (strict) | 5.9 |
| Build tool | Vite | 7 |
| Graph visualisation | D3.js | 7 |
| Markdown rendering | marked | 17 |
| ORM | Drizzle ORM | 0.45 |
| DB driver | @neondatabase/serverless (HTTP) | 1.0 |
| Database | Neon PostgreSQL | 16 |
| Auth | Auth.js (`@auth/sveltekit`) | 1.11 |
| Auth adapter | `@auth/drizzle-adapter` | 1.11 |
| Auth provider | GitHub OAuth | — |
| Deployment | Vercel (adapter-auto) | — |

---

## Directory Structure

```
src/
├── app.css                     # Tailwind entrypoint + global theme tokens/base styles
├── app.d.ts                    # Global TypeScript types (Locals, PageData)
├── app.html                    # HTML shell
├── hooks.server.ts             # Auth.js handle + optional debug-session override
├── lib/
│   ├── ai/
│   │   ├── claude.ts           # Claude API stub
│   │   ├── chatgpt.ts          # OpenAI API stub
│   │   └── prompts.ts          # System prompt templates
│   ├── assets/
│   │   └── favicon.svg
│   ├── components/
│   │   ├── ForceGraph.svelte   # D3 force-directed graph (client-only, onMount)
│   │   ├── Nav.svelte          # Top navigation bar
│   │   └── NoteCard.svelte     # Reusable note summary card
│   ├── server/
│   │   ├── auth.ts             # SvelteKitAuth config (GitHub provider, DrizzleAdapter)
│   │   └── db/
│   │       ├── index.ts        # Neon HTTP client + Drizzle instance
│   │       └── schema.ts       # All table definitions + inferred types
│   └── utils/
│       ├── slugify.ts          # title → URL-safe slug
│       ├── wikilinks.ts        # [[wikilink]] extractor + resolver
│       └── frontmatter.ts      # YAML frontmatter parser for note import
└── routes/
    ├── +layout.svelte          # Root public shell, imports app.css + head metadata
    ├── (app)/
    │   ├── +layout.server.ts   # Protected app gate + session loader
    │   ├── +layout.svelte      # App shell with Nav + page container
    │   ├── +page.server.ts     # Load graph data (nodes + links)
    │   ├── +page.svelte        # Home: D3 graph or empty state
    │   ├── notes/
    │   │   ├── +page.server.ts     # List all notes + delete + import actions
    │   │   ├── +page.svelte        # Notes grid with category filter + import + export
    │   │   ├── export/
    │   │   │   └── +server.ts      # GET: zip all notes as Markdown files for download
    │   │   ├── new/
    │   │   │   ├── +page.server.ts # Create note action
    │   │   │   └── +page.svelte    # Create form
    │   │   └── [slug]/
    │   │       ├── +page.server.ts # Load note + links + rendered HTML
    │   │       ├── +page.svelte    # Note detail view
    │   │       ├── edit/
    │   │       │   ├── +page.server.ts  # Snapshot to revisions + update / delete actions
    │   │       │   └── +page.svelte     # Edit form
    │   │       └── history/
    │   │           ├── +page.server.ts  # Load note + revision list (desc)
    │   │           ├── +page.svelte     # Revision history list
    │   │           └── [revisionId]/
    │   │               ├── +page.server.ts  # Load revision + render HTML
    │   │               └── +page.svelte     # Revision detail view
    │   ├── search/
    │   │   ├── +page.server.ts     # Search query (ilike + arrayOverlaps)
    │   │   └── +page.svelte        # Search form + results grid
    │   └── chat/
    │       ├── +page.server.ts     # Chat page data loader (returns {})
    │       └── +page.svelte        # Assistant chat UI — user bubbles, note link, summary, possible additions, topic chips
    ├── auth/[...auth]/
    │   └── +server.ts          # Auth.js catch-all (GET + POST)
    ├── debug/auth/
    │   ├── login/+server.ts    # Sets a signed debug session cookie when enabled
    │   └── logout/+server.ts   # Clears the debug session cookie
    ├── signin/
    │   ├── +page.server.ts     # Loads callbackUrl + auth error query params
    │   └── +page.svelte        # Styled GitHub sign-in page
    ├── api/ai/
    │   ├── research/+server.ts       # POST stub → AI research
    │   └── generate-note/+server.ts  # POST stub → AI note creation
    └── api/assistant/
        └── query/+server.ts          # Planned: natural-language note lookup + summary
```

---

## Database Schema

```sql
-- Auth.js tables (managed by @auth/drizzle-adapter)
users (id, name, email, email_verified, image)
accounts (user_id, type, provider, provider_account_id, ...)
sessions (session_token, user_id, expires)
verification_tokens (identifier, token, expires)

-- Application tables
notes (
  id          uuid PK default gen_random_uuid(),
  title       text NOT NULL,
  slug        text NOT NULL UNIQUE,
  body        text NOT NULL default '',
  tags        text[] NOT NULL default '{}',
  aliases     text[] NOT NULL default '{}',
  category    text,
  status      text CHECK(status IN ('stub','growing','mature')) default 'stub',
  ai_generated boolean NOT NULL default false,
  ai_model    text,
  ai_prompt   text,
  created_at  timestamp NOT NULL default now(),
  updated_at  timestamp NOT NULL default now()
)

note_links (
  id              uuid PK default gen_random_uuid(),
  source_note_id  uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  target_note_id  uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE
)

note_revisions (
  id          uuid PK default gen_random_uuid(),
  note_id     uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  title       text NOT NULL,
  body        text NOT NULL default '',
  tags        text[] NOT NULL default '{}',
  aliases     text[] NOT NULL default '{}',
  category    text,
  status      text CHECK(status IN ('stub','growing','mature')) NOT NULL default 'stub',
  revised_at  timestamp NOT NULL default now()
)
```

Schema source of truth: `src/lib/server/db/schema.ts`
Migrations output: `drizzle/`

See [`docs/NOTES.md`](NOTES.md) for the note field definitions, status values, tag taxonomy, and hub categories.

---

## Auth Flow

```
1. Every request runs `hooks.server.ts: sequence(debugAuthHandle, authHandle)`
2. `authHandle` (Auth.js) populates `event.locals.auth`
3. Requests under `src/routes/(app)` run `(app)/+layout.server.ts`
   - No session → redirect(303, '/signin')
   - Session present → render the protected app shell and page
4. `/signin` renders the standalone sign-in page outside the app shell
5. POST `/auth/signin/github` starts the GitHub OAuth flow
6. GitHub callback → Auth.js signIn() callback
   - Checks profile.login === ALLOWED_GITHUB_USERNAME
   - Returns false → redirect to /signin?error=AccessDenied
   - Returns true → session created via DrizzleAdapter (sessions table)
7. Session stored in DB, session token in HTTP-only cookie
8. Optional: `/debug/auth/login` can mint a signed debug cookie when `DEBUG_AUTH_BYPASS_ENABLED=true` and the request includes the correct bypass secret
```

---

## Wikilink Pipeline

See [`docs/NOTES.md`](NOTES.md) for the full wikilink format and authoring rules. Technical pipeline summary:

- **Save:** `extractWikilinks(body)` → title lookup → delete old `note_links` rows → insert new rows
- **Render:** `resolveWikilinks(body, slugMap)` → `marked()` → `{@html}`

Utilities: `src/lib/utils/wikilinks.ts`

---

## Orphan Note Detection

The `/notes` page detects orphan notes — notes with no incoming or outgoing links — via a server-side query in `src/routes/(app)/notes/+page.server.ts`. On each load, both notes and all `note_links` rows are fetched in parallel. A `Set` of all linked note IDs (union of `source_note_id` and `target_note_id`) is built in-memory; any note whose ID is absent from this set is an orphan. The load function returns `orphanIds: string[]` alongside the notes array.

The UI surfaces orphans as an "Orphans (N)" filter chip in the category filter row on `/notes`. Selecting it filters the grid to orphan notes only; each orphan card links to its detail page as normal. The chip is hidden when `orphanIds` is empty.

---

## D3 Force Graph

The `ForceGraph.svelte` component is **client-only** (runs in `onMount`). It receives pre-fetched `nodes` and `links` arrays from `+page.server.ts` as props.

- `forceSimulation` with `forceLink`, `forceManyBody`, `forceCenter`, `forceCollide`
- Nodes coloured by `status`: stub=`#64748b`, growing=`#38bdf8`, mature=`#4ade80`
- Pan/zoom via `d3.zoom()`
- Drag to reposition (transient, resets on release)
- Click node → SvelteKit `goto('/notes/{slug}')`
- Simulation stops on component destroy

---

## Styling System

Techy uses **Tailwind CSS v4** for utility-first styling and layout work, with a project-owned token system for visual identity. Global styling is loaded from `src/app.css`, which provides:

- the Tailwind stylesheet import
- theme token blocks under `[data-theme='night' | 'paper' | 'mist']`
- accent token blocks under `[data-accent='sky' | 'mint' | 'amber' | 'rose']`
- base resets, body styles, and global wikilink styles

### Theme and Accent System

`src/app.html` sets `data-theme="night" data-accent="sky"` on `<html>` as defaults. An inline `<script>` block in `app.html` reads `localStorage` before the first paint to prevent FOUC. `Nav.svelte` manages runtime state via Svelte 5 `$state`, syncing changes to `document.documentElement` and `localStorage`.

All components consume tokens via `var(--token-name)`. No hardcoded hex values should appear in new components. The D3 graph (`ForceGraph.svelte`) uses `var(--graph-node-*)`, `var(--graph-link)`, `var(--bg-base)` etc. as SVG attribute values so graph colours update automatically when the theme changes.

See [`docs/DESIGN-SPEC.md`](DESIGN-SPEC.md) for the full token reference, theme palettes, and accent values.

**Melt UI** is the chosen primitive layer for future interactive UI work — headless building blocks for dialogs, popovers, comboboxes, and other interactive controls.

**GSAP** is installed as optional motion tooling for animation-heavy interactions. Use selectively for graph transitions, panel reveals, or guided choreography.

High-level visual direction, page composition, and theming guidance live in [`docs/STYLE-GUIDE.md`](STYLE-GUIDE.md).

---

## AI Integration

Two providers are scaffolded in `src/lib/server/ai/`:

- **`claude.ts`** — live. Exports:
  - `researchTopic(topic)` — calls `claude-opus-4-6` with `RESEARCH_SYSTEM_PROMPT`, returns a Markdown string.
  - `generateNote(topic)` — calls `claude-opus-4-6` with `NOTE_GENERATION_SYSTEM_PROMPT`, returns Markdown with frontmatter.
  - `queryAssistant(note, userQuery, existingTopics)` — calls `claude-opus-4-6` with `ASSISTANT_QUERY_SYSTEM_PROMPT`; returns `{ summary, possibleGaps, newTopicIdeas }` as parsed JSON.
  - `getNextNoteRecommendations(topic, existingTopics)` — calls `claude-opus-4-6` with `NOTE_RECOMMENDATIONS_SYSTEM_PROMPT`; returns a `string[]` of exactly 3 adjacent topic candidates, de-duplicated against `existingTopics`.
  - `ANTHROPIC_API_KEY` is read from `$env/dynamic/private`.
- **`chatgpt.ts`** — live. Exports:
  - `researchTopic(topic)` — calls `gpt-4o` with `RESEARCH_SYSTEM_PROMPT`, returns a Markdown string.
  - `generateNote(topic)` — calls `gpt-4o` with `NOTE_GENERATION_SYSTEM_PROMPT`, returns Markdown with frontmatter.
  - `getNextNoteRecommendations(topic, existingTopics)` — calls `gpt-4o` with `NOTE_RECOMMENDATIONS_SYSTEM_PROMPT`; returns a `string[]` of exactly 3 adjacent topic candidates, de-duplicated against `existingTopics`.
  - `OPENAI_API_KEY` is read from `$env/dynamic/private`.

All share system prompts from `prompts.ts` and are called from:
- `POST /api/ai/research` — returns `{body: string}` draft Markdown for a topic. Accepts optional `provider: 'claude' | 'chatgpt'` (defaults to `'claude'`).
- `POST /api/ai/generate-note` — live. Accepts optional `provider: 'claude' | 'chatgpt'` (defaults to `'claude'`). Calls the chosen provider's `generateNote()`, parses frontmatter, inserts note with `ai_generated=true` and `ai_model` set to the provider's model, syncs `[[wikilinks]]`, then calls `getNextNoteRecommendations(topic, existingTopics)` to produce 3 de-duplicated next-note candidates. Returns `{ note: { id, slug, title }, nextNoteIdeas: string[] }`. Returns 409 on slug/title conflict.
- `POST /api/assistant/query` — live. Resolves a natural-language query to an existing note via 5-tier matching (exact title → exact alias → title-in-query → alias-in-query → partial title), then calls `queryAssistant()` to produce a grounded summary with gap suggestions and 3 new topic ideas.

Error handling: 400 for missing/invalid input, 401 for invalid API key, 409 for duplicate slug or title, 429 for rate limits, 500 for other failures.

The `ai_generated`, `ai_model`, and `ai_prompt` columns on the `notes` table track provenance of AI-created content.

---

## Note Assistant

The assistant layer sits on top of the existing notes table. Implemented at `POST /api/assistant/query`.

**Retrieval flow:**

1. The query string is matched against existing notes using a 5-tier cascade (most-exact-first):
   - Exact title match (case-insensitive SQL `LOWER(title) = $query`)
   - Exact alias match (`UNNEST(aliases)` with `LOWER(a) = $query`)
   - Title appears in query (`LOWER($query) LIKE '%' || LOWER(title) || '%'`)
   - Any alias appears in query (same pattern with unnested aliases)
   - Partial title `ilike` fallback
2. The matched note's body is passed to `queryAssistant()` alongside all existing note titles and aliases.
3. `claude-opus-4-6` returns a JSON object with `summary`, `possibleGaps`, and `newTopicIdeas`.
4. The handler validates the JSON shape and returns the structured response.

**Grounding rules (enforced by `ASSISTANT_QUERY_SYSTEM_PROMPT`):**

- The summary reflects only what is stated in the note; general model knowledge is not added.
- Gap suggestions are phrased as possible additions, not confirmed omissions.
- New-topic recommendations are exactly 3 and must not duplicate any existing note title or alias.
