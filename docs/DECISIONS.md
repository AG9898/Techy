# Architecture Decision Records — Techy

Records are append-only. Superseded decisions are marked with `[SUPERSEDED by ADR-XXX]`.

---

## ADR-001: SvelteKit 5 over Next.js / Nuxt / Remix

**Date:** 2026-03-28
**Status:** Accepted

**Context:** Framework choice for a personal SSR web app with TypeScript, a PostgreSQL database, and a client-side D3 graph.

**Decision:** SvelteKit 5 with Svelte rune mode.

**Reasons:**
- Svelte 5 rune mode provides the most ergonomic reactivity model for a small project with no large team constraints
- SvelteKit's `+page.server.ts` / form actions pattern eliminates the need for a separate API layer for CRUD
- Smaller bundle size vs React-based frameworks — relevant for graph-heavy client-side rendering
- `adapter-auto` supports Vercel and Cloudflare Pages without reconfiguration
- TypeScript support is first-class

**Trade-offs:**
- Smaller ecosystem than Next.js
- Svelte 5 rune mode is relatively new (less community content)

---

## ADR-002: Neon PostgreSQL over SQLite / PlanetScale / Supabase

**Date:** 2026-03-28
**Status:** Accepted

**Context:** Need a hosted database on a $0/month budget with Drizzle ORM support.

**Decision:** Neon PostgreSQL (free tier) using the serverless HTTP driver.

**Reasons:**
- Free tier is generous (0.5 GB, 191.9 compute-hours/month) — sufficient for a personal note repo
- Native PostgreSQL dialect means full array operators (`&&`, `@>`), which power tag search
- `@neondatabase/serverless` HTTP transport works in Vercel Edge and serverless environments without connection pooling complexity
- Drizzle ORM has a `drizzle-orm/neon-http` driver with first-class support

**Trade-offs:**
- Free tier has cold-start latency (~500ms on first query after idle)
- Not suitable if the app ever needs transactions across multiple requests

**Rejected alternatives:**
- SQLite (Turso): No native array type; would need JSON workaround for tags
- PlanetScale: MySQL dialect; no array types; free tier removed
- Supabase: Heavier stack; generates its own client that conflicts with Drizzle patterns

---

## ADR-003: Drizzle ORM over Prisma / TypeORM / raw SQL

**Date:** 2026-03-28
**Status:** Accepted

**Context:** Need an ORM with TypeScript-first design and good Neon/PostgreSQL support.

**Decision:** Drizzle ORM with `drizzle-kit` for migrations.

**Reasons:**
- Drizzle generates zero runtime overhead — it's a thin query builder, not an abstraction layer
- Type inference from schema (`$inferSelect`, `$inferInsert`) keeps types DRY
- `drizzle-kit` migration workflow is simple: `generate` → review SQL → `migrate`
- Native support for PostgreSQL array columns (used for `tags[]` and `aliases[]`)
- Works directly with `@neondatabase/serverless` HTTP driver

**Trade-offs:**
- Less mature than Prisma for complex relation queries
- No automatic `updatedAt` trigger — must manually pass `updatedAt: new Date()` on update

**Rejected alternatives:**
- Prisma: Generates its own client with a runtime dependency; heavier; no native Neon HTTP transport support in serverless contexts
- Raw SQL: Too verbose for CRUD; no type safety

---

## ADR-004: Auth.js (SvelteKitAuth) over custom JWT / Lucia / Clerk

**Date:** 2026-03-28
**Status:** Accepted

**Context:** Need GitHub OAuth for a single-user private app. No user management UI needed.

**Decision:** `@auth/sveltekit` with GitHub provider and `@auth/drizzle-adapter` for DB-backed sessions.

**Reasons:**
- Handles the full OAuth callback, session management, and CSRF in ~30 lines of config
- `DrizzleAdapter` stores sessions in the same Neon database — no additional services
- Single-account gate implemented in `signIn` callback: `profile.login === ALLOWED_GITHUB_USERNAME`
- Session available in all `+page.server.ts` via `event.locals.auth()`

**Trade-offs:**
- Auth.js v5 / `@auth/sveltekit` is still in beta; API may change
- `DrizzleAdapter` requires 4 Auth.js tables in the schema (users, accounts, sessions, verification_tokens)

**Rejected alternatives:**
- Lucia Auth: Deprecated; maintainer abandoned the project
- Clerk: SaaS cost; overkill for single-user
- Custom JWT: Too much code for a solved problem

