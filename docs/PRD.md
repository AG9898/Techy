# Product Requirements Document — Techy

## Overview

**Techy** is a personal, single-user tech knowledge repository deployed as a private web app. It stores structured notes about software, tools, languages, AI models, services, and technical concepts, visualises their relationships as an interactive graph, and is increasingly centered around an assistant-first workflow for researching, creating, updating, and discussing notes.

The primary value is building and maintaining a persistent, interconnected mental model of the tech landscape — something faster to search than bookmarks, more structured than a notes app, and more personal than a wiki.

---

## Goals

1. Capture knowledge about tech topics in a structured, reusable format
2. Visualise how topics relate to each other via a D3 force-directed graph
3. Browse and search notes quickly by title, tags, and category from a unified repository surface
4. Create, revise, and remove notes through a unified assistant chat flow rather than a separate new-note form
5. Keep the app private (single-user, GitHub OAuth gate)
6. Ask for a summary of an existing topic and get note-grounded suggestions for what to add next
7. Use live web research during assistant-driven note creation and note comparison so saved notes reflect current information

---

## Non-Goals

- Multi-user / collaboration
- Public sharing or publishing
- Offline-first or PWA capabilities
- Real-time sync
- Separate citation storage schema for web sources in the next assistant-first phase

---

## Users

Single user — the owner/developer of this repository. No onboarding, no registration flow.

---

## Current Base

These capabilities already define the product baseline and remain part of Techy:

| ID | Feature | Status |
|----|---------|--------|
| F-01 | GitHub OAuth login (single account gate) | Done |
| F-02 | Note CRUD and rendered Markdown note detail | Done |
| F-03 | Note schema: title, slug, tags, aliases, category, status, AI metadata | Done |
| F-04 | `[[wikilink]]` syntax syncs graph edges on save | Done |
| F-05 | D3 force-directed graph with navigation to note detail | Done |
| F-06 | Search by title, category, and tags | Done |
| F-07 | Import/export and revision history | Done |
| F-08 | Assistant summary, possible additions, and next-topic suggestions | Done |

---

## Product Direction Update — Assistant-First

The next phase of Techy consolidates assistant chat and AI note authoring into a single surface. The dedicated `/notes/new` page and the “Research with AI” button are no longer part of the intended product direction.

### Assistant-First Authoring

| ID | Feature | Priority |
|----|---------|----------|
| F-09 | `/chat` becomes the sole note-authoring surface for new notes; the dedicated `/notes/new` page is removed | High |
| F-10 | Assistant supports conversation, note creation, and note review/update in one chat interface through inferred skills with explicit overrides available when needed | High |
| F-11 | Assistant-generated note drafts are structured, editable, and require confirmation before save | High |
| F-12 | Assistant-driven note creation fills `title`, `body`, `tags`, `aliases`, `category`, `status`, AI metadata, and wikilinks | High |
| F-13 | Assistant-driven updates compare existing notes against live web research and only propose changes when a note appears materially incorrect, outdated, or substantially incomplete | High |
| F-14 | Assistant-driven delete remains available behind an explicit confirmation step | Medium |
| F-37 | Intent routing defaults to inference from the conversation, but the UI may still expose explicit create/update override controls as hard user overrides | High |
| F-38 | Existing-note detection is conservative: strong title or alias matches may route into note-review behavior, while weak matches stay conversational and ask or suggest rather than auto-targeting a note | High |
| F-39 | Pure learning prompts about an existing note topic remain conversational first; the assistant may mention the saved note and offer to research more or review it for updates without forcing an update flow | High |
| F-41 | Pure learning prompts without a strong saved-note match may surface a lightweight create-note offer, but they should not force an immediate full draft or silently switch the conversation into mutation mode | Medium |

### Live Research and Linking

| ID | Feature | Priority |
|----|---------|----------|
| F-15 | Note creation always performs live web research before proposing a saved note | High |
| F-16 | The assistant reuses already-known topic context within the same conversation to avoid re-researching the same topic repeatedly | Medium |
| F-17 | Web citations are shown during chat review but are not persisted to a dedicated DB schema in this phase | Medium |
| F-18 | New notes create graph links immediately from their `[[wikilinks]]` on save | High |
| F-19 | If a newly created note should be linked from existing notes, the assistant also updates those note bodies to include the new `[[wikilink]]` and re-syncs their `note_links` rows in the same save flow | High |

