# PWA And Speech Feature Plan

This document owns the cross-cutting plan for making Techy an installable private PWA and adding speech input/output. Keep durable product requirements in `docs/PRD.md`, endpoint contracts in `docs/API.md`, architectural boundaries in `docs/ARCHITECTURE.md`, and UI rules in `docs/DESIGN-SPEC.md` / `docs/STYLE-GUIDE.md`.

## Summary

Techy should be installable on a phone as a private, authenticated, online-first PWA. It is still the same hosted SvelteKit app behind GitHub OAuth; no native wrapper, app-store distribution, offline note cache, offline edits, or offline chat queue is in scope for v1.

Speech is an optional layer over existing text workflows:
- chat dictation transcribes speech into the existing composer before sending
- assistant replies can be read aloud on demand
- note detail pages can read the note body aloud
- raw microphone audio and generated speech audio are not persisted

## PWA Scope

Use `@vite-pwa/sveltekit` for the first implementation unless implementation discovery finds a direct incompatibility with the current SvelteKit/Vite versions.

The PWA implementation should include:
- manifest metadata for name, short name, start URL, display mode, theme/background colors, and icons
- generated icon assets in `static/`
- service-worker coverage for generated build assets and static app-shell assets
- no caching of authenticated note data, chat transcripts, assistant responses, live-research payloads, OAuth callbacks, or provider API responses

Expected behavior:
- The deployed HTTPS app can be installed from supported mobile browsers.
- Installed launch opens the authenticated app route and still requires a valid session.
- Network access remains required for useful authenticated behavior.
- Update handling stays low-noise and private-app appropriate; avoid promotional install banners.

## Speech Scope

Browser-first behavior is the default because it keeps v1 cheap and simple.

Text-to-speech:
- Use browser `SpeechSynthesis` for note read-aloud and assistant reply readback.
- Readback controls must expose play/stop state.
- Only one readback should be active at a time.
- Unsupported browsers should hide or disable readback controls with clear feedback.

Speech-to-text:
- Use browser speech recognition where available.
- Dictation writes final transcript text into the existing chat composer.
- Dictation must not auto-send; the user can review/edit before sending.
- Voice-composed turns use the existing `/api/assistant/respond` path, preserving provider/model selection, routing, proposals, citations, and saved chat history.

Server fallback:
- `POST /api/speech/transcribe` is optional and authenticated.
- The endpoint accepts a short audio upload and returns `{ transcript: string }`.
- If no provider is configured, return `503` and keep manual text chat usable.
- Provider choice stays behind environment configuration so the client contract remains stable.
- Candidate providers with free credits or low personal-use pricing should be rechecked before implementation; do not make the product depend on a free tier staying free.

## UX Contracts

Chat composer:
- Voice input is a compact secondary control, not a separate assistant mode.
- It must coexist with `Auto | Create | Update`, provider/model settings, update-note selection, and send.
- Recording/listening state should be visible through label, `aria-pressed`, and focused/active styling.
- Permission-denied, unsupported, and no-provider states should be clear without blocking manual text input.

Assistant replies:
- Readback controls sit near assistant messages.
- Read assistant prose only; do not read proposal forms, confirmation controls, create-offer cards, or citation disclosures by default.
- Do not auto-play assistant replies.

Note detail:
- Add a compact `Read note` / `Stop` control near `History` and `Edit`.
- Read rendered note body text only.
- Exclude navigation, metadata, edit/history controls, and relation lists.
- Keep note detail as a reading surface, not a media-player mode.

## Privacy, Cost, And Compatibility

The v1 cost target remains close to zero:
- Browser TTS has no provider cost.
- Browser STT avoids a new account/key but support varies by browser and may depend on browser/vendor services.
- Server STT fallback may add provider cost, so it stays optional and env-gated.

Privacy/storage rules:
- Do not persist microphone recordings.
- Do not persist generated speech audio.
- Do not persist provider transcription metadata unless a later feature explicitly needs it.
- Do not add database schema for speech in v1.

Compatibility rules:
- All speech code must be SSR-safe and capability-detected.
- Tests should mock browser speech APIs.
- PWA checks should focus on manifest/build/service-worker output rather than brittle install-prompt automation.

## Workboard Sequence

Planned implementation slices:
- `PWA-001`: configure install metadata and app-shell service-worker caching
- `PWA-002`: add minimal PWA registration/update polish
- `SPEECH-001`: add shared browser speech helpers and tests
- `SPEECH-002`: add note detail read-aloud
- `SPEECH-003`: add assistant message readback
- `SPEECH-004`: add browser dictation to the chat composer
- `SPEECH-005`: add optional transcription endpoint shell
- `SPEECH-006`: wire the first provider adapter after provider/key selection
- `SPEECH-007`: connect chat dictation to the optional server fallback
