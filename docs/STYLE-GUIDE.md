# Style Guide — Techy

## Purpose

This document defines the intended visual and interaction direction for Techy beyond the implementation details in [`docs/DESIGN-SPEC.md`](DESIGN-SPEC.md). The design spec remains the source for current component constraints and existing tokens; this guide defines the higher-level taste, page composition, and future theming rules that agents should follow when designing new UI.

Techy should feel like a **private knowledge atlas**: calm, soft, rounded, and spatial. It is not a generic SaaS dashboard and it is not a component showroom.

---

## Core Direction

### Visual Identity

Techy should feel like:
- a personal research environment
- a graph-first knowledge tool
- a polished internal docs product
- soft and quiet rather than sharp and mechanical

Techy should **not** feel like:
- a card-heavy admin dashboard
- a pre-themed component library demo
- a flashy cyberpunk interface
- a dense enterprise CRUD app

### Primary Metaphor

The D3 graph is the centerpiece of the product. The rest of the interface should feel like supporting layers around it:
- docked panels
- floating sheets
- soft toolbars
- search overlays
- grounded side panels

The app should be composed as an **environment**, not as a page full of isolated boxes.

### One-Sentence Rule For Agents

Design pages as continuous, rounded environments around the graph, not as collections of reusable cards.

---

## Design Principles

### 1. Graph First

The graph is the main visual identity of Techy. It should feel central, spacious, and alive.

Rules:
- Home should prioritize the graph over surrounding interface chrome
- Controls should appear as overlays, docks, or soft panels, not heavy containers
- Other pages should still visually connect back to the graph language through rounded shapes, soft highlights, and linked-note affordances

### 2. Soft Over Sharp

Techy should feel rounded and calm.

Rules:
- Prefer generous border radii
- Prefer low-contrast boundaries over hard outlines
- Prefer soft shadows, subtle blur, and tonal layering over thick borders
- Avoid cramped, high-friction UI

### 3. Zones Over Components

Agents tend to over-abstract every visual area into self-contained “components.” Avoid that as a visual pattern.

Rules:
- Build pages from a few intentional zones
- Let surfaces merge visually when they belong together
- Only introduce repeating cards when repetition is actually the content pattern
- Avoid turning every section into the same bordered container

### 4. Editorial, Not Decorative

Notes should feel like carefully presented reference material.

Rules:
- Strong content hierarchy
- Good whitespace around prose
- Metadata should feel lightweight and integrated
- Decorative effects must never compete with readability

### 5. Motion With Intent

Motion should guide attention and give the interface buoyancy. It should not become spectacle.

Rules:
- Animate transitions between states, not everything all the time
- Use motion to reveal hierarchy, focus, and continuity
- Keep easing smooth and confident
- No ambient looping animation unless it communicates meaningful system state