### Chat Continuity

| ID | Feature | Priority |
|----|---------|----------|
| F-26 | Chat history is persisted so past assistant conversations can be reopened from `/chat` | Medium |
| F-27 | Persisted chat history stores app-owned conversation/message records rather than provider-managed hidden conversation state | High |
| F-28 | Resuming a conversation rebuilds model context from saved messages instead of relying on provider-side memory | High |
| F-29 | Raw live-research payloads and ephemeral topic-cache state are not persisted as part of chat history | Medium |
| F-30 | Chat history storage stays lean enough for Neon free-tier usage by storing canonical transcript data, proposal snapshots, and lightweight citation records only | Medium |
| F-40 | Assistant responses may surface that a related note already exists and invite further research or review without automatically shifting the conversation into mutation mode | Medium |

Implementation note: `/chat` now loads recent saved conversation metadata for the signed-in user, while `/chat/[conversationId]` loads an owned saved transcript and uses it to rebuild the client-side assistant message payload before the next model request. Starting from `/chat` still creates a new app-owned conversation on the first assistant response.

Implementation note: the runtime should achieve this through one shared assistant identity with internal conversation, create, update, and explicit-delete skills layered by routing context rather than by exposing separate primary assistant personas.

### UI Direction

| ID | Feature | Priority |
|----|---------|----------|
| F-20 | Replace the current multi-theme system with a tonal dark/light theme model while keeping accent options separate | High |
| F-21 | Use Melt UI selectively for assistant controls, selectors, and confirmation affordances | Medium |
| F-22 | Use GSAP selectively for assistant/draft transitions and other meaningful motion polish | Medium |
| F-23 | Use Space Mono as the authoritative typeface across the app shell and content surfaces | Medium |
| F-24 | Replace the current top navigation with a collapsible left rail that can auto-tuck on immersive pages | High |
| F-25 | Consolidate search into `/notes` so browsing and search happen in one repository surface | High |
| F-31 | Add a unified graph control panel that persists local graph-view tuning for appearance, filters, and force behavior | High |

### Graph Controls

| ID | Feature | Priority |
|----|---------|----------|
| F-32 | The graph page exposes one bottom-right floating control panel instead of separate legend and filter overlays | High |
| F-33 | The graph control panel stays collapsed by default and expands only when invoked | High |
| F-34 | Graph controls persist as local browser preferences rather than account-level or database-backed settings | High |
| F-35 | The panel allows live tuning of node sizing, line thickness, text fade behavior, color/filter state, and force interaction | High |
| F-36 | The panel includes a reset action that restores a documented default graph preset | Medium |
| F-37 | The graph defaults to category-based colouring and hovering a node focuses its directly linked same-category neighborhood while fading unrelated graph elements | Medium |

---

## Notes on Superseded Direction

- The dedicated `/notes/new` page has been removed from the app; authoring happens through `/chat`.
- Browsing and search now live in `/notes`.
- The “Research with AI” button on a standalone note-authoring form is no longer the intended primary creation flow.
- The previous three-theme model (`night`, `paper`, `mist`) is being replaced by a tonal `dark/light` theme model with accent selection preserved.

See [`docs/API.md`](API.md) for the target assistant-first route and endpoint direction.
See [`docs/STYLE-GUIDE.md`](STYLE-GUIDE.md) and [`docs/DESIGN-SPEC.md`](DESIGN-SPEC.md) for the updated UI direction.

---

## Note Schema & Categories

See [`docs/NOTES.md`](NOTES.md) for the full note schema, canonical category taxonomy, tag reuse policy, hub categories, template, link rules, and assistant-specific link propagation expectations. Assistant-created drafts are expected to use only canonical category labels, to prefer already-established tags when they fit, and to follow the standardized note section skeleton with controlled optional sections.

---

## Constraints

- **Database:** Neon PostgreSQL free tier (0.5 GB storage, 191.9 compute hours/month)
- **Auth:** GitHub OAuth, restricted to `ALLOWED_GITHUB_USERNAME`
- **Deployment:** Serverless-compatible (Vercel / Cloudflare Pages)
- **Cost:** $0/month target (all free-tier services where practical)
- **Chat history storage:** Persist only lean transcript data in DB; avoid storing provider-side context state or full raw research payloads