---

## ADR-005: D3.js force-directed graph over Cytoscape.js / Sigma.js / vis.js

**Date:** 2026-03-28
**Status:** Accepted

**Context:** Need an interactive node-link graph visualisation in a browser. Node count will be small (<1000 notes for a personal repo).

**Decision:** D3.js v7 force simulation with SVG rendering.

**Reasons:**
- Maximum control over visual output — node colours, edge styles, layout tuning all in code
- D3 force simulation is the standard Obsidian-style graph look
- No additional abstraction layer; D3 works directly with SVG DOM
- `@types/d3` provides full TypeScript coverage
- Small bundle addition since Svelte's own reactivity handles the rest

**Trade-offs:**
- More code to write than Cytoscape (which has a higher-level API)
- SVG rendering will degrade at very large node counts (>5000 nodes) vs WebGL alternatives
- D3's type system has some rough edges with `BaseType` selection generics

**Rejected alternatives:**
- Cytoscape.js: Good API but produces a different aesthetic; less control over styling
- Sigma.js + Graphology: Best for large graphs (WebGL); overkill for this scale
- vis.js: Older library; large bundle; less TypeScript-friendly

---

## ADR-006: Flat note storage (no subfolders / namespacing)

**Date:** 2026-03-28
**Status:** Accepted

**Context:** Original project used Obsidian folder hierarchy. Migrating to a DB-backed model.

**Decision:** All notes are stored flat in the `notes` table. The `category` field provides classification; the `note_links` graph provides structure.

**Reasons:**
- Categories and graph links are richer than folder hierarchies for a knowledge graph
- Slugs are globally unique — no need for folder-qualified paths
- Simpler search (no path prefix filtering needed)

**Trade-offs:**
- Slug collisions across categories need manual handling (checked at save time)

See [`docs/NOTES.md`](NOTES.md) for hub categories, tag taxonomy, and schema.

---

## ADR-007: Wikilink syntax (`[[Title]]`) over explicit relationship fields

**Date:** 2026-03-28
**Status:** Accepted

**Context:** Need to encode relationships between notes without a complex UI for managing links.

**Decision:** `[[double bracket]]` syntax in Markdown body, parsed on save to populate the `note_links` table.

**Reasons:**
- Familiar from Obsidian / Roam / Notion — matches the original project's workflow
- Links are co-located with the prose that motivates them — easier to maintain
- Parsing is simple (`/\[\[([^\]]+)\]\]/g`)
- No separate relationship management UI needed

**Trade-offs:**
- Links are by title (not ID), so renaming a note breaks its incoming links
- Requires a full title-to-slug map lookup on every save

**Resolved limitation:** Renaming a note now automatically propagates the title change to `[[wikilinks]]` in all other notes' bodies. On save, if the title has changed, the edit action performs a `LIKE` search for `%[[oldTitle]]%` across all note bodies, replaces every occurrence with `[[newTitle]]`, updates those notes, and re-syncs their `note_links` rows. Implemented in NOTES-003.

See [`docs/NOTES.md`](NOTES.md) for the full wikilink syntax, pipeline detail, and authoring rules.

---

## ADR-008: Markdown for note bodies (not rich text / WYSIWYG)

**Date:** 2026-03-28
**Status:** Accepted

**Context:** Choosing between a plain textarea + Markdown vs. a rich text editor (TipTap, Lexical, etc.).

**Decision:** Plain `<textarea>` with Markdown, rendered server-side via `marked`.

**Reasons:**
- AI-generated content is most naturally Markdown (LLMs output it fluently)
- No client-side editor bundle weight
- Future: split-pane preview is easy to add without changing the storage format

**Trade-offs:**
- No WYSIWYG — requires knowledge of Markdown syntax
- No drag-and-drop image upload (not needed for tech notes)

See [`docs/NOTES.md`](NOTES.md) for the note template and Markdown authoring conventions.

---

## ADR-009: Tailwind CSS v4 + Melt UI for the frontend primitive layer

**Date:** 2026-03-29
**Status:** Accepted (Tailwind CSS v4 live; Melt UI pending — tracked as UI-010)

**Context:** The project needs a stronger UI foundation for iterative design work, improved UI literacy, and experimentation with more advanced interactive patterns without giving up custom visual direction.

**Decision:** Use Tailwind CSS v4 for styling utilities and shared theme tokens, and use Melt UI as the preferred primitive library for interactive Svelte 5 components.

