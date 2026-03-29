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
**Status:** Accepted

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
