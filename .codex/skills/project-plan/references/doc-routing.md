# Doc Routing

Use `CLAUDE.md` as the top-level router, then open only the docs implied by the proposal.

## Routing

- Product capability, scope, or success criteria: `docs/PRD.md`
- Runtime ownership, subsystem boundaries, data flow, or route placement: `docs/ARCHITECTURE.md`
- Page routes, server actions, JSON endpoints, request/response contracts: `docs/API.md`
- Persisted tables, columns, constraints, or new durable storage: `docs/schema.md`
- Note semantics, frontmatter, wikilinks, categories, or authoring rules: `docs/NOTES.md`
- Visual direction, layout, motion, theming, or component behavior: `docs/STYLE-GUIDE.md`
- Implemented UI spec and palette details: `docs/DESIGN-SPEC.md`
- Existing technology choices or when a proposal may need a new ADR: `docs/DECISIONS.md`
- Environment, commands, or setup requirements: `docs/SETUP.md`

## Selection Heuristics

- Start with the narrowest likely docs.
- Expand only when the proposal crosses boundaries.
- For mixed proposals, read one doc per concern instead of preloading the entire docs folder.

Common combinations:

- New product feature: `PRD.md` + one or more of `ARCHITECTURE.md`, `API.md`, `schema.md`
- UI redesign: `STYLE-GUIDE.md` + `DESIGN-SPEC.md`, then `PRD.md` if product behavior also changes
- Assistant workflow change: `PRD.md` + `ARCHITECTURE.md` + `API.md`, then `schema.md` if persistence changes
- Note-model change: `NOTES.md` + `schema.md` + `API.md`
