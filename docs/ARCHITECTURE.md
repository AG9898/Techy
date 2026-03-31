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

See [`docs/API.md`](API.md) for the route-by-route surface and endpoint contracts.

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
- grounding the request with live web research when the mode requires it
- resolving current note context for update flows before prompting the model
- deciding whether the assistant should answer conversationally only or also return a structured proposal
- normalizing proposal payloads before they return to the UI

The endpoint is stateless with respect to provider-managed hidden conversation memory. When a saved conversation is resumed, the app rebuilds the transcript from app-owned history and sends that transcript back through the same endpoint.

### Commit Boundary

`POST /api/assistant/commit` is the mutation boundary for assistant-confirmed proposals:
- create note
- update note
- delete note

The commit path is responsible for persisting confirmed changes, taking revision snapshots before updates, syncing `note_links`, and applying any assistant-supplied reciprocal link patches to existing notes.

### Live Research

Live research is part of assistant orchestration for creation and comparison/update flows. Topic reuse is treated as a runtime optimization inside the current conversation, not a durable persisted store.

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
