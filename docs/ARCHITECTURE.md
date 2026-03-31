# Architecture — Techy

This document reflects the **target assistant-first architecture direction** agreed for the next work phase. Some paths and flows described here intentionally supersede code that still exists today; the workboard will track that migration.

## System Overview

Techy is a **server-rendered SvelteKit 5 application** with a PostgreSQL database hosted on Neon. There is no separate backend service — data access and assistant orchestration live in SvelteKit server-only `+page.server.ts` and `+server.ts` files, which run at request time in a serverless environment.

```
Browser
  │
  ├─ GET /                    → +page.server.ts (graph data) → ForceGraph.svelte (D3, client-only)
  ├─ GET /notes               → +page.server.ts (repository data + search/filter state + orphan detection)
  ├─ GET /notes/export        → +server.ts (zip all notes as Markdown)
  ├─ GET /notes/[slug]        → +page.server.ts (note + links + rendered HTML)
  ├─ GET /notes/[slug]/history          → +page.server.ts (revision list)
  ├─ GET /notes/[slug]/history/[id]     → +page.server.ts (single revision)
  ├─ POST /notes?/import      → +page.server.ts action (batch import + wikilink sync)
  ├─ GET /chat                → (app)/chat/+page.server.ts + +page.svelte (assistant chat + proposal UI)
  ├─ GET /chat/[conversationId] → (app)/chat/[conversationId]/+page.server.ts + +page.svelte (resume saved chat transcript)
  ├─ POST /api/assistant/respond → +server.ts → assistant orchestrator → live web research + provider model
  ├─ POST /api/assistant/commit  → +server.ts → DB mutation + link sync + revision snapshot
  ├─ POST /api/ai/research    → legacy helper endpoint
  ├─ POST /api/ai/generate-note → legacy helper endpoint
  ├─ GET /signin             → +page.server.ts / +page.svelte (custom sign-in UI)
  ├─ /debug/auth/login       → +server.ts (secret-gated debug session cookie)
  ├─ /debug/auth/logout      → +server.ts (clear debug session cookie)
  └─ /auth/[...auth]         → Auth.js catch-all (GitHub OAuth)
```

The dedicated `/notes/new` page is no longer part of the intended product architecture. New note creation moves into `/chat`. The dedicated `/search` page is also being retired so browsing and search converge on `/notes`.

See [`docs/API.md`](API.md) for the target route reference including request params, response shapes, and assistant proposal behavior.

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

Target structure after the assistant-first migration:

```
src/
├── app.css
├── hooks.server.ts
├── lib/
│   ├── components/
│   │   ├── ForceGraph.svelte
│   │   ├── Nav.svelte
│   │   └── NoteCard.svelte
│   ├── server/
│   │   ├── ai/
│   │   │   ├── anthropic.ts / claude.ts
│   │   │   ├── openai.ts / chatgpt.ts
│   │   │   ├── prompts.ts
│   │   │   └── models.ts          # approved provider/model map
│   │   ├── assistant/
│   │   │   ├── orchestrator.ts    # respond flow
│   │   │   ├── research.ts        # live web research normalization
│   │   │   ├── proposals.ts       # create/update/delete proposal shaping
│   │   │   └── commit.ts          # confirmed mutations
│   │   ├── auth.ts
│   │   └── db/
│   │       ├── index.ts
│   │       └── schema.ts
│   └── utils/
│       ├── frontmatter.ts
│       ├── slugify.ts
│       └── wikilinks.ts
└── routes/
    ├── (app)/
    │   ├── +page.server.ts
    │   ├── +page.svelte
    │   ├── notes/
    │   │   ├── +page.server.ts
    │   │   ├── +page.svelte
    │   │   ├── export/+server.ts
    │   │   └── [slug]/...
    │   └── chat/
    │       ├── +page.server.ts    # provider/model options + conversation index
    │       ├── +page.svelte       # conversation + editable proposal UI
    │       └── [conversationId]/
    │           └── +page.server.ts # saved transcript load for resume
    ├── api/
    │   ├── assistant/
    │   │   ├── respond/+server.ts
    │   │   └── commit/+server.ts
    │   └── ai/
    │       ├── research/+server.ts      # legacy helper
    │       └── generate-note/+server.ts # legacy helper
    ├── auth/[...auth]/+server.ts
    ├── debug/auth/...
    └── signin/...
```

