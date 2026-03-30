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

## Token System

Techy uses a two-axis token system applied via `data-theme` and `data-accent` attributes on `<html>`. Tokens cascade to all child elements including the D3 graph SVG. Theme and accent selections are persisted to `localStorage` and restored without flash via an inline script in `src/app.html`.

All new components must use these tokens — no hardcoded hex values.

### Semantic Tokens (vary by theme and/or accent)

| Token | Usage |
|-------|-------|
| `--bg-base` | Page background |
| `--bg-surface` | Cards, nav, inputs, form elements |
| `--bg-raised` | Hover states, tags, code blocks |
| `--bg-overlay` | Overlays, modals |
| `--border-soft` | Default borders |
| `--border-strong` | Hover borders, emphasis |
| `--text-primary` | Headings, main content |
| `--text-secondary` | Labels, form hints, secondary text |
| `--text-muted` | Timestamps, empty states, back links |
| `--text-subtle` | Dates, hint text |
| `--accent-primary` | Logo, links, active controls (set by accent) |
| `--accent-strong` | Primary buttons, focus borders (set by accent) |
| `--accent-soft` | Tinted backgrounds for accent-coloured UI (set by accent) |
| `--graph-node-stub` | Graph node colour — stub status |
| `--graph-node-growing` | Graph node colour — growing status |
| `--graph-node-mature` | Graph node colour — mature status |
| `--graph-link` | Graph edge stroke |
| `--graph-focus` | Graph focus/hover highlight |
| `--accent-green` | Wikilink hover, mature status |
| `--accent-green-muted` | Wikilink default colour |
| `--accent-red` | Errors, broken wikilinks, delete actions |
| `--accent-purple` | AI-generated badge |

### Legacy Token Aliases (kept for backward compat)

`--border` → `--border-soft` · `--border-hover` → `--border-strong` · `--accent-blue-light` → `--accent-primary` · `--accent-blue` → `--accent-strong` · `--accent-blue-hover` → accent hover value

### Themes

| Theme | Character | `--bg-base` |
|-------|-----------|-------------|
| `night` | Observatory, soft dark (default) | `#0a0f1e` |
| `paper` | Warm light, editorial, archival | `#faf7f2` |
| `mist` | Cool neutral, quiet, understated | `#f0f4f8` |

### Accents

| Accent | Character | `--accent-primary` |
|--------|-----------|--------------------|
| `sky` | Calm, clear, technical (default) | `#7dd3fc` |
| `mint` | Fresh, research-oriented | `#86efac` |
| `amber` | Warm, thoughtful | `#fcd34d` |
| `rose` | Soft, personal | `#fda4af` |

### Graph Node Status Colours (Night theme)

| Status | Token | Value |
|--------|-------|-------|
| `stub` | `--graph-node-stub` | `#64748b` |
| `growing` | `--graph-node-growing` | `#38bdf8` |
| `mature` | `--graph-node-mature` | `#4ade80` |

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
│  Nav: [Techy]  [Graph] [Notes] [+ New] [Search]  [Night▾] ●●●●  [😊] [Sign out] │  60px, sticky
├────────────────────────────────────────────────────────────┤
│                                                            │
│  <main class="page-content">                               │
│  max-width: 1200px, margin: 0 auto, padding: 2rem          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Nav positioning:** `position: sticky; top: 0; z-index: 50` — stays in view as bounded pages scroll.

**Full-bleed exception:** The home (graph) page uses `position: fixed; top: 60px` to fill the viewport below the sticky nav, bypassing the `page-content` container. All controls, legends, and filters on that page appear as floating overlays.

### Page Layouts

**Home (Graph):** Full-viewport SVG, no padding, dark background. Empty state centred.

The home page should preserve the feeling of a full environment rather than a boxed canvas. Controls, legends, and future filters should appear as floating or docked overlays rather than heavy surrounding panels.

**Notes List:**
```
[Page header: "Notes"   [↑ Import] [↓ Export] [+ New Note] ]
[Category filter chips (pill row)                          ]
[Grid: auto-fill minmax(280px, 1fr), gap 0.75rem           ]
```
Header actions: Import (toggle import panel) and Export are secondary buttons (`bg-surface + border-soft`); New Note is a primary button (`bg-raised + accent-primary text`). Category chips use `border-radius: 999px`; active chip gets accent tint via `color-mix`.

