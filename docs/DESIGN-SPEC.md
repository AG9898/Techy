# Design Specification — Techy

This document reflects the updated UI direction for the assistant-first phase. It supersedes assumptions that depend on a dedicated `/notes/new` page or the previous `night / paper / mist` theme model.

## Design Philosophy

Techy should feel like a soft, graph-centered private knowledge tool rather than a generic SaaS dashboard. The graph remains the hero, but assistant chat now becomes the primary authoring surface.

Current implementation direction:
- Tailwind CSS v4 remains the styling foundation
- Melt UI is the preferred primitive layer for interactive controls and review affordances
- GSAP is available for selective motion where it improves continuity or focus, and is currently used for assistant transcript/proposal states plus subtle rail/theme feedback
- Visual styling remains custom to Techy
- New UI should avoid a wall of interchangeable cards and instead prefer a few clear surfaces

---

## Token System

Techy uses a two-axis token system applied via `data-theme` and `data-accent` attributes on `<html>`.

Theme axis:
- `dark` — charcoal dark, near-black without going flat pure black
- `light` — tonal light, not harsh white

Accent axis:
- `sand`
- `lavender`
- `mauve`
- `rose`

All new components must use tokens. No hardcoded hex values should appear in component code.

Accent rules:
- Accent families are semantic names, not promises of one shared hex across all themes
- `dark` and `light` each provide their own tuned values for `--accent-primary` and `--accent-strong`
- `--accent-soft` should be derived from the current accent and surface tokens rather than hardcoded as a static pastel fill
- `sand` is the default accent for new sessions and for migrated preferences that no longer map cleanly

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

Authoritative typography should use:

```css
font-family: 'Space Mono', monospace;
```

Rules:
- `Space Mono` is the default font for the app shell, notes browsing, note detail, chat, and controls
- Do not treat `Space Mono` as a decorative accent font; it is the primary reading and UI face
- Typography should still feel closer to polished docs pages and technical terminals than to a dashboard
- If a future secondary face is introduced, `Space Mono` remains the authoritative base until the design docs explicitly change

---

## Layout

### Global Shell

```
┌──────────────┬─────────────────────────────────────────────┐
│ Left rail    │                                             │
│ [Techy]      │  <main class="page-content">                │
│ [Graph]      │  route-aware layout region                  │
│ [Notes]      │  notes, graph, chat, note detail            │
│ [Chat]       │                                             │
│ [theme]      │                                             │
│ [account]    │                                             │
└──────────────┴─────────────────────────────────────────────┘
```

Rules:
- The app shell should use a left rail rather than a top nav
- The rail should support expanded, collapsed, and auto-tucked states
- The graph page should default to the least intrusive rail presentation so the graph remains immersive
- `/chat` remains the primary authoring entry point
- `/notes` is the browsing and search surface

### Home (Graph)

- Full-viewport SVG adjacent to the left rail
- Minimal chrome
- Bottom-right floating graph control panel with a compact collapsed trigger
- Left rail should auto-tuck or minimize by default here, while still remaining expandable
- Graph should reflect new links immediately after assistant-confirmed note creation
- Graph controls should absorb legend and filter behavior into one unified panel instead of scattering multiple floating fragments

### Graph Control Panel

The graph page should use a single Obsidian-inspired tuning panel rather than separate legend and filter trays.

Structure:
```
[ Graph controls trigger ]
  -> expanded panel
[ Appearance ]
[ Filters ]
[ Physics ]
[ Reset to defaults ]
```

Rules:
- The trigger lives in the bottom-right corner of the graph page
- The panel is collapsed by default on load so the graph remains the hero
- Expanded state is transient UI state, but the chosen graph settings persist locally across visits
- The panel should feel like a soft instrument dock, not a dashboard sidebar
- The panel replaces the old separate legend and filter overlays
- Reset restores the documented default graph preset rather than clearing the graph into an undefined state
- Category colouring is the documented default and reset state, while the status/category toggle remains available for manual switching
- Hovering a node should spotlight that node, preserve only its directly linked same-category neighbors, and fade unrelated nodes, labels, and links

Panel sections:
- `Appearance` includes node sizing, link thickness, and text fade controls
- `Filters` includes the graph colour mode plus category/status filtering controls
- `Physics` includes force-layout controls such as link distance, repulsion, spacing, centering, and simulation tuning values that map cleanly to D3

### Notes List

```
[Page header: "Repository"  subtitle  [↑ Import] [↓ Export] ]
[Integrated search bar: "Search by title, tag, or category…"]
[All Collections | cat1 | cat2 | … | Orphans (n)]
[Featured grid: first 2 results as large excerpt cards, side-by-side]
[Notes list: remaining results as compact single-line rows in a grouped panel]
```

