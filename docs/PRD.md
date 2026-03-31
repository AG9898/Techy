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
| F-09 | `/chat` becomes the sole note-authoring surface for new notes | High |
| F-10 | Assistant supports normal conversation plus explicit create mode in one chat interface | High |
| F-11 | Assistant-generated note drafts are structured, editable, and require confirmation before save | High |
| F-12 | Assistant-driven note creation fills `title`, `body`, `tags`, `aliases`, `category`, `status`, AI metadata, and wikilinks | High |
| F-13 | Assistant-driven updates compare existing notes against live web research and only propose changes when a note appears materially incorrect, outdated, or substantially incomplete | High |
| F-14 | Assistant-driven delete remains available behind an explicit confirmation step | Medium |

### Live Research and Linking

| ID | Feature | Priority |
|----|---------|----------|
| F-15 | Note creation always performs live web research before proposing a saved note | High |
| F-16 | The assistant reuses already-known topic context within the same conversation to avoid re-researching the same topic repeatedly | Medium |
| F-17 | Web citations are shown during chat review but are not persisted to a dedicated DB schema in this phase | Medium |
| F-18 | New notes create graph links immediately from their `[[wikilinks]]` on save | High |
| F-19 | If a newly created note should be linked from existing notes, the assistant also updates those note bodies to include the new `[[wikilink]]` and re-syncs their `note_links` rows in the same save flow | High |

### UI Direction

| ID | Feature | Priority |
|----|---------|----------|
| F-20 | Replace the current multi-theme system with a tonal dark/light theme model while keeping accent options separate | High |
| F-21 | Use Melt UI selectively for assistant controls, selectors, and confirmation affordances | Medium |
| F-22 | Use GSAP selectively for assistant/draft transitions and other meaningful motion polish | Medium |
| F-23 | Use Space Mono as the authoritative typeface across the app shell and content surfaces | Medium |
| F-24 | Replace the current top navigation with a collapsible left rail that can auto-tuck on immersive pages | High |
| F-25 | Consolidate standalone search into `/notes` so browsing and search happen in one repository surface | High |

---

## Notes on Superseded Direction

- The dedicated `/notes/new` page is being retired from the product direction.
- The dedicated `/search` page is being retired in favor of integrated search within `/notes`.
- The “Research with AI” button on a standalone note-authoring form is no longer the intended primary creation flow.
- The previous three-theme model (`night`, `paper`, `mist`) is being replaced by a tonal `dark/light` theme model with accent selection preserved.

See [`docs/API.md`](API.md) for the target assistant-first route and endpoint direction.
See [`docs/STYLE-GUIDE.md`](STYLE-GUIDE.md) and [`docs/DESIGN-SPEC.md`](DESIGN-SPEC.md) for the updated UI direction.

---

## Note Schema & Categories

See [`docs/NOTES.md`](NOTES.md) for the full note schema, tag taxonomy, hub categories, template, link rules, and assistant-specific link propagation expectations.

---

## Constraints

- **Database:** Neon PostgreSQL free tier (0.5 GB storage, 191.9 compute hours/month)
- **Auth:** GitHub OAuth, restricted to `ALLOWED_GITHUB_USERNAME`
- **Deployment:** Serverless-compatible (Vercel / Cloudflare Pages)
- **Cost:** $0/month target (all free-tier services where practical)