**Reasons:**
- Tailwind v4 integrates cleanly with the current Vite-based SvelteKit setup
- Utility-first styling makes it easier to iterate on layouts and visual systems while still keeping design ownership inside the repo
- Melt UI is Svelte-native, rune-friendly, and headless, which fits the desire to learn UI composition rather than adopting a prebuilt theme
- The combination supports accessible interactive controls without forcing Techy into a generic design system

**Trade-offs:**
- Tailwind introduces another styling layer that must be kept consistent with the existing palette and spacing rules
- Mixing legacy component CSS with Tailwind utilities will create a temporary hybrid period during migration
- Melt UI is still relatively young and may change more quickly than very mature component libraries

**Rejected alternatives:**
- Fully pre-styled kits as the primary UI layer: faster to ship, but less aligned with the project's custom visual goals
- Keeping only hand-written component CSS: simpler, but slower for experimentation and less useful for learning modern UI patterns

**Notes:**
- Tailwind is the styling foundation, not the visual identity
- Melt UI should be used for behavior and accessibility primitives, not as a final visual theme
- GSAP may be used as an optional motion layer for selected interactions, but animation remains subordinate to readability and tool-like clarity

---

## ADR-010: Dedicated note_revisions table for revision history

**Date:** 2026-03-29
**Status:** Accepted

**Context:** NOTES-006 requires that editing a note preserves the previous version and that users can inspect earlier revisions.

**Decision:** A dedicated `note_revisions` table captures the pre-update state of a note's `title`, `body`, `tags`, `aliases`, `category`, and `status` immediately before each `update` action fires. Revisions are immutable snapshots — they are never edited after insert.

**Reasons:**
- A separate table keeps the `notes` table unchanged and query-efficient; no nullable history columns or self-joins needed
- `ON DELETE CASCADE` ties revision lifetime to the parent note — no orphan cleanup required
- Snapshots are taken at the application layer (inside the edit action, before the `UPDATE` query) rather than via a database trigger, keeping the logic visible and testable in SvelteKit server code
- Storing the full field set (not just a diff) makes reading any revision self-contained — no need to replay a chain of patches

**Trade-offs:**
- Storage grows with every save; not compacted. Acceptable for a personal notes app at the expected volume
- No rollback/restore UI in this iteration — revisions are currently read-only snapshots

**Rejected alternatives:**
- Soft-delete + `deleted_at` column: supports only a single "prior version" and complicates note queries
- JSON diff / patch column on the `notes` table: efficient storage but requires a patch-replay engine to render any revision
- PostgreSQL audit trigger: keeps logic in the DB rather than the application, harder to maintain alongside Drizzle migrations

---

## ADR-011: Assistant-first note authoring over a dedicated `/notes/new` page

**Date:** 2026-03-30
**Status:** Accepted

**Context:** The product direction is moving away from a separate new-note form and toward a single assistant surface that can both converse and drive note CRUD.

**Decision:** `/chat` becomes the primary authoring surface. New note creation is initiated from chat with an explicit create-mode control, and assistant-generated create/update proposals are reviewed inline and confirmed before save. The dedicated `/notes/new` page is no longer part of the intended product direction.

**Reasons:**
- A single assistant surface reduces duplication between conversational help and AI note creation
- Inline draft review keeps the user in one mental model instead of bouncing between chat and a separate authoring page
- Explicit review-before-save keeps note mutations deliberate and auditable

**Trade-offs:**
- The chat surface becomes more complex and must handle both conversational and mutation states well
- The product loses a simple form-first fallback for new notes unless a legacy route is intentionally retained during migration

---

## ADR-012: Live web research is required for assistant note creation and note comparison

**Date:** 2026-03-30
**Status:** Accepted

**Context:** The assistant is expected to create and review notes against current information rather than relying only on model priors or the existing graph.

**Decision:** Assistant-driven note creation and note-comparison flows always perform live web research. The assistant should reuse already-known topic context within the same conversation to avoid redundant research. Citations are shown during chat review but are not persisted in a dedicated citation schema in this phase.

**Reasons:**
- Notes should reflect current information, not only model memory
- The same topic should not be researched repeatedly within a single chat session
- Keeping citations in chat review avoids premature schema expansion

**Trade-offs:**
- Assistant flows depend on external provider/web-research capability
- Some source provenance is not retained once the note is saved

---

## ADR-013: Assistant-created notes may patch existing note bodies to establish immediate reciprocal links

**Date:** 2026-03-30
**Status:** Accepted

