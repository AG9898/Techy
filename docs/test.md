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

## Current Scope

The current unit tests focus on fast, deterministic modules that do not require live provider APIs, a browser, or a database:

- `src/lib/utils/note-structure.test.ts`
  - verifies the shared assistant note-section contract
  - checks required section order, approved optional-section placement, deprecated-heading rejection, and heading normalization
- `src/lib/server/ai/prompts.test.ts`
  - verifies create/update assistant prompts both inject the same shared note-structure contract

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
