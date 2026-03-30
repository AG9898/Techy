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
- Keep dark mode dark but not pure black
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
- floating legend or filter tray
- compact focus control
- contextual graph overlays
- unobtrusive theme/accent controls

### 2. Notes Search -> Note Detail

Desired feel:
- readable
- curated
- calm
- spatially coherent

Rules:
- notes browsing is no longer the primary creation surface
- note detail should still feel like a polished docs page
- backlinks and linked notes remain supporting regions

### 3. Chat

Chat is now a hybrid surface: conversation, note drafting, note review, and note mutation confirmation.

Desired feel:
- familiar
- grounded
- calm
- integrated with the note system

Rules:
- keep the composer persistent and obvious
- keep the conversation surface clean and spacious
- show assistant proposals as review surfaces, not separate dashboards
- keep citations assistive and low-noise
- create mode must not break normal conversation

Recommended desktop arrangement:
- centered conversation column
- assistant controls near the composer
- inline editable proposal panel for create/update
- optional secondary context region later, but not required for the first pass

Recommended mobile arrangement:
- single-column conversation
- proposal panel collapses under the triggering assistant message

---

## Theming Direction

Techy should support two independent controls:
- `Theme`: `dark` or `light`
- `Accent`: a separate highlight family

### Dark

Dark should be tonal and atmospheric:
- not pure black
- still readable for long sessions
- graph remains the strongest visual expression

### Light

Light should be tonal and editorial:
- not stark white
- comfortable for reading and note detail work
- still clearly part of the same visual system as dark mode

### Accents

Accents remain separate from theme and can stay expressive:
- `Sky`
- `Mint`
- `Amber`
- `Rose`

---

## Chat Experience Rules

The chat page should follow familiar AI product conventions while remaining clearly part of Techy.

Rules:
- keep the composer persistent and obvious
- make create mode explicit
- show provider/model controls without turning the toolbar into a cockpit
- render note proposals inline as editable review surfaces
- show citations during review without overwhelming the draft itself
- keep delete confirmation compact and deliberate

Avoid:
- making the chat UI look like a separate product
- hiding note-creation state behind ambiguous affordances
- turning assistant proposals into a wall of utility panels

---

## Notes Experience Rules

Notes should still feel like the reading and browsing half of the same world established by the graph and assistant.

Rules:
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
- create-mode toggle
- provider/model selectors
- disclosure and confirmation UI
- compact command-like controls

Do not let Melt define the visual language.

---

## Summary

Techy should feel like a soft, graph-centered knowledge environment with three coherent experiences:
- an immersive graph homepage
- a clean notes browsing and reading flow
- a unified assistant chat that can converse, research, draft, and confirm note changes
