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
│ [Notes]      │  notes/search, graph, chat, note detail     │
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

Panel sections:
- `Appearance` includes node sizing, link thickness, and text fade controls
- `Filters` includes the graph colour mode plus category/status filtering controls
- `Physics` includes force-layout controls such as link distance, repulsion, spacing, centering, and simulation tuning values that map cleanly to D3

### Notes List

```
[Page header: "Repository"  helper copy  [↑ Import] [↓ Export] ]
[Integrated search bar]
[Category tabs / chips]
[Mixed-density notes layout with a few larger anchor items and lighter secondary rows]
```

Rules:
- `/notes` owns search, filtering, import, export, and opening existing notes
- The old standalone `/search` route is removed after migration
- The page should borrow the open, repository-like composition from the reference rather than reverting to a wall of uniform cards
- Search should sit directly in the notes header region rather than living on a separate route
- Import and export remain present, but should not dominate the composition

### Chat

Chat is now both the conversation surface and the primary authoring surface.

```
[ history list / drawer ........ ][Conversation column.....]
[ recent chats / new chat ...... ][ assistant toolbar: mode toggle (Chat|Create|Update) | provider | model ]
[ low-noise resume affordance ...][ note picker row: visible only in Update mode            ]
[ compact metadata ..............][ conversation area ....................................... ]
[ ................................][ assistant proposal panel appears inline beneath message  ]
[ ................................][ composer ................................................ ]
```

The assistant must be able to:
- converse normally
- generate a new note draft
- propose an update to an existing note
- request confirmation for deletion
- reopen a saved conversation transcript

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
- Replace the current top nav with a collapsible left rail
- Integrate route links, theme controls, accent controls, and account actions into the rail
- Keep the dark/light toggle and accent dots
- Use Melt primitives where they improve collapse, disclosure, and keyboard behavior

### `ForceGraph.svelte`
- Replace separate legend/filter overlays with one unified graph control panel
- Persist graph-view preferences locally in the browser
- Support live graph tuning for appearance, filters, and D3 force behavior
- Keep edge drilldown work
- Ensure graph colors remain legible in both tonal themes
- Future motion can use GSAP selectively for graph state transitions, but only if it improves clarity

### `Chat` surface
- Three-mode toggle: Chat | Create | Update (segmented button group in toolbar)
- A recent-conversations list or drawer allows the user to resume an older chat without leaving the chat surface
- In Update mode, a full-width note-picker `<select>` appears below the toolbar for choosing the note to review
- Send is disabled in Update mode until a note is selected
- Add provider/model selection controls
- Render assistant citations and proposal panels inline
- Use Melt for selectors, confirmation affordances, and disclosure-style interaction where it improves accessibility
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