Rules:
- `/notes` owns search, filtering, import, export, and opening existing notes
- The graph empty-state CTA routes to `/chat`, not a dedicated new-note page
- The page uses the reference's repository-like composition rather than a wall of uniform cards
- Search lives in the notes header region and filters by title, tag, or category client-side (phase 1)
- Import and export are subordinated to compact action buttons in the header; they do not dominate the composition
- The first two filtered results get a featured-card treatment (large title, excerpt, badges, relative timestamp); remaining results render as compact row items
- `NoteCard` supports a `compact` boolean prop: when true it renders as a lean horizontal row (title left, category + status dot + date right)
- Featured cards include: category badge, tag pills (first 2), relative `updatedAt` timestamp, title (1.2rem bold), body excerpt (3-line clamp), status badge
- The compact rows list is wrapped in a grouped panel with a soft surface background and internal padding

### Chat

Chat is now both the conversation surface and the primary authoring surface.

```
[ notebook overlay trigger ...... ][ centered conversation column ............................ ]
[ slide-over recent chats ....... ][ minimal brand/title in empty state ...................... ]
[ low-noise resume affordance ...][ 21st-style composer chrome: mode chips + settings ....... ]
[ one primary app sidebar .......][ note picker row: visible only when Update is active .... ]
[ ................................][ conversation area without a dashboard wrapper .......... ]
[ ................................][ assistant proposal panel appears inline beneath message ]
[ ................................][ composer remains the primary entry point ............... ]
```

The assistant must be able to:
- converse normally
- generate a new note draft
- propose an update to an existing note
- request confirmation for deletion
- reopen a saved conversation transcript

Chat layout rules:
- The initial chat state defaults to inference-first `Auto`.
- Empty chat should use a centered, minimal entry state rather than a large explanatory card.
- The current `/chat` layout uses a Notebook Index slide-over surface for saved conversations so the app keeps one primary navigation rail.
- Entering chat may open the Notebook Index for quick resume; users can close it and keep the active thread in place.
- While already on `/chat` or `/chat/[conversationId]`, activating the main `Chat` nav toggles the Notebook Index in-place instead of reloading the page.
- Notebook Index updates immediately after successful assistant responses, so new/updated conversations appear without refresh.
- Remove non-essential top-of-page copy and status pills; the page should not open with a heavy header block.
- The composer should sit in a centered narrow column rather than stretching like a full-width dashboard dock.
- The conversation text bar should be materially smaller than the current wide dock treatment: reduced width, reduced height, reduced padding, and a calmer send affordance.
- Assistant replies should render lightweight markdown in the transcript so short headings, lists, code, and links stay readable.
- Default assistant replies should be concise and editorial rather than long article-style dumps.
- Provider/model controls should avoid clipped popovers and awkward wrapping; they should be consolidated into one assistant settings dialog anchored to the composer.
- The model selector remains the primary choice in that dialog, while provider switching remains available as a quieter secondary choice.
- `Auto`, `Create`, and `Update` should be exposed through a compact mode selector in the composer chrome rather than a separate toolbar of pills.
- Plain conversational turns should avoid redundant route chrome like generic `Chat` / `Conversation` pills; visible status should be reserved for override or mutation states that materially change the next user action.
- The update target picker should appear only when `Update` is active, anchored directly under the composer.
- The main chat surface should not be wrapped in a generic dashboard-style container component; the conversation area itself stays visually open.
- Chat should follow the modern AI-reference layout rhythm from `references/UI/chat-example.png`, translated through Techy's tokens and type system rather than copied literally.
- The current `/chat` composer uses the 21st.dev EaseMize prompt-box static layout as its structural reference: prompt text area above, compact action row below, visible `Auto` / `Create` / `Update` mode pills, secondary provider and model controls, subtle action dividers, conditional update-note picker, and a far-right circular send control.
- The composer mode pills are a Melt `RadioGroup` styled as compact chips, so `Auto`, `Create`, and `Update` remain one keyboard-accessible single-choice control with visible token-based focus treatment.
- The composer provider, model, and update-note pickers use Melt `Select` primitives styled through Techy tokens rather than browser-native select menus in the prompt box chrome.

### Conversational Create Offer

For topic-learning prompts without a strong saved-note match, render a compact inline create-offer card beneath the assistant reply instead of opening a full draft immediately.

Structure:
```
[ Save this topic ]
[ topic title ]
[ short explanation ]
[ Create note ]
```

