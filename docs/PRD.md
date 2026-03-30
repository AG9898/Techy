# Product Requirements Document — Techy

## Overview

**Techy** is a personal, single-user tech knowledge repository deployed as a private web app. It stores structured notes about software, tools, languages, AI models, services, and technical concepts, visualises their relationships as an interactive graph, and is intended to support AI-assisted synthesis over the notes already in the graph.

The primary value is building and maintaining a persistent, interconnected mental model of the tech landscape — something faster to search than bookmarks, more structured than a notes app, and more personal than a wiki.

---

## Goals

1. Capture knowledge about tech topics in a structured, reusable format
2. Visualise how topics relate to each other via a D3 force-directed graph
3. Search notes quickly by title, tags, and category
4. Create new notes manually or by directing an AI to research a topic
5. Keep the app private (single-user, GitHub OAuth gate)
6. Ask for a summary of an existing topic and get note-grounded suggestions for what to add next

---

## Non-Goals

- Multi-user / collaboration
- Public sharing or publishing
- Mobile-first design (desktop-primary, responsive is a nice-to-have)
- Offline-first or PWA capabilities
- Real-time sync

---

## Users

Single user — the owner/developer of this repository. No onboarding, no registration flow.

---

## Feature Requirements

### MVP (Scaffolded ✓)

| ID | Feature | Status |
|----|---------|--------|
| F-01 | GitHub OAuth login (single account gate) | Done |
| F-02 | Create / edit / delete notes with Markdown body | Done |
| F-03 | Note frontmatter: title, slug, tags, aliases, category, status | Done |
| F-04 | `[[wikilink]]` syntax auto-creates graph edges on save | Done |
| F-05 | D3 force-directed graph — nodes = notes, edges = links | Done |
| F-06 | Click node → navigate to note detail | Done |
| F-07 | Note detail: rendered Markdown, wikilinks resolved to anchors | Done |
| F-08 | Search by title / category (`ilike`) and tags (`arrayOverlaps`) | Done |
| F-09 | AI endpoint skeleton (Claude + ChatGPT) returning 501 | Done |

### Phase 2 — AI Integration

| ID | Feature | Priority |
|----|---------|----------|
| F-10 | AI research endpoint: given a topic, return a draft note body | High |
| F-11 | AI generate-note: full note creation from a prompt, saved to DB | High |
| F-12 | UI: "Research with AI" button on New Note page | Done |
| F-13 | Provider selection: Claude vs ChatGPT per-request | Low |
| F-14 | AI-generated notes tagged with `ai_generated=true`, model, prompt | High |

### Phase 3 — Graph & Discovery Enhancements

| ID | Feature | Priority |
|----|---------|----------|
| F-15 | Graph: filter nodes by category or status | Medium |
| F-16 | Graph: colour by category (not just status) toggle | Low |
| F-17 | Graph: node size proportional to link count | Low |
| F-18 | Graph: click edge to view both connected notes | Low |
| F-19 | Orphan note detection (notes with no links) | Medium |

### Phase 4 — Content & UX

| ID | Feature | Priority |
|----|---------|----------|
| F-20 | Markdown preview pane in the note editor | Medium |
| F-21 | Import notes from `.md` files (batch) | Done |
| F-22 | Export all notes as a zip of Markdown files | Low |
| F-23 | Note history / versioning (soft delete or revision table) | Low |
| F-24 | Tag autocomplete in the create/edit form | Medium |

### Phase 5 — Assistant Over Existing Notes

| ID | Feature | Priority |
|----|---------|----------|
| F-25 | Note-grounded assistant summary: given a natural-language query like "tell me about SvelteKit", find the best matching note by title or alias, return a link to the note, and produce a concise summary grounded in the saved note | High |
| F-26 | Assistant gap suggestions: after summarising a note, suggest areas that may be missing or underdeveloped in the current note, clearly labeled as suggestions rather than confirmed omissions | Medium |
| F-27 | Next-note recommendations: after summarising or AI-generating a note, suggest exactly 3 relevant candidate topics that do not already exist as note titles or aliases | High |
| F-28 | Dedicated chat page for the assistant experience, visually aligned with the graph and notes interfaces | Medium |

See [`docs/API.md`](API.md) for the full route and endpoint reference for all implemented features.
See [`docs/STYLE-GUIDE.md`](STYLE-GUIDE.md) and [`docs/DESIGN-SPEC.md`](DESIGN-SPEC.md) for the intended UI direction.

---

## Note Schema & Categories

See [`docs/NOTES.md`](NOTES.md) for the full note schema, tag taxonomy, hub categories, template, and authoring rules.

---

## Constraints

- **Database:** Neon PostgreSQL free tier (0.5 GB storage, 191.9 compute hours/month)
- **Auth:** GitHub OAuth, restricted to `ALLOWED_GITHUB_USERNAME`
- **Deployment:** Serverless-compatible (Vercel / Cloudflare Pages)
- **Cost:** $0/month target (all free-tier services)
