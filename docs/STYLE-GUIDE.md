# Style Guide — Techy

This document defines the intended visual and interaction direction for Techy beyond implementation detail. It now assumes an assistant-first product where `/chat` is both the conversation surface and the primary authoring surface.

Techy should feel like a **private knowledge atlas**: calm, soft, rounded, and spatial. It is not a generic SaaS dashboard and it is not a component showroom.

---

## Core Direction

### Visual Identity

Techy should feel like:
- a personal research environment
- a graph-first knowledge tool
- a polished internal docs product
- an assistant-guided note system rather than a form-heavy CRUD app

Techy should **not** feel like:
- a card-heavy admin dashboard
- a pre-themed component library demo
- a cluttered chatbot shell
- a form wizard bolted onto a graph app

### Primary Metaphor

The D3 graph remains the centerpiece of the product. The assistant chat becomes the main authoring companion around that graph.

The app should still be composed as an **environment**, not as a page full of isolated boxes.

---

## Design Principles

### 1. Graph First

- Home should prioritize the graph over surrounding chrome
- Controls should appear as overlays, docks, or soft panels
- New assistant-created links should feel immediately reflected in the graph

### 2. Soft Over Sharp

- Prefer generous radius
- Prefer tonal layering over harsh borders
- Keep dark mode charcoal-toned and near-black rather than navy
- Keep light mode light but not stark white

### 3. Zones Over Components

- Build pages from a few intentional zones
- Let related surfaces merge visually
- Do not let the chat become a pile of stacked generic cards

### 4. Editorial, Not Decorative

- Notes should still feel like carefully presented reference material
- Metadata should remain quiet
- Assistant proposals should read like review surfaces, not marketing widgets

### 5. Motion With Intent

- Animate transitions between states, not everything all the time
- Use motion to reveal authorship states, confirmation states, and continuity
- Keep easing smooth and confident

---

## Page Archetypes

### 1. Graph / Home

Desired feel:
- immersive
- spacious
- low-chrome
- softly luminous

Preferred supporting elements:
- one unified graph tuning panel
- compact focus control
- contextual graph overlays
- unobtrusive theme/accent controls

Graph control panel guidance:
- the panel should stay hidden by default behind a compact trigger
- the expanded panel should feel like a soft docked instrument for tuning the graph, not a permanent sidebar
- legend, filtering, and force-tuning controls should feel like one family of controls rather than separate floating widgets
- persisted graph preferences should preserve user tuning without adding heavy chrome to the page

### 2. Notes Repository -> Note Detail

Desired feel:
- readable
- curated
- calm
- spatially coherent

Rules:
- notes browsing is no longer the primary creation surface
- notes browsing and search should live together in the same `/notes` surface
- the notes index should feel like a repository, not a search-results utility page
- avoid a wall of interchangeable boxed cards; use mixed-density composition and open space
- note detail should still feel like a polished docs page
- backlinks and linked notes remain supporting regions

### Shell

Desired feel:
- quiet
- structural
- spatially adaptive

Rules:
- the shared app shell should use a left rail instead of a horizontal top nav
- the rail should be collapsible and able to auto-tuck on immersive routes like the graph
- collapsed rails should reopen only through an explicit user action, not passive hover
- temporary expanded rails may close on route selection, outside click, or `Escape`, while pinned rails stay stable across navigation
- shell behavior should preserve focus on the current page rather than constantly demanding attention
- pages that scroll inside `.page-content` do not need to reference the rail width; only full-bleed fixed-position pages (currently only the graph) should anchor to `left: var(--rail-w)` — never a hardcoded pixel offset

### 3. Chat

Chat is now a hybrid surface: conversation, note drafting, note review, and note mutation confirmation.

Desired feel:
- familiar
- grounded
- calm
- integrated with the note system

Rules:
- keep the composer persistent and obvious
- keep provider/model selectors and create/update overrides close to the composer so the thread remains the primary surface
- keep the conversation surface clean and spacious
- show assistant proposals as review surfaces, not separate dashboards
- keep citations assistive and low-noise
- inferred create/update behavior must not break normal conversation
- persisted chat history should feel like a quiet notebook index, not a busy support inbox

