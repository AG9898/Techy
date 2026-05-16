# Doc Routing

Use `CLAUDE.md` as the top-level router, then open only the docs implied by the proposal.

## Routing

- Product capability, scope, or success criteria: `docs/PRD.md`
- Runtime ownership, subsystem boundaries, data flow, auth flow, deployment, or route placement: `docs/ARCHITECTURE.md`
- Page routes, server actions, JSON endpoints, request/response contracts: `docs/API.md`
- Persisted tables, columns, constraints, or new durable storage: `docs/schema.md`
- Note semantics, frontmatter, wikilinks, categories, tags, or authoring rules: `docs/NOTES.md`
- PWA installability, service-worker policy, speech input/output, or transcription fallback behavior: `docs/PWA-SPEECH.md`
- Visual direction, layout, motion, theming, page composition, or component behavior: `docs/STYLE-GUIDE.md`
- Implemented UI spec, palette details, typography, component specs, or layout patterns: `docs/DESIGN-SPEC.md`
- Existing technology choices or when a proposal may need a new ADR: `docs/DECISIONS.md`
- Environment, commands, setup requirements, migrations, or deployment setup: `docs/SETUP.md`
- Test strategy, commands, coverage scope, or CI verification flow: `docs/test.md`
- Active task queue and task metadata: `docs/workboard.json` (only when task planning or edits are requested; use targeted `jq`)

## Selection Heuristics

- Start with the narrowest likely docs.
- Expand only when the proposal crosses subsystem boundaries.
- For mixed proposals, read one doc per concern instead of preloading everything.

Common combinations:

- New product feature: `docs/PRD.md` + one or more of `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/schema.md`
- UI redesign/component behavior: `docs/STYLE-GUIDE.md` + `docs/DESIGN-SPEC.md`, then `docs/PRD.md` if product behavior also changes
- Assistant workflow change: `docs/PRD.md` + `docs/ARCHITECTURE.md` + `docs/API.md`, then `docs/schema.md` if persistence changes
- Note-model change: `docs/NOTES.md` + `docs/schema.md` + `docs/API.md`
- PWA or speech change: `docs/PWA-SPEECH.md` + `docs/ARCHITECTURE.md` + `docs/API.md`
- Work planning and sequencing: targeted `docs/workboard.json` queries + [workboard-format.md](workboard-format.md)
