# Design Specification — Techy

This document reflects the updated UI direction for the assistant-first phase. It supersedes assumptions that depend on a dedicated `/notes/new` page or the previous `night / paper / mist` theme model.

## Design Philosophy

Techy should feel like a soft, graph-centered private knowledge tool rather than a generic SaaS dashboard. The graph remains the hero, but assistant chat now becomes the primary authoring surface.

Current implementation direction:
- Tailwind CSS v4 remains the styling foundation
- Melt UI is the preferred primitive layer for interactive controls and review affordances
- GSAP is available for selective motion where it improves continuity or focus
- Visual styling remains custom to Techy
- New UI should avoid a wall of interchangeable cards and instead prefer a few clear surfaces

---

## Token System

Techy uses a two-axis token system applied via `data-theme` and `data-accent` attributes on `<html>`.

Theme axis:
- `dark` — charcoal dark, near-black without going flat pure black
- `light` — tonal light, not harsh white

Accent axis:
- `sky`
- `mint`
- `amber`
- `rose`

All new components must use tokens. No hardcoded hex values should appear in component code.

### Semantic Tokens

| Token | Usage |
|-------|-------|
| `--bg-base` | App background |
| `--bg-surface` | Primary surfaces |
| `--bg-raised` | Secondary surfaces, chips, inputs |
| `--bg-overlay` | Popovers, dialogs, floating overlays |
| `--border-soft` | Default borders |
| `--border-strong` | Active and hover borders |
| `--text-primary` | Headings and main content |
| `--text-secondary` | Secondary body text |
| `--text-muted` | Metadata, empty-state copy |
| `--text-subtle` | Low-priority helper text |
| `--accent-primary` | Links and active emphasis |
| `--accent-strong` | Primary actions and focus |
| `--accent-soft` | Accent-tinted backgrounds |
| `--graph-node-stub` | Graph stub color |
| `--graph-node-growing` | Graph growing color |
| `--graph-node-mature` | Graph mature color |
| `--graph-link` | Graph edge color |
| `--graph-focus` | Graph focus state |
| `--accent-green` | Wikilinks / positive states |
| `--accent-green-muted` | Default wikilink color |
| `--accent-red` | Errors and delete actions |
| `--accent-purple` | AI/proposal provenance |

---

## Typography

Current implementation still uses:

```css
font-family: 'Inter', system-ui, sans-serif;
font-family: 'Fira Code', 'Cascadia Code', monospace;
```

Typography should continue to feel closer to polished docs pages than to a dashboard.

---

## Layout

### Global Shell

```
┌────────────────────────────────────────────────────────────┐
│ Nav: [Techy] [Graph] [Notes] [Search] [Chat] [Dark/Light] ●●●● [avatar] [Sign out] │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  <main class="page-content">                               │
│  max-width: 1200px, margin: 0 auto, padding: 2rem          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

The `+ New` navigation item is removed. `/chat` becomes the primary authoring entry point.

### Home (Graph)

- Full-viewport SVG below the sticky nav
- Minimal chrome
- Floating legend and filter controls
- Graph should reflect new links immediately after assistant-confirmed note creation

### Notes List

```
[Page header: "Notes"   [↑ Import] [↓ Export] [Chat-first helper copy] ]
[Category filter chips]
[Grid: auto-fill minmax(280px, 1fr)]
```

The notes page remains for browsing, filtering, import, export, and opening existing notes. It is no longer the primary creation surface.

### Chat

Chat is now both the conversation surface and the primary authoring surface.

```
[Conversation column........................................]
[ assistant toolbar: create-mode toggle | provider | model ]
[ conversation area ....................................... ]
[ assistant proposal panel appears inline beneath message  ]
[ composer ................................................ ]
```

The assistant must be able to:
- converse normally
- generate a new note draft
- propose an update to an existing note
- request confirmation for deletion

### Assistant Proposal Panel

For `create_note` and `update_note` proposals, render an editable draft panel inline in chat.

Structure:
```
[ Proposal header: Create note / Update note ]
[ title ]
[ category | status ]
[ tags | aliases ]
[ body textarea / preview ]
[ citations shown in review only ]
[ Confirm ] [ Cancel ]
```

Rules:
- The panel is editable before save.
- Citations are visible in review, but not persisted as dedicated schema.
- Links should be visible in the draft body using `[[wikilinks]]`.
- If existing notes will be patched to link to the new note, that should be shown as a secondary review block in the same panel.

### Delete Confirmation

Delete proposals render a smaller inline confirmation card rather than a full edit panel.

Rules:
- Explicit confirmation is required before delete.
- Confirmation is a clear UI action, but not a typed phrase.

---

## Components

### `Nav.svelte`
- Remove the `+ New` link
- Replace the 3-theme selector with a true dark/light toggle
- Keep accent dots
- Consider Melt primitives for toggle-group behavior and keyboard handling

### `ForceGraph.svelte`
- Keep current graph legend/filter/edge drilldown work
- Ensure graph colors remain legible in both tonal themes
- Future motion can use GSAP selectively for graph state transitions, but only if it improves clarity

### `Chat` surface
- Add an explicit create-mode toggle near the composer
- Add provider/model selection controls
- Render assistant citations and proposal panels inline
- Use Melt for selectors, confirmation affordances, and disclosure-style interaction where it improves accessibility

---

## Interaction Patterns

### Assistant Creation Flow
1. User enables create mode and sends a prompt.
2. Assistant performs live web research and reasons over the existing graph.
3. Assistant responds conversationally and may return a structured draft proposal.
4. User edits the draft inline if needed.
5. User confirms save.
6. The app persists the note, syncs `note_links`, and applies any confirmed linked-note patches so graph connections are visible immediately.

### Assistant Update Flow
1. User asks about or asks to improve an existing note.
2. Assistant compares the saved note against live web results.
3. Only if the note appears materially incorrect, outdated, or substantially incomplete does the assistant return an update proposal.
4. User reviews and confirms the update.

### Assistant Delete Flow
1. User requests deletion.
2. Assistant returns a confirmation card.
3. User confirms.
4. Note is deleted.

---

## Responsive Behaviour

Still desktop-first, but chat and proposal panels should collapse cleanly to a single-column layout on smaller screens.

---

## Motion Guidance

GSAP should be limited to a few meaningful transitions:
- assistant message reveal
- proposal panel reveal/collapse
- confirmation-state transitions
- subtle theme toggle choreography, if used

Avoid decorative motion loops or broad page-wide animation.

---

## Melt UI Guidance

Prefer Melt UI primitives where interaction quality matters:
- create-mode toggle
- provider/model selectors
- confirmation/disclosure interactions
- any compact popover or command-like control near the composer

Do not use Melt as a pre-styled visual theme.
