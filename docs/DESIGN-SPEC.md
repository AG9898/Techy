# Design Specification — Techy

## Design Philosophy

Techy should feel like a soft, graph-centered private knowledge tool rather than a generic SaaS dashboard. The graph remains the hero, while the rest of the product should feel like supporting layers around it: floating panels, rounded sheets, clean reading surfaces, and calm controls.

High-level visual direction is defined in [`docs/STYLE-GUIDE.md`](STYLE-GUIDE.md). This design spec focuses on implementation detail, current tokens, and component guidance.

Current implementation direction:
- Tailwind CSS v4 is the styling foundation for layout, spacing, and utility-driven component work
- Melt UI is the preferred primitive library for interactive components
- GSAP is available for optional motion experiments where animation adds meaning
- Visual styling remains custom to Techy; Melt is used for behavior and accessibility primitives, not for a canned theme
- New UI should avoid a “wall of interchangeable cards” and prefer a few intentional page zones

---

## Colour Palette

The canonical default palette is currently exposed as CSS custom properties in `src/app.css`. Components may still contain hardcoded values during the transition, but new work should prefer the shared tokens and keep Tailwind utility usage aligned with this palette.

This palette should be treated as the initial `Night` theme. Future work may introduce theme and accent toggles, but every theme must preserve legibility for the graph, notes, and chat surfaces.

| Token | Value | Usage |
|-------|-------|-------|
| `bg-base` | `#0a0f1e` | Page background |
| `bg-surface` | `#0f172a` | Cards, nav, inputs, form elements |
| `bg-raised` | `#1e293b` | Hover states, tags, code blocks |
| `border` | `#1e293b` | All borders |
| `border-hover` | `#334155` | Borders on hover |
| `text-primary` | `#e2e8f0` | Headings, main content |
| `text-secondary` | `#94a3b8` | Labels, form hints, secondary text |
| `text-muted` | `#64748b` | Timestamps, empty states, back links |
| `text-subtle` | `#475569` | Dates, hint text |
| `accent-blue-light` | `#7dd3fc` | Logo, links, category badges |
| `accent-blue` | `#1d4ed8` | Primary buttons, focus borders |
| `accent-blue-hover` | `#2563eb` | Button hover |
| `accent-green` | `#4ade80` | Wikilink hover, mature status |
| `accent-green-muted` | `#86efac` | Wikilink default colour |
| `accent-red` | `#f87171` | Errors, broken wikilinks, delete actions |
| `accent-purple` | `#a78bfa` | AI-generated badge |

### Status Colours (Graph Nodes & Badges)

| Status | Colour |
|--------|--------|
| `stub` | `#64748b` (muted) |
| `growing` | `#38bdf8` (blue) |
| `mature` | `#4ade80` (green) |

---

## Typography

No custom font loaded — uses system stack:
```css
font-family: 'Inter', system-ui, sans-serif;
```

Monospace (note editor, code blocks):
```css
font-family: 'Fira Code', 'Cascadia Code', monospace;
```

Typography should still lean closer to polished docs pages than to a typical dashboard. Long-form reading surfaces should feel calm and editorial.

| Usage | Size | Weight |
|-------|------|--------|
| Page headings (h1) | `1.5–1.75rem` | 700 |
| Section headings (h2) | `1.1rem` | 600 |
| Body text | `0.9–0.95rem` | 400 |
| Labels / hints | `0.8–0.85rem` | 400 |
| Badges / chips | `0.7–0.75rem` | 500 |
| Note body prose | `0.9rem` | 400 |

---

## Layout

### Global Shell

```
┌────────────────────────────────────────────────────────────┐
│  Nav: [Techy]        [Graph] [Notes] [+ New] [Search]  [😊▼] │  60px height
├────────────────────────────────────────────────────────────┤
│                                                            │
│  <main class="page-content">                               │
│  max-width: 1200px, margin: 0 auto, padding: 2rem          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Exception:** The home (graph) page uses `position: fixed` to fill the viewport below the nav, bypassing the `page-content` container.

### Page Layouts

**Home (Graph):** Full-viewport SVG, no padding, dark background. Empty state centred.

The home page should preserve the feeling of a full environment rather than a boxed canvas. Controls, legends, and future filters should appear as floating or docked overlays rather than heavy surrounding panels.

**Notes List:**
```
[Page header: "Notes"                   [+ New Note] ]
[Category filter chips                              ]
[Grid: auto-fill minmax(280px, 1fr)                 ]
```

**Note Detail:**
```
[← Notes                          [status] [Edit] ]
[h1: Title                                        ]
[category badge] [tags...] [ai badge?] [date      ]
[──────────────────────────────────────────────────]
[  Rendered Markdown body                          ]
[──────────────────────────────────────────────────]
[Links to: ...    |   Linked from: ...             ]
```

**Create / Edit Note:** Single-column form, max-width 720px, centred.

**Search:**
```
[h1: Search                                       ]
[────────────────────── [Search] ]
[Tags input ] [Category input   ]
[N results                                        ]
[Grid: results                                    ]
```

**Chat (Planned):**
```
[Optional conversation rail] [Conversation column....................] [Optional context panel]
                                                [composer.................................]