---

## Database Schema

The current note schema remains the source of truth for the assistant-first phase:

```sql
notes (
  id           uuid PK,
  title        text NOT NULL,
  slug         text NOT NULL UNIQUE,
  body         text NOT NULL default '',
  tags         text[] NOT NULL default '{}',
  aliases      text[] NOT NULL default '{}',
  category     text,
  status       text CHECK(status IN ('stub','growing','mature')) default 'stub',
  ai_generated boolean NOT NULL default false,
  ai_model     text,
  ai_prompt    text,
  created_at   timestamp NOT NULL default now(),
  updated_at   timestamp NOT NULL default now()
)

note_links (
  id              uuid PK,
  source_note_id  uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  target_note_id  uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE
)

note_revisions (
  id          uuid PK,
  note_id     uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  title       text NOT NULL,
  body        text NOT NULL default '',
  tags        text[] NOT NULL default '{}',
  aliases     text[] NOT NULL default '{}',
  category    text,
  status      text CHECK(status IN ('stub','growing','mature')) NOT NULL default 'stub',
  revised_at  timestamp NOT NULL default now()
)

chat_conversations (
  id               uuid PK,
  title            text,
  created_at       timestamp NOT NULL default now(),
  updated_at       timestamp NOT NULL default now(),
  last_message_at  timestamp NOT NULL default now()
)

chat_messages (
  id               uuid PK,
  conversation_id  uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role             text CHECK(role IN ('user','assistant')) NOT NULL,
  content          text NOT NULL,
  citations        jsonb,
  proposal         jsonb,
  created_at       timestamp NOT NULL default now()
)
```

**Schema note:**
- The assistant-first phase does **not** introduce a dedicated citation table.
- Live-web citations remain chat-review data, not persisted note metadata.
- Planned chat history should persist canonical transcript data only: message text, lightweight citations, and proposal snapshots when present.
- Planned chat history should not persist provider-managed conversation IDs, raw live-research summaries, or the ephemeral topic-cache object as durable state.

Schema source of truth: `src/lib/server/db/schema.ts`

---

## Auth Flow

Unchanged from the current model:

1. Every request runs `hooks.server.ts`.
2. Auth.js populates `event.locals.auth`.
3. Requests under `src/routes/(app)` require a session.
4. `/signin` remains outside the protected app shell.
5. GitHub callback validates `ALLOWED_GITHUB_USERNAME`.
6. Session is stored in DB and carried by HTTP-only cookie.
7. Optional debug bypass remains available when explicitly enabled.

---

## Assistant Architecture

The assistant becomes the primary authoring layer on top of the existing notes table.

### Respond flow

`POST /api/assistant/respond` is responsible for:
- receiving the current conversation transcript
- receiving the explicit UI mode (`chat` or `create`)
- validating provider/model choice
- performing live web research for create and compare flows
- reusing topic context already known in the current conversation cache
- resolving whether the assistant should stay conversational or return a structured proposal

Planned chat-history note:
- the respond endpoint remains stateless with respect to provider-side conversation memory
- when a saved conversation is resumed, the app rebuilds the transcript from `chat_messages` and sends it back through `/api/assistant/respond`
- the persisted transcript is the product source of truth; provider-managed hidden memory is not relied upon

### Proposal types

The assistant may return:
- `create_note`
- `update_note`
- `delete_note`

Create/update proposals include a full editable draft. Delete proposals include confirmation metadata only.

### Commit flow

`POST /api/assistant/commit` is responsible for:
- persisting confirmed create/update/delete proposals
- taking revision snapshots before updates
- syncing `note_links` from the saved body
- applying assistant-supplied linked-note patches where the new note should also appear in existing note bodies

### Live research

Live web research is mandatory for:
- assistant-driven note creation
- assistant-driven note comparison/update proposals

