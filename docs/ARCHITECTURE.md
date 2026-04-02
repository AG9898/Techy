# Architecture — Techy

This document covers Techy's system structure, runtime boundaries, and major data flows for the assistant-first direction. It intentionally does not own route contracts, database-table reference detail, note-authoring rules, or UI styling policy.

For those topics, see:
- [`docs/API.md`](API.md) for routes, form actions, and JSON endpoint contracts
- [`docs/schema.md`](schema.md) for persisted tables and planned schema direction
- [`docs/NOTES.md`](NOTES.md) for note fields, wikilinks, and authoring rules
- [`docs/DESIGN-SPEC.md`](DESIGN-SPEC.md) and [`docs/STYLE-GUIDE.md`](STYLE-GUIDE.md) for shell, layout, theming, and visual direction

## System Overview

Techy is a server-rendered SvelteKit 5 application backed by Neon PostgreSQL. There is no separate backend service. Request-time server work stays inside SvelteKit server modules, while the browser handles client-only graph rendering and interactive UI state.

The main architectural boundaries are:
- SvelteKit page loads, form actions, and JSON endpoints handle product-facing server work
- Drizzle is the persistence layer between server routes and Neon PostgreSQL
- assistant orchestration stays inside the app server layer rather than a separate service
- Auth.js owns OAuth/session handling, while route protection is enforced in the app shell
- D3 graph rendering stays client-only and consumes pre-fetched graph data from server load
- SvelteKit server modules read app secrets through `$env/dynamic/private`, while non-app CLI/config files such as `drizzle.config.ts` continue to use plain Node env access

See [`docs/API.md`](API.md) for the route-by-route surface and endpoint contracts.

---

## App Shell Layout

The `(app)` route group uses a flex-row shell defined in `src/routes/(app)/+layout.svelte`:

```
.app-shell { display: flex; height: 100vh; overflow: hidden; }
  ├── Nav.svelte        — left rail, position: sticky, height: 100vh
  └── <main class="page-content">  — flex: 1, overflow-y: auto, padding: 2rem
```

The `--rail-w` CSS variable (set on `document.documentElement`) is the contract between the rail and any child page that needs to know the current rail width at runtime:

| Variable | Value |
|---|---|
| `--rail-w-expanded` | `192px` |
| `--rail-w-collapsed` | `52px` |
| `--rail-w` | updated live to the rail's current visual width, including temporary explicit-open state |

Most pages scroll inside `.page-content` and never need to reference `--rail-w`. The graph page (`/`) is the current exception: it opts out of `.page-content` scroll by using `position: fixed; top: 0; left: var(--rail-w); right: 0; bottom: 0` so the D3 canvas fills the remaining viewport exactly. Any future page that needs the same full-bleed treatment must anchor to `left: var(--rail-w)`, not a hardcoded pixel value.

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

```text
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
│   │   │   └── models.ts
│   │   ├── assistant/
│   │   │   ├── orchestrator.ts
│   │   │   ├── research.ts
│   │   │   ├── proposals.ts
│   │   │   └── commit.ts
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
    │       ├── +page.server.ts
    │       ├── +page.svelte
    │       └── [conversationId]/+page.server.ts
    ├── api/
    │   ├── assistant/
    │   │   ├── respond/+server.ts
    │   │   └── commit/+server.ts
    │   └── ai/
    │       ├── research/+server.ts
    │       └── generate-note/+server.ts
    ├── auth/[...auth]/+server.ts
    ├── debug/auth/...
    └── signin/...
```

---

## Auth Flow

Auth remains session-based and request-scoped:

1. Every request passes through `hooks.server.ts`.
2. Auth.js populates `event.locals.auth`.
3. Routes under `src/routes/(app)` require a session.
4. Public auth surfaces remain outside the protected app shell.
5. GitHub sign-in is limited by `ALLOWED_GITHUB_USERNAME`.
6. Session state is stored in Postgres and carried by HTTP-only cookies.
7. An optional debug bypass can mint a signed session when explicitly enabled.

---

## Assistant Architecture

The assistant is the primary authoring layer over the notes system. The architecture is split into two request-time concerns: orchestration and commit.

### Orchestration

