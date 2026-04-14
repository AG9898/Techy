# Architecture — Techy

This document covers Techy's system structure, runtime boundaries, and major data flows for the assistant-first direction. It intentionally does not own route contracts, database-table reference detail, note-authoring rules, or UI styling policy.

For those topics, see:
- [`docs/API.md`](API.md) for routes, form actions, and JSON endpoint contracts
- [`docs/schema.md`](schema.md) for persisted tables and planned schema direction
- [`docs/NOTES.md`](NOTES.md) for note fields, wikilinks, and authoring rules
- [`docs/PWA-SPEECH.md`](PWA-SPEECH.md) for private PWA and speech feature planning
- [`docs/DESIGN-SPEC.md`](DESIGN-SPEC.md) and [`docs/STYLE-GUIDE.md`](STYLE-GUIDE.md) for shell, layout, theming, and visual direction

## System Overview

Techy is a server-rendered SvelteKit 5 application backed by Neon PostgreSQL. There is no separate backend service. Request-time server work stays inside SvelteKit server modules, while the browser handles client-only graph rendering and interactive UI state.

The dedicated `/search` route has been removed; browsing and search now live in `/notes`.

The main architectural boundaries are:
- SvelteKit page loads, form actions, and JSON endpoints handle product-facing server work
- Drizzle is the persistence layer between server routes and Neon PostgreSQL
- assistant orchestration stays inside the app server layer rather than a separate service
- Auth.js owns OAuth/session handling, while route protection is enforced in the app shell
- D3 graph rendering stays client-only and consumes pre-fetched graph data from server load
- the mobile app shape is an online-first PWA over the existing authenticated web app, not a native wrapper
- speech features are an optional client/input-output layer over existing note and assistant contracts
- SvelteKit server modules read app secrets through `$env/dynamic/private`, while non-app CLI/config files such as `drizzle.config.ts` continue to use plain Node env access
- one-off operator maintenance scripts live in `scripts/` and run outside request handling; they may reuse the shared DB schema and taxonomy helpers, but they are not part of normal app traffic

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
│   │   │   ├── openrouter.ts
│   │   │   ├── prompts.ts
│   │   │   └── models.ts
│   │   ├── assistant/
│   │   │   ├── orchestrator.ts
│   │   │   ├── research.ts
│   │   │   ├── conversations.ts
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
    │       └── [conversationId]/
    │           ├── +page.server.ts
    │           └── +page.svelte
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
The dedicated `/notes/new` route has been removed; new-note authoring stays inside `/chat`.

### Orchestration

`POST /api/assistant/respond` is the runtime boundary for:
- validating the provider/model pair against the server allowlist
- creating a new app-owned conversation, or validating ownership of an existing one, for the authenticated session user
- appending the latest user turn before the provider call and the generated assistant turn after a successful response
- resolving the user's intent from the conversation and any explicit UI override
- conservatively matching the turn to an existing note when update/review behavior is plausible
- loading matched-note body context for note-aware conversational turns when a strong exact title or alias hit exists
- grounding create/update prompting with the shared canonical category taxonomy plus a bounded deterministic snapshot of existing lower-case note tags
- enforcing the shared note-body skeleton so assistant drafts always use `Overview`, `Description`, `Key Concepts`, `Connections`, and `Resources` in order, with only approved optional sections allowed between `Key Concepts` and `Connections`
- keeping `Overview` brief, treating `Description` as the primary deep-explanation section, preferring evergreen explanation over release-churn unless `Version Notes` is warranted, and rejecting deprecated default headings such as `Current Status`, `Notable Features`, `Quick Examples`, and `Industry Usage`
- grounding the request with live web research when the resolved intent requires it
- resolving current note context for update flows before prompting the model
- deriving an explicit delete target only when the user clearly asks to delete a selected or strongly matched saved note
- deciding whether the assistant should answer conversationally only or also return a structured proposal
- allowing eligible topic-learning prompts in inference-first chat mode to return a conversational answer plus a create-note proposal when no strong saved-note match exists
- normalizing proposal payloads before they return to the UI