If the same topic has already been researched in the current chat session, the assistant should reuse the cached research context instead of re-running the same research request.

Planned persistence note:
- the topic cache remains an ephemeral optimization for the active runtime
- resumed chat history does not depend on a persisted raw topic cache
- when necessary, live research may be rerun after a conversation is resumed from saved transcript state

### Chat history

Planned chat history should be implemented as app-owned transcript storage rather than provider-owned session state.

Rules:
- save conversation/message records in Postgres so a user can reopen prior chats
- store user/assistant message content, normalized citations, and proposal snapshots when present
- do not store provider conversation IDs or raw hidden context state
- do not treat raw research payloads as durable history data
- rebuild provider input from saved messages whenever a conversation is resumed
- keep storage lean enough for Neon free-tier usage; later retention or summarization can be added if needed

### Provider/model abstraction

The assistant API should accept provider/model pairs rather than hard-coding a single model.

V1 target support:
- Anthropic
- OpenAI

Current registry notes:
- The approved provider/model combinations live in `src/lib/server/ai/models.ts`.
- Anthropic currently defaults to `claude-opus-4-6`.
- OpenAI currently defaults to `gpt-5-mini` and exposes `gpt-5.2`, `gpt-5-mini`, `gpt-4o`, and `gpt-4o-mini`.

Adapter notes:
- Anthropic is currently integrated through the Messages API and prompt-enforced JSON output parsing.
- OpenAI is currently integrated through the Responses API while preserving the same external `provider` / `model` request contract.
- GPT-5-family OpenAI requests may include adapter-level reasoning configuration, but that remains an implementation detail behind the unified endpoint.

The interface should remain compatible with a future OpenRouter adapter, but OpenRouter itself is not part of the immediate phase.

---

## Wikilink Pipeline

See [`docs/NOTES.md`](NOTES.md) for the full wikilink format and authoring rules. Technical pipeline summary:

- **Save note body:** `extractWikilinks(body)` → title lookup → delete old `note_links` rows → insert new rows
- **Render:** `resolveWikilinks(body, slugMap)` → `marked()` → `{@html}`
- **Assistant reciprocal linking:** if a newly created note should also be referenced by existing notes, the confirmed assistant flow updates those note bodies to add the new `[[Title]]` link and re-syncs their `note_links` rows in the same commit sequence

Utilities: `src/lib/utils/wikilinks.ts`

---

## Orphan Note Detection

The `/notes` page continues to detect orphan notes — notes with no incoming or outgoing links — via a server-side query. The UI continues to expose orphan filtering in the notes browsing experience.

---

## App Shell

Protected app routes continue to share a common shell, but the intended shell direction is now a collapsible left rail rather than a sticky horizontal nav.

Rules:
- the rail owns primary route navigation, theme/accent controls, and account actions
- the graph route should default to a tucked or minimized rail state to preserve immersion
- notes, chat, and detail routes may use a fuller rail state when it improves browsing and wayfinding
- Melt UI is an appropriate primitive layer for collapse and disclosure behavior, but not for final styling

---

## D3 Force Graph

The `ForceGraph.svelte` component remains client-only. It consumes pre-fetched `nodes` and `links` arrays from server load.

The graph should continue to update immediately after confirmed assistant note creation because link sync happens during the same save flow.

---

## Styling System

Techy continues to use Tailwind CSS v4 plus project-owned design tokens. The theme system changes from three named themes to a two-mode tonal model, with dark mode tuned around neutral charcoal surfaces rather than cool blue slate:

- `data-theme='dark'`
- `data-theme='light'`

Accent selection remains independent of theme and continues to cascade into the D3 graph.

Typography direction:
- `Space Mono` is the authoritative app font across shell and page surfaces

`src/app.html` should set `data-theme="dark" data-accent="sky"` as defaults and restore persisted values before first paint.

All components consume tokens via `var(--token-name)`. No hardcoded hex values should appear in new components.

Melt UI remains the preferred primitive layer for interactive controls. GSAP remains the optional motion layer for selected assistant/navigation transitions.