**Context:** Creating a new note should make its graph relationships visible immediately, including cases where existing notes ought to link to the new note.

**Decision:** When the assistant creates a new note and determines that one or more existing notes should reference it, the confirmed save flow may also update those existing note bodies to include the new `[[Title]]` link and then re-sync their `note_links` rows in the same mutation sequence.

**Reasons:**
- Graph relationships should be visible immediately after note creation
- `[[wikilinks]]` remain the source of truth for graph edges
- The assistant can make the knowledge graph feel less one-sided when a new concept clearly belongs inside existing note prose

**Trade-offs:**
- Assistant note creation can affect more than one saved note in a single confirmed action
- Review UI must make linked-note patches visible before commit

---

## ADR-014: Tonal dark/light theme model over the previous three-theme system

**Date:** 2026-03-30
**Status:** Accepted

**Context:** The current `night / paper / mist` theme model is broader than needed and does not align with the desired explicit dark/light theme behavior.

**Decision:** Replace the previous three-theme model with a tonal `dark / light` theme model while keeping accent selection independent.

**Reasons:**
- A true dark/light model is easier to understand and easier to carry across all surfaces
- Tonal dark/light modes better fit the desired observatory/editorial balance
- Accent choice remains expressive without multiplying the core theme matrix

**Trade-offs:**
- Existing theme names and tokens need migration
- Some visual variety from the previous three-theme system is intentionally reduced

---

## ADR-015: Two-step `/respond` + `/commit` endpoint split over a single mutation endpoint

**Date:** 2026-03-30
**Status:** Accepted

**Context:** The assistant-first authoring flow requires the user to review and optionally edit a proposal before any note is created, updated, or deleted. There are two viable shapes: a single endpoint that proposes and persists in one call, or two endpoints where one generates a proposal and the other commits it.

**Decision:** Split the assistant API into `POST /api/assistant/respond` (generates a conversational reply and optional proposal payload) and `POST /api/assistant/commit` (persists a confirmed proposal). No note mutation happens until the commit endpoint is explicitly called.

**Reasons:**
- Proposal review and editing must happen client-side before any DB write — a single endpoint cannot cleanly separate the review from the persist step
- The commit boundary makes it unambiguous when a note mutation is happening; it also makes the flow testable in isolation
- Separating generation from persistence preserves a clean audit path: the proposal payload that the user reviewed is exactly what gets committed

**Trade-offs:**
- Two round-trips instead of one for confirmed proposals
- The client must hold proposal state between the respond and commit calls

---

## ADR-016: Unified provider/model routing through a single assistant endpoint contract

**Date:** 2026-03-30
**Status:** Accepted

**Context:** The assistant-first flow should support at least Anthropic and OpenAI, with future providers (e.g. OpenRouter) possible. The question is whether to expose separate endpoints per provider or a single endpoint that routes internally.

**Decision:** A single `POST /api/assistant/respond` endpoint accepts `provider` and `model` fields and routes internally through provider adapters (`src/lib/server/ai/`). The request and response contract does not change as providers are added or removed. A server-side provider/model registry (`models.ts`) governs which combinations are valid.

**Reasons:**
- The client does not need to know about provider routing logic — it sends a provider/model pair and receives a standardised response
- Adding a new provider (e.g. OpenRouter) requires only a new adapter and a registry entry, not a new endpoint or client change
- Centralising provider validation on the server avoids invalid combinations reaching third-party APIs

**Trade-offs:**
- Provider-specific error shapes must be normalised at the adapter layer to keep the endpoint contract clean
- The registry must be kept up to date as models are released or deprecated

---

## ADR-017: Materiality gate heuristics for assistant update proposals

**Date:** 2026-03-30
**Status:** Accepted

**Context:** The assistant compares saved note content against live web research when a user discusses an existing note. A naïve comparison would produce update proposals for trivial differences (rephrasing, formatting, minor additions), creating noise. The decision is what bar to set.

**Decision:** The assistant should only return an `update_note` proposal when the saved note meets at least one of the following conditions:
1. **Factually incorrect** — the note contains a claim that live research clearly contradicts
2. **Materially outdated** — the topic has changed significantly since the note was written and the existing content no longer reflects current reality
3. **Substantially incomplete** — the note is missing a major section or perspective that would be expected for a note of its category and status

Minor differences — rephrasing, supplementary examples, small additions that do not change the note's accuracy — should not trigger a proposal. The assistant should instead mention the note is broadly accurate in the conversational reply.