Target request-time sequence:
1. validate provider/model
2. create or validate the app-owned conversation for the session user and persist the incoming user turn
3. inspect the transcript and optional override to resolve intent
4. attempt conservative existing-note matching when update/review behavior is plausible
5. gather live research for create/update-style turns
6. assemble one shared assistant-identity prompt plus layered skill-specific routing context
7. normalize the assistant response and any proposal metadata for the UI
8. persist the generated assistant turn and return the app-owned `conversationId`

The endpoint is stateless with respect to provider-managed hidden conversation memory. When a saved conversation is resumed, the app rebuilds the transcript from app-owned history and sends that transcript back through the same endpoint with the app-owned `conversationId`.

The shared router lives in `src/lib/server/assistant/routing.ts`. It normalizes the new `override` field plus the legacy `mode` alias, inspects the latest user turn, attempts conservative exact title/alias matching against saved notes, and returns routing metadata (`overrideSource`, `matchedNote`, `targetNote`, `noteId`) alongside the assistant response so the UI can expose the resolved branch without guessing on the client. Strong note matches do not automatically force mutation mode: in conversational routing, the respond endpoint can inject the matched note body into the shared prompt so the model can summarize what is already saved and offer follow-up research or review without emitting an update proposal.
The note-section contract itself lives in `src/lib/utils/note-structure.ts`, which is imported by both the prompt builder and the assistant commit validator so the allowed sections and validation messages do not drift.

### Commit Boundary

`POST /api/assistant/commit` is the mutation boundary for assistant-confirmed proposals:
- create note
- update note
- delete note

The commit path is responsible for persisting confirmed changes, taking revision snapshots before updates, syncing `note_links`, applying any assistant-supplied reciprocal link patches to existing notes, and validating assistant note bodies against the shared section skeleton before persistence.
That shared contract is pinned by unit tests in `src/lib/utils/note-structure.test.ts` and `src/lib/server/ai/prompts.test.ts`, which run in CI before type checking and build verification.

Canonical note-category enforcement is shared across the server write layer rather than duplicated per route. Assistant commit, manual note create/edit actions, and Markdown import all validate against the same taxonomy helper before persistence, while tags remain intentionally open vocabulary.

### Live Research

Live research is part of assistant orchestration for creation and comparison/update flows. Purely conversational turns may remain chat-only even when a related note exists, while still offering follow-up research or review actions. Topic reuse is treated as a runtime optimization inside the current conversation, not a durable persisted store.

Delete proposals stay behind an explicit-intent gate. The shared prompt may surface `delete_note` only when the latest user turn clearly asks to delete/remove a specifically selected or strongly matched saved note; otherwise conversational turns keep `proposal: null`.

### Chat History

The target architecture uses app-owned transcript storage rather than provider-owned session state. Canonical history should store message content, lightweight citations, and proposal snapshots when present, while avoiding provider conversation IDs, raw hidden context, and raw research payloads as durable state.

The current Drizzle schema contains the app-owned `conversations` and `conversation_messages` tables described in [`docs/schema.md`](schema.md). Server-side conversation persistence is wrapped by `src/lib/server/assistant/conversations.ts`, which creates conversations, appends transcript messages, loads owned threads, and lists recent conversations by `updated_at`. `POST /api/assistant/respond` uses that wrapper to create a conversation when the request omits `conversationId`, verify session ownership when it is present, and persist the latest user and assistant message content for each successful exchange.

The chat page load now participates in that same app-owned history boundary. `GET /chat` loads recent conversation metadata for the signed-in user alongside provider options and note targeting data, while `GET /chat/[conversationId]` verifies ownership with `getConversation`, redirects missing or unowned ids back to `/chat`, and returns the saved transcript. Both routes must render the same chat surface contract, with `/chat/[conversationId]` acting as a preloaded resume entrypoint instead of a separate UI.