```

Chat should use familiar AI product conventions, but visually remain part of the same rounded, calm system used by the graph and notes experiences.

---

## Components

### `Nav.svelte`
- Left: logo `Techy` (accent-blue-light)
- Centre: navigation links (text-secondary, hover: text-primary)
- Right: avatar image + sign-out form
- Height: ~60px, background: bg-surface, border-bottom: border

### `NoteCard.svelte`
- Background: bg-surface, border: border, border-radius: 8px
- Hover: border-color → border-hover
- Header row: title (bold, text-primary) + status badge (right-aligned)
- Second row: category (text-secondary, smaller)
- Tags row: tag chips (bg-raised, text-muted)
- Footer: date (text-subtle)

Note cards should be used where repetition is the honest content pattern. They should not become the default wrapper for every page section.

### `ForceGraph.svelte`
- Full-bleed SVG inside container `height: calc(100vh - 60px)`
- Nodes: circles r=10, stroke: bg-base stroke-width: 2
- Labels: 11px, text-secondary, offset x=14 y=4 from node centre
- Links: stroke bg-raised, stroke-width: 1.5, arrow marker
- Tooltip: native SVG `<title>` (browser default tooltip)

### UI Primitive Strategy
- Prefer Melt UI primitives for new interactive controls where accessibility or keyboard interaction matters
- Prefer Tailwind utilities for spacing, layout, typography, borders, and responsive adjustments
- Avoid importing a full pre-styled component theme; Techy should keep a distinct visual language
- Prefer building pages from a few visual zones rather than many interchangeable boxed sections

---

## Interaction Patterns

### Form Validation
- Required field errors returned as `ActionData.error` from server actions
- Displayed as a red banner above the form (`background: #450a0a`)
- No client-side validation — server is authoritative
- See [`docs/API.md`](API.md) for form fields, validation rules, and redirect behaviour per route

### Wikilinks
- In note body: `[[Note Title]]` renders as `.wikilink` anchor (accent-green-muted)
- Unresolved links render as `.wikilink-broken` (accent-red, strikethrough)
- Hover: accent-green
- See [`docs/NOTES.md`](NOTES.md) for wikilink syntax, resolution pipeline, and authoring rules

### Delete Confirmation
- Delete action triggered by a separate `<form>` (not nested inside update form)
- `onsubmit` calls `confirm()` — if cancelled, `event.preventDefault()`

### Search
- Pure GET form — results appear on the same page, URL reflects query params
- No JS required, works without hydration

---

## Responsive Behaviour

Currently desktop-first. No explicit breakpoints defined. Grid layouts use `auto-fill minmax(280px)` which naturally collapses on small screens. Not a current priority.

---

## Graph Visual Legend (To Add)

A legend overlay on the home page (not yet implemented) should show:
- Node colour → status (stub, growing, mature)
- Node size → proportional to link count (planned)

---

## Future Design Considerations

- **Markdown preview pane** in editor: side-by-side textarea + rendered output
- **Tag autocomplete**: typeahead on the tags input field
- **Graph filter panel**: slide-in drawer with category/status toggles
- **Dedicated chat page**: natural-language prompt surface with a familiar conversation layout, grounded note link, concise summary, a separate "possible additions" section, and exactly 3 new topic ideas
- **Chat page**: familiar conversation UI with an optional context panel for matched notes, sources, and suggested follow-ups
- **Next-topic actions**: suggested topics should be visually distinct from existing note links and clearly indicate that they are candidates for new notes, not already saved notes
- **GSAP experiments**: motion-heavy interactions can be explored later, but animation remains secondary to clarity and should not overpower the tool-like UI
- **Motion rule**: if GSAP is used, prefer restrained, purposeful transitions over decorative animation loops
- **Theme and accent toggle**: support future theme selection plus independent accent color selection while preserving graph legibility
