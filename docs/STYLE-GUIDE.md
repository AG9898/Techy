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
- active-page emphasis in the rail should feel like one continuous surface sliding between destinations, not a snapped per-link state change
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
- the composer may absorb assistant controls when they stay compact, obvious, and secondary to the prompt itself
- keep the conversation surface clean and spacious
- show assistant proposals as review surfaces, not separate dashboards
- after a create-note confirmation succeeds, hand the user back to the conversation with a compact success state rather than leaving the full proposal editor occupying the thread
- keep citations assistive and low-noise
- inferred create/update behavior must not break normal conversation
- render assistant prose with lightweight markdown so scannable structure survives in the transcript
- bias normal chat replies toward concise, digestible output rather than long-form essays
- persisted chat history should feel like a quiet notebook index, not a busy support inbox
- default the chat entry state to inference-first `Auto`
- reduce page-header copy to the minimum needed; avoid stacked title, eyebrow, lede, and status-pill clutter
- keep the empty state centered and composer-led rather than explaining the product through cards
- keep the model control inline with the composer chrome and demote provider switching to a quieter secondary control
- style `Auto`, `Create`, and `Update` as compact skill-like toggles attached to the composer
- avoid wrapping the main chat surface in a large generic card or dashboard shell
- let the transcript feel flatter and more editorial than the current rounded-component treatment
- use a compact inline create-offer card for eligible learning prompts instead of opening a full draft panel unprompted
- reserve routing/status pills for states that change behavior, not plain conversational turns
- the current composer uses the 21st.dev EaseMize AI Prompt Box as the primary static-state reference and reproduces its prompt-box layout, spacing, action-row density, active pill expansion, subtle dividers, and send-button placement as closely as practical within Techy's colors, icons, type, and accessibility constraints

Recommended desktop arrangement:
- a restrained history rail or drawer for recent chats
- centered conversation column
- minimal brand/title above the composer in the empty state
- assistant controls integrated into the composer chrome
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
- keep the composer visually narrower and calmer than the full route width; it should feel like a centered prompt instrument, not a dashboard dock
- show provider/model controls without turning the composer into a cockpit; keep the controls compact, smaller than the prompt field, and adjacent to it
- prefer headless token-aware dropdowns for composer controls when native browser menus break readability or theme contrast
- keep current controls only in the 21st.dev-inspired prompt box: Auto/Create/Update, provider, model, selected note for Update, and send
- do not surface unsupported reference actions such as upload, voice, canvas, image preview, or stop generation until the product and API contracts support them
- let users resume prior conversations without making chat history the dominant visual element
- render note proposals inline as editable review surfaces
- when a strong existing-note match is found, surface it inline and offer further research or review without abruptly switching the user into an edit flow
- show citations during review without overwhelming the draft itself; prefer a collapsed low-noise sources disclosure over inline source dumps
- keep delete confirmation compact and deliberate
- store and present the app-owned transcript as the canonical history view; do not expose provider-specific hidden memory concepts in the UI
- favor a modern AI-chat composition with a centered entry state and composer-led control surface, translated into Techy's typography, tokens, and spacing system
- keep the initial selected mode on `Auto`; explicit create/update remain available as hard overrides, not as the default mental model
- expose that mode override through one compact selector rather than a row of toolbar-sized pills
- keep the model default sourced from the provider registry; do not introduce hardcoded visual-only model defaults in the chat page
- keep the chat shell in the route surface for this pass; do not introduce a wrapper component that re-boxes the full chat experience
- avoid persistent helper copy in `Auto` mode when the compact composer layout already communicates the interaction model

Avoid:
- making the chat UI look like a separate product
- forcing ambiguous prompts into create/update behavior without a clear signal or fallback
- turning assistant proposals into a wall of utility panels
- turning saved conversation history into a dense email-style list that competes with the current conversation
- recreating the current heavy top-of-page chat header or the `No conversation yet` explainer card

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

Current use should stay focused on assistant continuity in `/chat` and small shell/theme cues in the left rail, not expand into general page decoration.

Good uses:
- proposal panel enter/exit
- assistant message reveal
- confirmation-state transitions
- 21st.dev-style composer state transitions for active controls, limited to short icon scale/rotation and active label width/opacity changes
- subtle theme transition choreography
- a shared active-state slide between left-rail destinations

Avoid:
- perpetual looping motion
- exaggerated hover animation
- page-wide animation for minor state changes
- recreating Framer Motion as a broad abstraction layer; use GSAP selectively or CSS transitions where simpler

---

## Melt Guidance

Use Melt for behavior and accessibility primitives where the assistant flow benefits from them:
- compact Chat/Create/Update override controls
- provider/model selectors
- disclosure and confirmation UI
- compact command-like controls
- shell collapse / tucked-state disclosure where it improves accessibility and keyboard behavior

Reference-inspired chat controls should use Melt for the accessible Svelte behavior that Radix provides in the original React component. Agents implementing this should inspect Melt's installed Svelte 5 builders/components and current docs for `RadioGroup`, `Toggle`, `Tooltip`, and `Select`, then style the resulting primitives to match the 21st.dev prompt-box reference rather than adopting Melt's visual examples.

Use GSAP as the local substitute for Framer Motion when the reference relies on active-control choreography. Agents should consult GSAP guidance for scoped animations and cleanup in component lifecycles before adding animation code.

Do not let Melt define the visual language.

---

## Summary

Techy should feel like a soft, graph-centered knowledge environment with three coherent experiences:
- an immersive graph homepage
- a clean notes browsing and reading flow
- a unified assistant chat that can converse, research, draft, and confirm note changes