**Note Detail:**
```
[← Notes                     [status badge] [History] [Edit] ]
[h1: Title                                                   ]
[category badge] [tag chips...] [ai badge?] [date            ]
[─────────────────────────────────────────────────────────── ]
[  Rendered Markdown body (max-width 720px, line-height 1.75)]
[─────────────────────────────────────────────────────────── ]
[Links to: ...    |   Linked from: ...                       ]
```
Meta row sits between title and body, separated from body by a `border-soft` bottom border. Category badge uses `color-mix(in srgb, accent-primary 12%, bg-surface)` background. AI badge uses `color-mix(in srgb, accent-purple 15%, transparent)`. Status badge in header uses `data-status` attribute + `color-mix` (same pattern as NoteCard). History and Edit are secondary buttons (`bg-surface + border-soft`). Body prose: `font-size: 0.92rem`, `line-height: 1.75`, `color: text-secondary`. Relations section has `border-top: border-soft` and sits below the body.

**Create / Edit Note:** Authoring surface, max-width 720px at rest, expands to 1400px when the preview pane is open.

```
[← Back link                                    ]
[h1: New Note / Edit Note                       ]
[error-banner? (accent-red tint, border-soft)   ]
┌─ authoring-form (bg-surface, border-soft, 12px radius) ──────────────┐
│  fields-meta (padding 1.5rem, border-bottom: border-soft)             │
│    [Title input (flex: 1)   ] [ ✦ Research with AI (btn-ai) ]         │
│    [ai-error banner? (accent-red tint, border-soft)         ]         │
│    [Category            ] [Status              ]                      │
│    [Tags                ] [Aliases             ]                      │
├───────────────────────────────────────────────────────────────────────┤
│  fields-body (padding 1.5rem, border-bottom: border-soft)             │
│    body-header: [Body label + hint]      [Preview / Hide Preview btn] │
│    body-split (flex row when preview open):                           │
│      [textarea (font-mono, rows 18)]  [preview-pane (bg-raised)]      │
├───────────────────────────────────────────────────────────────────────┤
│  form-actions (padding 1rem 1.5rem)  [Cancel]  [Save / Create]        │
└───────────────────────────────────────────────────────────────────────┘
[delete-section (separate <form>, border-top: border-soft) — edit only  ]
```

Inputs use `bg-raised`, `border-soft`, `border-radius: 8px`. Focus ring: `border-color → accent-strong` + `box-shadow: 0 0 0 3px color-mix(in srgb, accent-strong 18%, transparent)`. Field labels are `0.8rem / 500 / text-secondary`. Error banner: `color-mix(in srgb, accent-red 15%, bg-surface)` background with `accent-red` border. Save/Create button: `accent-strong` background, `#fff` text. Delete button: `color-mix(in srgb, accent-red 40%, transparent)` border, `accent-red` text — separate `<form>` element so it is never nested inside the edit form.

**Markdown preview pane (`.preview-pane`):** Shown when the user toggles "Preview" / "Hide Preview" (`btn-preview`). Sits to the right of the textarea in a flex row (`.body-split`). Renders the textarea content via `marked.parse()` client-side. `[[wikilinks]]` are pre-processed before passing to marked: resolved titles (matched against `data.noteTitles` from the server) render as `<span class="wikilink">` (`accent-green-muted`); unresolved titles render as `<span class="wikilink-broken">` (`accent-red`, strikethrough). Preview background: `bg-raised`, `border-soft`, 8px radius, `font-size: 0.9rem`, `line-height: 1.75`. Toggle button (`btn-preview`): `bg-raised` background, `border-soft` border, `text-muted` label, 6px radius — a small secondary control in the body-header row.

**AI research button (`btn-ai`):** Sits inline with the title input in a flex `.title-row`. Disabled until the title field has a non-empty value. On click, POSTs `{ topic: title }` to `/api/ai/research`, populates the body textarea with the returned Markdown, and sets hidden fields `ai_generated=true`, `ai_model`, `ai_prompt`. During the request, shows a CSS spinner and "Researching…" text. Errors appear as an `ai-error` banner (`accent-red` tint) directly below the title row. Button styling: `color-mix(in srgb, accent-purple 14%, bg-raised)` background, `accent-purple` text and border — uses `--accent-purple` to signal AI provenance consistently with the AI badge on note detail.

**Search:**
```
[ search-command surface (bg-surface, border-soft, border-radius 12px)  ]
[   [ search input (bg-raised)              ] [ Search button ]          ]
[   [ TAGS label / input ] [ CATEGORY label / input ]                    ]
[ N results                                                              ]
[ Grid: results (auto-fill minmax(280px, 1fr), gap 0.75rem)             ]
```
The search and filter controls are wrapped in a single rounded surface (`bg-surface`, `border-soft`, `border-radius: 12px`) to feel like a command area. Search input uses `bg-raised`, `font-size: 1rem`. Search button uses `accent-strong` background with `#fff` text. Filter labels use uppercase `text-muted` heading text (`font-size: 0.7rem`). No page `h1` heading — the command surface itself is the visual anchor.