The browser rebuilds local display state from saved rows and includes the app-owned `conversationId` on follow-up respond calls. Canonical transcript persistence remains full-fidelity, while runtime replay to the model is currently windowed to the most recent 5 user+assistant exchanges. The respond API also returns lightweight conversation metadata so the Notebook Index ordering and labels can refresh in-place immediately after successful replies without requiring a page reload.

Notebook history is a contextual chat surface, not a second primary app rail: the chat route may open the Notebook Index overlay on entry, and while already on `/chat` or `/chat/[conversationId]`, activating the main `Chat` nav toggles that overlay open/closed in-place.

### Provider / Model Abstraction

Assistant routes accept provider/model pairs rather than hard-coding a single model family.

Current direction:
- Anthropic, OpenAI, and OpenRouter are the supported providers
- approved combinations live in `src/lib/server/ai/models.ts`
- provider adapters may differ internally, but the external request contract stays unified
- OpenRouter currently routes through a dedicated adapter with OpenAI-compatible Chat Completions transport

---

## PWA Runtime

Techy's mobile app direction is an online-first PWA served by the same SvelteKit app. `@vite-pwa/sveltekit` is wired into `vite.config.ts` and runs at build time.

Implementation specifics:

- The service worker (`generateSW` strategy via Workbox) precaches only `client/**` static build assets
- Navigation fallback is denied for `/api/`, `/auth/`, `/debug/`, and `/signin` — those always hit the network
- No runtime caching is configured; every authenticated data request (notes, chat, AI providers) bypasses the cache
- The manifest is generated at `manifest.webmanifest` with `display: standalone`, `start_url: /`, and the app's dark theme colors
- Icon assets in `static/` were generated from `static/pwa-icon-source.svg` using `@vite-pwa/assets-generator`
- GitHub OAuth remains the only access boundary after install; the PWA does not add or bypass any auth surface

See [`docs/PWA-SPEECH.md`](PWA-SPEECH.md) for implementation scope and cache policy.

## Speech Runtime

Speech is layered over existing client and server contracts. Browser speech synthesis handles note and assistant readback, dictation writes text into the existing chat composer, and the optional server speech-to-text endpoint returns transcript text only. Voice-composed chat still uses `/api/assistant/respond`; raw microphone audio and generated speech audio are not persisted. See [`docs/PWA-SPEECH.md`](PWA-SPEECH.md) for detailed behavior and fallback rules.

---

## D3 Force Graph

`ForceGraph.svelte` remains client-only. The graph consumes server-loaded `nodes` and `links` arrays and should reflect saved note/link changes immediately after the corresponding server commit succeeds.

Graph-view preferences are owned entirely by the client and persisted to `localStorage` under the key `techy:graph-settings`. The stored shape is `{ colorMode, hiddenCategories, hiddenStatuses, nodeScale, linkThickness, textFadeThreshold, linkDistance, chargeStrength, collisionPadding, centeringStrength, velocityDecay, alphaDecay }`. Settings are loaded at component init, sanitized/clamped to valid ranges, and written back via a `$effect` on every change. Malformed or missing values fall back to the documented defaults; existing saved values are preserved, while fresh/default state now resolves `colorMode` to `category`. Appearance controls update SVG selections in place, hover focus is derived client-side from the current node/link dataset, and simulation-facing controls update the existing D3 force refs and reheat the simulation without rebuilding the graph. This introduces no API contracts or database-backed user preferences.

Current boundary:
- graph data (`nodes` and `links`) is loaded on the server and passed into the page
- graph rendering, simulation state, and graph-control interactions stay in the browser
- persisted graph-view tuning is local UI state, not durable application data
- `controlsOpen` (panel open/closed) is transient UI state and is not persisted