**Reasons:**
- Frequent update proposals for cosmetic differences create noise and erode trust in the assistant's judgement
- The materiality bar keeps assistant-driven mutations deliberate and meaningful
- Users can always manually edit notes for minor improvements via `/notes/[slug]/edit`

**Trade-offs:**
- The gate is a prompt-level heuristic, not a deterministic rule — the assistant may occasionally miss a material issue or over-trigger on a borderline case
- The bar may need tuning once real usage patterns emerge

---

## ADR-018: Neutral charcoal dark palette over the inherited blue-slate dark palette

**Date:** 2026-03-30
**Status:** Accepted

**Context:** The `dark` theme migration removed the old `night / paper / mist` names, but the underlying dark tokens still largely matched the old cool slate palette. That made the product read as navy/blue in dark mode instead of the intended darker charcoal environment.

**Decision:** Retune the shared dark tokens to a neutral charcoal, near-black palette while keeping accent colors independent and expressive. The dark theme should avoid flat pure-black fills, but it should no longer read as blue by default.

**Reasons:**
- A charcoal base better matches the intended “private knowledge atlas” feel than the inherited navy slate
- Neutral dark surfaces let the accent family and graph colors carry the expressive hue instead of tinting the entire shell blue
- Near-black surfaces improve perceived contrast without forcing harsh pure-black panels

**Trade-offs:**
- Some older slate-based assumptions in component styling need cleanup to stay aligned with the shared tokens

---

## ADR-019: OpenAI adapter uses the Responses API while preserving the unified provider/model contract

**Date:** 2026-03-31
**Status:** Accepted

**Context:** Techy now exposes OpenAI model selection through the shared `provider` / `model` contract on `/chat` and `/api/assistant/respond`. Supporting the newer GPT-5 family raised a design choice: keep the OpenAI adapter on Chat Completions for parity with Anthropic's adapter shape, or move the OpenAI side to the Responses API while preserving the app's external contract.

**Decision:** Keep the external assistant API contract unchanged, but implement the OpenAI adapter with the Responses API. The approved provider/model registry is still defined centrally in `src/lib/server/ai/models.ts`; `/chat` currently defaults to OpenAI with `gpt-5-mini`, and the current Anthropic default is `claude-haiku-4-5-20251001`. Anthropic continues to use its existing Messages API integration.

**Reasons:**
- The app contract stays stable: the client still sends `provider`, `model`, `messages`, and `mode` without caring about provider-specific transport details
- The Responses API is the better fit for current GPT-5-family support, so using it avoids pinning the OpenAI adapter to an older integration shape
- Centralising model defaults and allowlists in `models.ts` keeps `/chat`, `/api/assistant/respond`, and the legacy helper endpoints consistent about which model is being used and recorded in `ai_model`

**Trade-offs:**
- The provider adapters now differ more internally, so the normalization layer must keep output and error handling aligned
- Reasoning settings for GPT-5-family models become an adapter concern that needs maintenance as OpenAI guidance evolves
- Sky accent remains visibly blue by design, so dark mode still includes blue highlights when that accent is selected

---

## ADR-020: Persist chat history as app-owned transcript data, not provider-side conversation state

**Date:** 2026-03-31
**Status:** Accepted

**Context:** Techy now treats `/chat` as a primary product surface rather than a disposable helper. Adding resumable chat history raises a design choice: either persist provider-managed conversation/session state, or store Techy's own conversation transcript and rebuild model context from that transcript whenever a chat is resumed.

**Decision:** Persist chat history as DB-backed conversation/message records owned by the app. A resumed chat rebuilds the `messages` payload from saved transcript data before calling `/api/assistant/respond`. Provider-specific conversation IDs, hidden memory state, and raw live-research payloads are not treated as durable product state.

**Reasons:**
- The transcript the user sees is the same transcript the app owns, which keeps behavior auditable and debuggable
- The design stays provider-agnostic across Anthropic, OpenAI, and future adapters
- Avoiding provider-owned hidden state prevents product behavior from depending on opaque memory that Techy cannot inspect or migrate
- Lean transcript storage is a better fit for Neon free-tier limits than persisting raw research artifacts or provider session blobs

**Trade-offs:**
- Resuming a conversation may require replaying prior messages into the model context, increasing token usage on longer chats
- Older conversations may eventually need truncation, summarization, or retention rules to control context size and storage growth
- Reopened conversations may rerun live research for fresh turns because the ephemeral topic cache is not persisted as durable history