Recommended desktop arrangement:
- a restrained history rail or drawer for recent chats
- centered conversation column
- assistant controls near the composer
- inline editable proposal panel for create/update
- optional secondary context region later, but not required for the first pass

Recommended mobile arrangement:
- single-column conversation
- chat history collapses into a compact drawer or sheet rather than permanently consuming vertical space
- proposal panel collapses under the triggering assistant message

---

## Theming Direction

Techy should support two independent controls:
- `Theme`: `dark` or `light`
- `Accent`: a separate highlight family

### Dark

Dark should be tonal and atmospheric:
- charcoal and near-black rather than blue-slate
- still readable for long sessions
- graph remains the strongest visual expression

### Light

Light should be tonal and editorial:
- not stark white
- comfortable for reading and note detail work
- still clearly part of the same visual system as dark mode

### Accents

Accents remain separate from theme and can stay expressive:
- `Sand`
- `Lavender`
- `Mauve`
- `Rose`

Rules:
- Accent families should be retuned per theme instead of forcing one shared hex palette across both `dark` and `light`
- Accent colors should stay slightly desaturated and editorial against the charcoal dark shell
- `sand` is the default accent because it fits the neutral shell without pulling the product back toward blue
- Accent color is primarily for links, active emphasis, and key interactive states; use it sparingly so the graph and content remain the focus

---

## Chat Experience Rules

The chat page should follow familiar AI product conventions while remaining clearly part of Techy.

Rules:
- keep the composer persistent and obvious
- keep the chat surface unified and inference-first
- expose create/update as compact override controls rather than the primary mental model
- show provider/model controls without turning the toolbar into a cockpit; keep the controls compact and adjacent to the composer
- let users resume prior conversations without making chat history the dominant visual element
- render note proposals inline as editable review surfaces
- when a strong existing-note match is found, surface it inline and offer further research or review without abruptly switching the user into an edit flow
- show citations during review without overwhelming the draft itself
- keep delete confirmation compact and deliberate
- store and present the app-owned transcript as the canonical history view; do not expose provider-specific hidden memory concepts in the UI

Avoid:
- making the chat UI look like a separate product
- forcing ambiguous prompts into create/update behavior without a clear signal or fallback
- turning assistant proposals into a wall of utility panels
- turning saved conversation history into a dense email-style list that competes with the current conversation

---

## Notes Experience Rules

Notes should still feel like the reading and browsing half of the same world established by the graph and assistant.

Rules:
- the `/notes` page should combine search and browsing into one coherent surface
- the search bar should read as part of the page composition, not as a separate utility module
- empty states that invite note creation should point users into `/chat`, since it is the primary authoring surface
- favor zones, staggered emphasis, and editorial spacing over uniform card grids
- note detail prioritizes comfortable reading width and hierarchy
- metadata stays integrated near the title
- internal links should feel elegant and connected to the graph model
- the transition from assistant-created draft to saved note should feel coherent with the browsing surface

---

## Motion Rules

GSAP may be used, but motion must stay restrained and meaningful.

Good uses:
- proposal panel enter/exit
- assistant message reveal
- confirmation-state transitions
- subtle theme transition choreography

Avoid:
- perpetual looping motion
- exaggerated hover animation
- page-wide animation for minor state changes

---

## Melt Guidance

Use Melt for behavior and accessibility primitives where the assistant flow benefits from them:
- compact create/update override controls
- provider/model selectors
- disclosure and confirmation UI
- compact command-like controls
- shell collapse / tucked-state disclosure where it improves accessibility and keyboard behavior

Do not let Melt define the visual language.

---

## Summary

Techy should feel like a soft, graph-centered knowledge environment with three coherent experiences:
- an immersive graph homepage
- a clean notes browsing and reading flow
- a unified assistant chat that can converse, research, draft, and confirm note changes