`POST /api/assistant/respond` is the runtime boundary for:
- validating the provider/model pair against the server allowlist
- resolving the user's intent from the conversation and any explicit UI override
- conservatively matching the turn to an existing note when update/review behavior is plausible
- loading matched-note body context for note-aware conversational turns when a strong exact title or alias hit exists
- grounding the request with live web research when the resolved intent requires it
- resolving current note context for update flows before prompting the model
- deriving an explicit delete target only when the user clearly asks to delete a selected or strongly matched saved note
- deciding whether the assistant should answer conversationally only or also return a structured proposal
- normalizing proposal payloads before they return to the UI

Target request-time sequence:
1. validate provider/model
2. inspect the transcript and optional override to resolve intent
3. attempt conservative existing-note matching when update/review behavior is plausible
4. gather live research for create/update-style turns
5. assemble one shared assistant-identity prompt plus layered skill-specific routing context
6. normalize the assistant response and any proposal metadata for the UI

The endpoint is stateless with respect to provider-managed hidden conversation memory. When a saved conversation is resumed, the app rebuilds the transcript from app-owned history and sends that transcript back through the same endpoint.

The shared router lives in `src/lib/server/assistant/routing.ts`. It normalizes the new `override` field plus the legacy `mode` alias, inspects the latest user turn, attempts conservative exact title/alias matching against saved notes, and returns routing metadata (`overrideSource`, `matchedNote`, `targetNote`, `noteId`) alongside the assistant response so the UI can expose the resolved branch without guessing on the client. Strong note matches do not automatically force mutation mode: in conversational routing, the respond endpoint can inject the matched note body into the shared prompt so the model can summarize what is already saved and offer follow-up research or review without emitting an update proposal.

### Commit Boundary

`POST /api/assistant/commit` is the mutation boundary for assistant-confirmed proposals:
- create note
- update note
- delete note

The commit path is responsible for persisting confirmed changes, taking revision snapshots before updates, syncing `note_links`, and applying any assistant-supplied reciprocal link patches to existing notes.

Canonical note-category enforcement is shared across the server write layer rather than duplicated per route. Assistant commit, manual note create/edit actions, and Markdown import all validate against the same taxonomy helper before persistence, while tags remain intentionally open vocabulary.

### Live Research

Live research is part of assistant orchestration for creation and comparison/update flows. Purely conversational turns may remain chat-only even when a related note exists, while still offering follow-up research or review actions. Topic reuse is treated as a runtime optimization inside the current conversation, not a durable persisted store.

Delete proposals stay behind an explicit-intent gate. The shared prompt may surface `delete_note` only when the latest user turn clearly asks to delete/remove a specifically selected or strongly matched saved note; otherwise conversational turns keep `proposal: null`.

### Chat History

The target architecture uses app-owned transcript storage rather than provider-owned session state. Canonical history should store message content, lightweight citations, and proposal snapshots when present, while avoiding provider conversation IDs, raw hidden context, and raw research payloads as durable state.

The current Drizzle schema does not yet contain the planned chat-history tables described in the target direction. See [`docs/schema.md`](schema.md) for the distinction between current tables and planned schema additions.

### Provider / Model Abstraction

Assistant routes accept provider/model pairs rather than hard-coding a single model family.

Current direction:
- Anthropic and OpenAI are the supported providers
- approved combinations live in `src/lib/server/ai/models.ts`
- provider adapters may differ internally, but the external request contract stays unified
- OpenRouter compatibility is a future concern, not part of the current phase

---

## D3 Force Graph

`ForceGraph.svelte` remains client-only. The graph consumes server-loaded `nodes` and `links` arrays and should reflect saved note/link changes immediately after the corresponding server commit succeeds.

Graph-view preferences are owned entirely by the client and persisted to `localStorage` under the key `techy:graph-settings`. The stored shape is `{ colorMode, hiddenCategories, hiddenStatuses, nodeScale, linkThickness, textFadeThreshold, linkDistance, chargeStrength, collisionPadding, centeringStrength, velocityDecay, alphaDecay }`. Settings are loaded at component init, sanitized/clamped to valid ranges, and written back via a `$effect` on every change. Malformed or missing values fall back to the documented defaults. Appearance controls update SVG selections in place, while simulation-facing controls update the existing D3 force refs and reheat the simulation without rebuilding the graph. This introduces no API contracts or database-backed user preferences.

Current boundary:
- graph data (`nodes` and `links`) is loaded on the server and passed into the page
- graph rendering, simulation state, and graph-control interactions stay in the browser
- persisted graph-view tuning is local UI state, not durable application data
- `controlsOpen` (panel open/closed) is transient UI state and is not persisted
