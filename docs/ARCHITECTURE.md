# Architecture — Techy

## System Overview

Techy is a **server-rendered SvelteKit 5 application** with a PostgreSQL database hosted on Neon. There is no separate backend service — all data access happens in SvelteKit's server-only `+page.server.ts` and `+server.ts` files, which run at request time in a serverless environment.

```
Browser
  │
  ├─ GET /                    → +page.server.ts (graph data) → ForceGraph.svelte (D3, client-only)
  ├─ GET /notes               → +page.server.ts (all notes)
  ├─ GET /notes/[slug]        → +page.server.ts (note + links + rendered HTML)
  ├─ POST /notes/new          → +page.server.ts action (insert + wikilink sync)
  ├─ POST /notes/[slug]/edit  → +page.server.ts actions (update / delete)
  ├─ GET /search              → +page.server.ts (ilike + arrayOverlaps query)
  ├─ GET /chat                → +page.svelte (planned assistant chat surface)
  ├─ POST /api/ai/research    → +server.ts → researchTopic() → Claude API (claude-opus-4-6)
  ├─ POST /api/assistant/query → +server.ts (planned note-grounded assistant lookup)
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
├── hooks.server.ts             # Auth.js handle + auth guard
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
│       └── wikilinks.ts        # [[wikilink]] extractor + resolver
└── routes/
    ├── +layout.server.ts       # Session loader (runs on every request)
    ├── +layout.svelte          # Root layout, Nav, imports app.css
    ├── +page.server.ts         # Load graph data (nodes + links)
    ├── +page.svelte            # Home: D3 graph or empty state
    ├── auth/[...auth]/
    │   └── +server.ts          # Auth.js catch-all (GET + POST)
    ├── notes/
    │   ├── +page.server.ts     # List all notes + delete action
    │   ├── +page.svelte        # Notes grid with category filter
    │   ├── new/
    │   │   ├── +page.server.ts # Create note action
    │   │   └── +page.svelte    # Create form
    │   └── [slug]/
    │       ├── +page.server.ts # Load note + links + rendered HTML
    │       ├── +page.svelte    # Note detail view
    │       └── edit/
    │           ├── +page.server.ts  # Update + delete actions
    │           └── +page.svelte     # Edit form
    ├── search/
    │   ├── +page.server.ts     # Search query (ilike + arrayOverlaps)
    │   └── +page.svelte        # Search form + results grid
    ├── chat/
    │   ├── +page.server.ts     # Planned: chat page shell / data loading
    │   └── +page.svelte        # Planned: assistant chat UI
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
```

Schema source of truth: `src/lib/server/db/schema.ts`
Migrations output: `drizzle/`

See [`docs/NOTES.md`](NOTES.md) for the note field definitions, status values, tag taxonomy, and hub categories.

---

## Auth Flow

```
1. User visits any non-/auth/* route
2. hooks.server.ts: sequence(authHandle, authGuard)
3. authHandle (Auth.js): populates event.locals.auth
4. authGuard: calls event.locals.auth()
   - No session → redirect(303, '/auth/signin')
   - Session present → resolve(event)
5. /auth/signin → GitHub OAuth redirect
6. GitHub callback → Auth.js signIn() callback
   - Checks profile.login === ALLOWED_GITHUB_USERNAME
   - Returns false → redirect to /auth/error?error=AccessDenied
   - Returns true → session created via DrizzleAdapter (sessions table)
7. Session stored in DB, session token in HTTP-only cookie
```

---

## Wikilink Pipeline

See [`docs/NOTES.md`](NOTES.md) for the full wikilink format and authoring rules. Technical pipeline summary:

- **Save:** `extractWikilinks(body)` → title lookup → delete old `note_links` rows → insert new rows
- **Render:** `resolveWikilinks(body, slugMap)` → `marked()` → `{@html}`

Utilities: `src/lib/utils/wikilinks.ts`

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

Two providers are scaffolded in `src/lib/ai/`:

- **`claude.ts`** — live. `researchTopic(topic)` calls `claude-opus-4-6` using `@anthropic-ai/sdk` with `RESEARCH_SYSTEM_PROMPT` and returns a Markdown string. `ANTHROPIC_API_KEY` is read from `$env/static/private`.
- **`chatgpt.ts`** — stub only (see AI-002).

Both share system prompts from `prompts.ts` and are called from:
- `POST /api/ai/research` — returns `{body: string}` draft Markdown for a topic (Claude live; provider param for GPT planned in AI-002)
- `POST /api/ai/generate-note` — stub; creates a full note and inserts it into the DB (planned)

Error handling in `/api/ai/research`: 400 for missing topic, 401 for invalid API key, 429 for rate limits, 500 for other failures.

The `ai_generated`, `ai_model`, and `ai_prompt` columns on the `notes` table track provenance of AI-created content.

---

## Note Assistant (Planned)

The assistant layer is intended to sit on top of the existing notes table rather than replace it. Its primary responsibilities are:

- resolve a natural-language request such as "tell me about SvelteKit" to an existing note
- return a linkable note match by title or alias
- generate a concise summary grounded in the saved note content
- suggest possible additions that may strengthen the note, clearly labeled as suggestions
- suggest exactly 3 adjacent topics that are not already present as note titles or aliases

Planned retrieval flow:

1. Parse the user query and extract the likely target topic.
2. Search `notes.title` first, then `notes.aliases`, with exact matches preferred over partial matches.
3. Load the matched note plus lightweight metadata needed for context, such as category, tags, and linked notes.
4. Pass the matched note content and the full set of existing titles and aliases into the assistant prompt.
5. Return a structured response containing the note link, grounded summary, possible gaps, and 3 new-topic recommendations.

Grounding rules:

- The summary should reflect the saved note first, not general model knowledge presented as if it came from the graph.
- Any "missing" areas should be phrased as likely additions, expansion ideas, or underdeveloped sections.
- New-topic recommendations must be de-duplicated against existing note titles and aliases before returning them.
