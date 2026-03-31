# Techy — Agent Instructions

## Project Context

Techy is a **personal, single-user tech knowledge graph** web app. It stores structured notes about software, tools, languages, AI models, and concepts, and visualises their relationships as a D3 force-directed graph.

**Stack:** SvelteKit 5 (rune mode) · TypeScript strict · Drizzle ORM · Neon PostgreSQL · Auth.js (GitHub OAuth) · D3.js · marked

> `CLAUDE.md` is the source-of-truth agent instruction file in this repo. `AGENTS.md` is a symlink to this file. If agent instructions need to change, update `CLAUDE.md` so the symlink stays correct, and ask the user for permission before changing either file.

**Before starting any task**, read the relevant docs in `/docs`:

| Doc | When to read |
|-----|-------------|
| `docs/PRD.md` | Feature requirements and product constraints |
| `docs/NOTES.md` | Note schema, tags, categories, template, wikilink format, authoring rules |
| `docs/schema.md` | Database tables, relationships, and persistence boundaries |
| `docs/API.md` | All routes, form actions, and JSON API endpoints |
| `docs/ARCHITECTURE.md` | System design, file structure, auth flow, and runtime boundaries |
| `docs/DESIGN-SPEC.md` | Colour palette, typography, component specs, layout patterns |
| `docs/STYLE-GUIDE.md` | High-level visual direction, page composition, theming, and motion rules for UI work |
| `docs/DECISIONS.md` | Why specific technologies were chosen — check before proposing alternatives |
| `docs/SETUP.md` | How to run the project, env vars, migration commands |
| `docs/workboard.json` | Current task list with status, acceptance criteria, and file references |

---

## Agent Behaviour

### Starting a task
1. Only ever find tasks through the query skill — never read the full `docs/workboard.json` unless explicitly told to.
2. Find the task by ID, read its `description`, `acceptance_criteria`, and `files`.
3. Read all files listed in the task's `files` array before modifying them.
4. Read any docs listed in the task's `docs` array for context.

### After completing a task
1. Mark the task `"status": "done"` in `docs/workboard.json`.
2. Check if any docs need updating to reflect your changes — **document concurrency must always be maintained**:
   - `docs/ARCHITECTURE.md` — changed system structure, auth flow, or runtime boundaries
   - `docs/schema.md` — changed DB schema, persistence shape, or table relationships
   - `docs/API.md` — added or changed any routes or endpoints
   - `docs/NOTES.md` — changed note schema, wikilink behaviour, tags, or categories
   - `docs/DESIGN-SPEC.md` — added new components or changed colours/layout
   - `docs/STYLE-GUIDE.md` — changed visual direction, theming rules, page composition, or motion guidance
   - `docs/DECISIONS.md` — made a non-obvious tech choice (add an ADR)
   - `docs/PRD.md` — added a feature or changed requirements
3. Run `npm run check` and confirm 0 errors before declaring done.

### When writing code
- All database queries go in `src/lib/server/` or `+page.server.ts` files — never in client-side `.svelte` files
- Use `$derived()` not `const` for values derived from `$props()` in Svelte 5
- Delete forms must be separate `<form>` elements — never nested inside another form (HTML invalid)
- Always run `npm run prepare` after adding new routes (generates `$types.js`)
- For UI work, follow `docs/STYLE-GUIDE.md` for the overall direction and `docs/DESIGN-SPEC.md` for the currently documented implementation details and palette
- For UI work, inspect `references/UI` when a relevant reference exists and treat it as a translation target for the implemented page or section
- When a reference exists, replicate its layout intent, spacing, hierarchy, density, and interaction patterns as faithfully as practical within Techy's stack, tokens, and documented constraints
- Use the reference as an additional style guide input, but do not ignore `docs/STYLE-GUIDE.md`, `docs/DESIGN-SPEC.md`, or established app behavior when they impose product or system constraints
- Not every UI task will have a reference; when one does not exist, infer the design from `docs/STYLE-GUIDE.md`, `docs/DESIGN-SPEC.md`, and the visual patterns already established by the most relevant current pages

### When creating or editing notes (content, not code)
Read `docs/NOTES.md` for the full authoring guide. Quick rules:
1. Check if a note already exists before creating — search by title and aliases
2. Expand existing notes rather than duplicate
3. Use `[[double brackets]]` for internal links — this builds the graph
4. Always set `tags`, `aliases`, and `category` in frontmatter
5. Create a hub note for the category if one doesn't exist

---

## Key Commands

```bash
npm run dev          # Start dev server
npm run check        # TypeScript + Svelte type check (must pass before done)
npm run prepare      # Regenerate $types.js after adding routes
npm run db:generate  # Generate Drizzle migration SQL
npm run db:migrate   # Apply migrations to Neon
npm run db:studio    # Open Drizzle Studio GUI
```