**Chat:**
```
[Conversation column (max-width 720px, centred).....................]
[  conversation-area (bg-surface, 16px radius, flex: 1)          ]
[    empty-state  ◈  "Ask about your notes"                      ]
[    loading-state  • • •  "Thinking…"                           ]
[composer-wrap (bg-surface, 14px radius, bottom of column).........]
[  [textarea                              ] [ Send ]             ]
```

Chat uses familiar AI product conventions while remaining part of the same rounded, calm system. The shell fills `calc(100vh - 60px - 4rem)` so the composer is always visible without page scroll. Empty and loading placeholder states are wired into `isLoading` state for future assistant integration. The Send button is disabled until the textarea is non-empty. All surfaces use `--bg-surface`, `--border-soft`, and `--border-strong`; the Send button uses `--accent-strong` with white text.

---

## Components

### `Nav.svelte`
- Position: `sticky; top: 0; z-index: 50`
- Height: 60px, background: `bg-surface`, border-bottom: `border-soft`
- Left: logo `Techy` (accent-primary, bold, `letter-spacing: -0.01em`)
- Centre (pushed right with `margin-left: auto`): navigation links — pill hover states (`bg-raised` background, `border-radius: 9999px`, padding `0.35rem 0.75rem`), text-secondary at rest, text-primary on hover
- Right controls: theme pill-group (theme buttons wrapped in a `bg-base + border-soft` pill container; active button gets `bg-surface + accent-primary` text) + accent dot row (12×12px circles, active shows text-primary border)
- Far right user area: avatar (28×28px, `border-radius: 50%`, soft `border-soft` border) + pill sign-out button (`border-radius: 9999px`, border-soft border, text-muted at rest, text-secondary on hover)

### `NoteCard.svelte`
- Background: `bg-surface`, border: `border-soft`, `border-radius: 10px`
- Hover: `border-color → border-strong`, `background → bg-raised`
- Header row: title (`font-weight: 600`, `text-primary`, `font-size: 0.9rem`) + status badge (right-aligned, `flex-shrink: 0`)
- Status badge: `border-radius: 999px`, color and background set via `data-status` CSS attribute selector + `color-mix(in srgb, var(--graph-node-*) 15%, transparent)` — themed correctly across all themes
- Second row: category (`accent-primary`, `font-weight: 500`, `font-size: 0.75rem`) — no background
- Tags row: tag chips (`bg-raised`, `text-muted`, `border-radius: 4px`)
- Footer: date (`text-subtle`, `font-size: 0.68rem`)

Note cards should be used where repetition is the honest content pattern. They should not become the default wrapper for every page section.

### `ForceGraph.svelte`
- Full-bleed SVG inside container `height: calc(100vh - 60px)`
- Nodes: circles r=10, stroke: bg-surface stroke-width: 2
- Hover state: circle transitions to r=13, stroke → `--graph-focus`, stroke-width: 2.5 (150ms duration, reverts on mouseleave)
- Labels: 11px, text-secondary, offset x=14 y=4 from node centre
- Links: stroke `--graph-link`, stroke-width: 1.5, arrow marker
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

## Graph Visual Legend

A floating legend overlay is rendered in `+page.svelte` as an `absolute` positioned element (bottom-left of the graph wrapper). It shows:
- Node colour → status (stub, growing, mature) using the `--graph-node-*` tokens
- Styled with `bg-overlay`, `border-soft`, `border-radius: 0.75rem`, `backdrop-filter: blur(6px)`, `pointer-events: none`
- Node size → proportional to link count (planned, not yet implemented)

---

## Future Design Considerations

- **Tag autocomplete**: typeahead on the tags input field
- **Graph filter panel**: slide-in drawer with category/status toggles
- **Dedicated chat page**: natural-language prompt surface with a familiar conversation layout, grounded note link, concise summary, a separate "possible additions" section, and exactly 3 new topic ideas
- **Chat page**: familiar conversation UI with an optional context panel for matched notes, sources, and suggested follow-ups
- **Next-topic actions**: suggested topics should be visually distinct from existing note links and clearly indicate that they are candidates for new notes, not already saved notes
- **GSAP experiments**: motion-heavy interactions can be explored later, but animation remains secondary to clarity and should not overpower the tool-like UI
- **Motion rule**: if GSAP is used, prefer restrained, purposeful transitions over decorative animation loops
- **Theme and accent expand**: additional themes or accents can be added by defining a new `[data-theme]` or `[data-accent]` block in `src/app.css` and adding it to the Nav toggle list
