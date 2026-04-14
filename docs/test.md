# Test Pipeline

This repo uses a small unit-test layer for pure TypeScript modules plus the existing type-check and build verification steps.

## Local Commands

```bash
npm run test
npm run test:watch
npm run check
npm run build
```

Recommended local sequence before pushing:

1. `npm run test`
2. `npm run check`
3. `npm run build`

For PWA or speech work, also verify the built app exposes the expected manifest/service-worker assets and that browser-only speech helpers degrade cleanly when APIs are unavailable.

## Current Scope

The current unit tests focus on fast, deterministic modules that do not require live provider APIs, a browser, or a database:

- `src/lib/utils/note-structure.test.ts`
  - verifies the shared assistant note-section contract
  - checks required section order, approved optional-section placement, deprecated-heading rejection, and heading normalization
- `src/lib/server/ai/prompts.test.ts`
  - verifies create/update assistant prompts both inject the same shared note-structure contract
- `src/lib/server/assistant/routing.test.ts`
  - verifies inference-first routing keeps plain learning prompts conversational
  - verifies follow-up asks like `add it to notes` or `save this to my notes` route into note creation
- `src/lib/client/speech.test.ts`
  - verifies `canSpeak` and `canListen` return false in SSR (no window) and correctly detect API presence using `vi.stubGlobal`
  - verifies `extractHtmlText` strips tags, decodes common entities, and collapses whitespace
  - verifies `extractMarkdownText` strips headings, bold/italic, links, images, wikilinks, code blocks, and list markers
  - verifies `speak` and `stopSpeaking` manage utterance lifecycle, cancel before starting new speech, trigger `onEnd` on end/error events, and no-op when the API is absent
  - browser speech APIs are mocked via `vi.stubGlobal`; no real microphone or system voices required

Remaining planned additions for the PWA and voice phase:
- route tests for optional speech transcription error states where practical
- build checks that the PWA manifest and service-worker registration compile without server-only import leaks

## Shared Contract

The assistant note-section rules live in `src/lib/utils/note-structure.ts`.

That module is the source of truth for:

- required sections
- approved optional sections
- deprecated headings
- the shared prompt guidance text
- pure note-body validation used by the assistant commit boundary

This keeps prompt-time instructions and commit-time validation aligned.

## CI Pipeline

GitHub Actions runs `.github/workflows/ci.yml` on pushes to `main` and on pull requests targeting `main`.

The CI sequence is:

1. `npm ci`
2. `npm run test`
3. `npm run build`
4. `npm run check`

Build still uses dummy private env values so the workflow catches server-only import leaks without requiring real secrets.

## Adding Tests

Prefer unit tests for pure modules first. They are faster, easier to maintain, and run cleanly in CI without app bootstrapping.

When adding tests:

- keep them close to the module under test with `*.test.ts`
- avoid live network calls and provider SDK calls
- mock or isolate runtime-heavy boundaries instead of depending on external services
- add route-level or browser-level tests only when unit coverage is not enough to protect the behavior
- for speech features, mock browser speech APIs instead of depending on device microphone, installed system voices, or live transcription providers
- for PWA features, prefer build/output verification and manifest assertions over brittle install-prompt automation