Railway is a useful reference for motion attitude: rounded, smooth, and polished, with animation used to support clarity rather than noise. Source: [railway.com](https://railway.com)

---

## Page Archetypes

Techy currently has three primary product surfaces.

### 1. Graph / Home

This is the signature experience.

Desired feel:
- immersive
- spacious
- low-chrome
- softly luminous

Layout guidance:
- full-bleed graph canvas below the nav
- controls as floating or docked overlays
- minimal always-visible UI
- node interactions should feel prominent and satisfying

Preferred supporting elements:
- floating legend or filter tray
- compact search/focus control
- contextual hover/focus panel
- theme/accent toggle in a persistent but unobtrusive position

Avoid:
- shrinking the graph into a boxed panel
- wrapping the graph with unnecessary page furniture
- placing multiple competing cards around the canvas

### 2. Notes Search -> Note Detail

This experience should feel like a clean docs interface, not a dashboard.

Desired feel:
- readable
- curated
- calm
- spatially coherent

Layout guidance:
- search and filtering should feel like a soft command surface
- results should read as an organized browsing layer, not a metrics grid
- full note view should feel like a polished internal documentation page
- metadata should support the note body, not compete with it

Preferred structure:
- a clear search header or command area
- a results region with restrained repetition
- note detail presented as one main reading surface
- backlinks and linked notes in secondary supporting regions

Avoid:
- tile-heavy card walls as the default expression
- too many boxed metadata blocks
- splitting note content into lots of equally weighted panels

### 3. Chat

The chat page can follow current SaaS and AI-chat conventions more closely, but it must still match Techy’s soft observatory visual system.

Desired feel:
- familiar
- grounded
- calm
- integrated with the note system

Recommended structure:
- conversation area as the primary surface
- persistent composer at the bottom
- optional conversation/history rail if needed
- optional context panel for matched notes, citations, or suggested follow-ups on desktop

Chat-specific rules:
- use conventional message alignment and composer placement
- keep message containers soft and light, not glossy or gamified
- grounded-note references should be visually distinct from ordinary message text
- suggestions and “next note” prompts should look assistive, not promotional

Avoid:
- making the chat UI look like a separate product
- over-styling bubbles with high contrast or novelty effects
- adding decorative bot personas or mascot-like presentation

---

## Composition Rules

### Page Construction

A page should usually consist of:
- one dominant surface
- one or two supporting surfaces
- lightweight controls layered nearby

This is the default shape for almost every screen.

### Surface Behavior

Surfaces should feel related, not boxed off from each other.

Rules:
- use tonal separation first
- use borders sparingly
- use radius to indicate grouping
- use spacing to clarify hierarchy

### Repetition Rule

If a layout starts to look like “a set of interchangeable cards,” stop and simplify it.

Use repeated cards only when:
- the user is scanning many equivalent entities
- the repetition itself conveys structure
- a list/table/grid is more honest than a faux editorial layout

---

## Shape, Depth, and Density

### Shape Language

The default geometry is round and soft.

Rules:
- prefer rounded corners across panels, inputs, tabs, buttons, and drawers
- prefer pill treatments for compact controls and filters
- avoid tiny radii on major surfaces

### Depth

Depth should be subtle.

Rules:
- soft shadow over hard drop shadow
- faint blur only when it improves layering
- minimal glassmorphism; never let blur reduce legibility

### Density

Techy is desktop-primary and can be information-dense, but density should feel intentional rather than cramped.

Rules:
- compact where users scan
- spacious where users read
- give prose more room than controls

---

## Typography

Typography should support a docs-like reading experience with a more refined, softer tone than a default dashboard.

Current implementation uses:
- sans: `Inter`, system-ui, sans-serif
- mono: `Fira Code`, `Cascadia Code`, monospace

Guidance:
- prioritize clear editorial hierarchy
- note detail pages should feel closer to well-designed docs than to admin forms
- labels and metadata should remain quiet
- monospace is for code, tags, and structured technical cues, not for large UI areas

If typography evolves later, prefer type choices that remain clean, modern, and calm rather than aggressively futuristic.

---

## Color and Theme System

### Theming Model

Techy should support two independent controls:
- `Theme`: changes the full environmental palette
- `Accent`: changes the highlight family used for interactive emphasis

This allows the app to stay visually coherent while giving the user expressive control.

### Initial Theme Set

#### `Night`

Default theme.

Feel:
- observatory
- soft dark
- calm and immersive

Use:
- deepest graph presentation
- primary default experience

#### `Paper`

Warm light mode.

Feel:
- editorial
- archival
- docs-like

Use:
- long-form reading and note work

#### `Mist`

Cool, low-contrast neutral mode.

Feel:
- quiet
- modern
- understated

Use:
- minimal, low-fatigue interface sessions

### Initial Accent Set

#### `Sky`

Default accent. Calm, clear, technical.

#### `Mint`

Fresh and research-oriented. Good for graph links and knowledge cues.

#### `Amber`

Warm and thoughtful. Good for editorial or archive-leaning themes.

#### `Rose`

Soft and personal without feeling playful.

### Token Guidance

Theme tokens should be structured so D3, app chrome, and content surfaces all derive from the same system:
- `bg-base`
- `bg-surface`
- `bg-raised`
- `bg-overlay`
- `border-soft`
- `border-strong`
- `text-primary`
- `text-secondary`
- `text-muted`
- `accent-primary`
- `accent-strong`
- `accent-soft`
- `graph-node-stub`
- `graph-node-growing`
- `graph-node-mature`
- `graph-link`
- `graph-focus`

Rules:
- theme sets neutrals and environmental contrast
- accent sets interaction color family
- graph tokens must stay legible within every theme
- avoid arbitrary one-off colors in components

---

## Graph Styling Rules

The graph should look soft, centered, and intentional.

Rules:
- nodes should feel luminous, not harsh
- links should be visually quiet until focus or interaction
- labels should be readable but secondary to node presence
- hover/focus states should gently elevate a node rather than “flash” it
- filtering and graph mode changes should animate smoothly

Preferred visual cues:
- soft halos or glow used sparingly
- category or status color encoded cleanly
- subtle depth difference between active and inactive graph elements

Avoid:
- sharp neon outlines
- cluttered always-visible overlays
- excessive legend chrome

---

## Notes Experience Rules

Notes should feel like the reading and authoring half of the same world established by the graph.

Rules:
- note detail should prioritize comfortable reading width and hierarchy
- metadata should be integrated near the title, not broken into many detached blocks
- internal links should feel elegant and connected to the graph model
- the transition from search result to full note should feel like moving deeper into the atlas

Preferred feel:
- a clean docs page
- a lightweight research sheet
- a private reference notebook

Avoid:
- over-framing note content with many nested containers
- turning tags, aliases, and status into bulky UI
- making the detail view feel like a CRUD record page

---

## Chat Experience Rules

The chat page should follow familiar AI product conventions while remaining clearly part of Techy.

Rules:
- keep the composer persistent and obvious
- keep the conversation surface clean and spacious
- show note grounding, citations, and suggestions as support structures beside or beneath messages
- make context panels feel like extensions of the conversation, not separate dashboards

Recommended desktop arrangement:
- center conversation column
- bottom composer
- optional right-side context panel for matched notes, references, and suggested next topics

Recommended mobile arrangement:
- single-column conversation
- context collapses into inline expandable sections

Avoid:
- cluttering the chat view with many utility panels
- hiding important grounding/context behind tiny affordances
- making the page more visually busy than the graph or notes experiences

---

## Motion Rules

GSAP may be used, but motion must stay restrained and meaningful.

Good uses:
- graph focus and refocus transitions
- panel enter/exit motion
- search result reveal
- note sheet transitions
- theme or mode transition choreography if kept subtle

Avoid:
- perpetual looping motion
- bouncing UI
- exaggerated hover animations
- page-wide animation for minor state changes

Motion should feel:
- smooth
- rounded
- quiet
- confident

---

## Implementation Guidance

### Tailwind

Tailwind v4 is the primary layout and styling tool. Use it to apply the theme tokens consistently and to control spacing, radius, typography, and responsive structure.

### Melt

Use Melt for behavior and accessibility primitives only. Do not let Melt define the visual language.

### D3

D3 should consume shared theme variables so the graph remains native to the rest of the UI.

### GSAP

Use GSAP only when transitions need stronger choreography than CSS alone can provide.

---

## Do / Don’t

### Do

- keep the graph visually central
- build pages from a small number of intentional zones
- prefer soft, rounded surfaces
- make note pages feel like docs
- use conventional chat patterns where appropriate
- support theme and accent customization through tokens

### Don’t

- default to a wall of generic cards
- design every section as a standalone component container
- use sharp, metallic, or overly synthetic styling
- let motion overpower clarity
- make the chat page feel detached from the rest of the product

---

## Summary

Techy should feel like a soft, graph-centered knowledge environment with three coherent experiences:
- an immersive graph homepage
- a clean notes browsing and reading flow
- a familiar but integrated chat surface

When in doubt, choose the option that feels more spatial, calmer, softer, and less like a generic component-driven dashboard.