Rules:
- The offer should be explicit and lightweight, not a hidden automatic mutation.
- Activating the CTA should append a visible follow-up create turn in chat and then open the existing editable create-note proposal flow.
- Do not show the create offer when a strong saved-note match is already being surfaced inline.

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
- Editable proposal panels should keep the assistant reply visible so the user can review the route, the sources, and the draft together.
- After a successful `create_note` confirmation, the editable draft panel should collapse away and hand off to a compact success card with a link to the saved note instead of leaving the full editor open.

### Delete Confirmation

Delete proposals render a smaller inline confirmation card rather than a full edit panel.

Rules:
- Explicit confirmation is required before delete.
- Confirmation is a clear UI action, but not a typed phrase.

---

## Components

### `Nav.svelte`

The top nav has been replaced with a collapsible left rail (`<nav class="rail">`).

**Implementation details:**
- Rail widths are controlled by CSS variables in `app.css :root`:
  - `--rail-w-expanded: 192px`
  - `--rail-w-collapsed: 52px`
  - `--rail-w: var(--rail-w-expanded)` (updated live on `document.documentElement` to match the rail's current visual width)
- The rail toggle owns `aria-expanded` / `aria-controls` directly and the nav body remains mounted so temporary opens do not rebuild the shell
- Route-aware default: the graph page (`/`) starts collapsed; other routes stay in their broader reading layout unless the user has explicitly collapsed or pinned the rail during the current session
- Collapsed mode expands only on the explicit top-left toggle; there is no hover-driven expansion
- When the rail is open but unpinned, it behaves as a temporary panel: route selection, outside click, or `Escape` collapses it again
- When pinned, the rail stays expanded across navigation until the user unpins or collapses it
- Nav labels (`span.nav-label`) fade out and collapse to zero width in `.rail.collapsed`; the toggle chevron rotates 180° (`.chevron.flipped`)
- In the collapsed visual state, the header shows only the centered expand toggle, the `T` logo mark is hidden, and the accent dot row is hidden to prevent clipping inside the 52px rail
- In the expanded visual state, the header shows explicit pin/unpin and collapse controls so the user can promote a temporary open rail into a persistent one
- The active route background is a shared sliding pill that animates between nav items instead of snapping per-link background fills
- Rail footer contains: dark/light theme toggle buttons, accent dot group (sand/lavender/mauve/rose), avatar + username, and sign-out form
- Any fixed-position page that needs to offset from the rail must use `left: var(--rail-w)` — never a hardcoded pixel offset

### `ForceGraph.svelte`
- A single `.controls-dock` at bottom-right replaces the old separate legend (bottom-left) and filter (bottom-right) overlays
- The trigger button (`controls-trigger`) shows a sliders icon and "Graph controls" label; coloured accent + badge when active filters are set
- The panel is collapsed by default (`controlsOpen = false`) and expands above the trigger on click
- Panel sections: **Appearance** (colour-mode toggle Status/Category with Category as the default/reset mode, legend dots, degree-based node-scale multiplier, visible link thickness, zoom-threshold text fade), **Filters** (category + status checkboxes), **Physics** (link distance, repulsion, collision spacing, centering strength, velocity decay, alpha decay), **Reset to defaults** button
- Appearance-only controls update the existing SVG selections live without rebuilding the graph; visible edge thickness is decoupled from the transparent edge hit-zone width so edge drilldown remains usable at all supported stroke widths
- Hover focus is client-only and derived from the loaded graph: the hovered node gets the strongest emphasis, directly linked neighbors in the same category stay readable, and all other nodes, labels, and links fade until hover ends
- Physics controls live-tune the D3 simulation via module-level refs (`simRef`, `linkForceRef`, `chargeForceRef`, `centerXForceRef`, `centerYForceRef`) and a single `$effect` that tracks the simulation-facing state values
- `getRadius` and `degreeMap` are module-level so they are accessible from the physics `$effect`, while label opacity is driven by the current zoom scale and the user-defined fade threshold
- Edge drilldown remains a separate bottom-center overlay and is not absorbed into the control panel
- `graph-container` uses `height: 100%` to fill the fixed-position `graph-wrapper` from `+page.svelte`
- Graph-view settings (`colorMode`, `hiddenCategories`, `hiddenStatuses`, `nodeScale`, `linkThickness`, `textFadeThreshold`, `linkDistance`, `chargeStrength`, `collisionPadding`, `centeringStrength`, `velocityDecay`, `alphaDecay`) persist to `localStorage` under key `techy:graph-settings`; loaded at init via `loadGraphSettings()` with per-field validation and clamping; written back by a dedicated `$effect`; `controlsOpen` is transient and excluded; existing saved `colorMode` values are preserved, while fresh/default state resolves to `category`
- Future motion can use GSAP selectively for graph state transitions, but only if it improves clarity

### `Chat` surface
- Compact mode selector: Auto | Create | Update
- The persistent composer should follow the 21st.dev EaseMize AI Prompt Box reference closely in static layout and density: rounded prompt surface, textarea above, compact action row below, icon buttons/chips that expand into labeled active pills, subtle dividers between action clusters, and a circular send control at the far right
- Techy's implementation must port the reference interaction model into Svelte rather than importing its React/shadcn implementation; do not add `framer-motion`, `lucide-react`, or Radix React dependencies
- Limit the 21st.dev-inspired composer treatment to current Techy controls: Auto | Create | Update, provider, model, selected update note, and send. Do not add upload, voice, canvas, image preview, or stop-generation controls until the corresponding product/API contracts exist
- A Notebook Index overlay allows the user to resume an older chat without leaving the chat surface
- Notebook Index implementation: `.chat-topbar` row at the top of the conversation column holds a `.notebook-toggle-btn` (pill button, `aria-expanded`); clicking opens/closes `.notebook-overlay` (position absolute within `.chat-shell`, slides via `transform: translateX`); `Escape` and backdrop click also close it; the overlay is desktop-only (hidden at ≤ 960px via `display: none`); mobile uses the existing `history-mobile` `<details>` drawer
- The desktop `.chat-shell` is now a single flex column (`position: relative`; no grid rail column); the `conversation-stream` and `composer-shell` remain centered with `margin: 0 auto`
- In Update mode, a full-width note picker appears below the composer chrome for choosing the note to review
- Send is disabled in Update mode until a note is selected
- Add one assistant settings control that contains provider and model selection
- Composer chrome is constrained to a centered narrow width on desktop rather than spanning the full conversation column
- Model remains the primary visible choice; provider stays visible but quieter within the same settings surface
- The settings dialog should use Techy overlay/surface tokens with comfortable width and wrapping so long model labels remain readable
- The composer helper copy is minimized; in `Auto` mode the composer does not need an always-visible explanatory sentence
- Render assistant citations and proposal panels inline
- Successful create-note commits collapse the draft panel into a smaller success card linked to the saved note
- Use Melt for the exclusive mode control, provider/model selectors, tooltips, confirmation affordances, and disclosure-style interaction where it improves accessibility
- Selecting a saved conversation restores its transcript; resuming it should not depend on provider-side hidden memory

---

## Interaction Patterns

### Assistant Creation Flow
1. User enables create mode and sends a prompt.
2. Assistant performs live web research and reasons over the existing graph.
3. Assistant responds conversationally and may return a structured draft proposal.
4. User edits the draft inline if needed.
5. User confirms save.
6. The app persists the note, syncs `note_links`, and applies any confirmed linked-note patches so graph connections are visible immediately.
7. The editable draft panel collapses into a compact success state with a direct link to the saved note.

### Chat Resume Flow
1. User opens `/chat` and selects a saved conversation.
2. The app loads the saved transcript from DB-backed chat history.
3. The UI restores prior messages, citations, and proposal review state as history.
4. When the user sends a new message, the app rebuilds the assistant input from the saved transcript rather than resuming provider-side hidden state.
5. Live research may run again if the resumed turn requires fresh grounding.

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
- composer active-control transitions inspired by the 21st.dev reference, such as icon scale/rotation and active label width/opacity
- subtle theme toggle choreography, if used
- shared active-state movement in the left rail when route selection changes

Current implementation applies this to new assistant replies and proposal-state transitions in `/chat`, the create-note success handoff, plus explicit rail/theme feedback and the sliding active-nav pill in `Nav.svelte`.

Avoid decorative motion loops or broad page-wide animation.

Composer motion rules:
- Use GSAP or CSS transitions to reproduce the 21st.dev active-pill feel without decorative looping motion
- Scope GSAP animations to the Svelte component and clean them up when the component unmounts or the animated state changes
- Prefer CSS transitions for simple color, border, and hover changes; reserve GSAP for the active mode label/icon choreography where it improves continuity

---

## Melt UI Guidance

Prefer Melt UI primitives where interaction quality matters:
- Chat/Create/Update composer mode control, modeled as an exclusive control even when it visually resembles toggle chips
- provider/model selectors
- confirmation/disclosure interactions
- any compact popover or command-like control near the composer

When implementing reference-inspired controls, agents should first inspect the installed `melt` package examples/types or current Melt documentation for Svelte 5 builder/component usage. Match the reference's behavior with Melt primitives and Techy styling tokens rather than copying Radix React patterns directly.

Do not use Melt as a pre-styled visual theme.
