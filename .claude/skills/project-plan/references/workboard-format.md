# Workboard Task Format

When breaking accepted documentation direction into implementation work, target the existing `docs/workboard.json` task shape in this repo.

## Required Fields

Each task should include the fields used by nearby Techy tasks:

- `id`
- `title`
- `summary`
- `description`
- `status`
- `priority`
- `group_id`
- `type`
- `estimate`
- `depends_on`
- `blocked_by`
- `acceptance_criteria`
- `docs`
- `files`
- `commands`
- `notes`

## Formatting Guidance

- Use the current Techy ID style, such as `FOUND-001`, `UI-003`, `NOTES-011`, `AI-010`, or another prefix that matches the subsystem.
- Keep `group_id` aligned to existing Techy groups such as `FOUND`, `GRAPH`, `NOTES`, `ASSIST`, `UI`, `AI`, `DEPLOY`, `PWA`, `SPEECH`, or `PRACTICE`.
- Default new planned tasks to `status: "todo"` unless the user asks for another state. Completed tasks use `done`.
- Use allowed priorities from the current board, usually `high`, `medium`, or `low`.
- Keep `type` aligned to the task intent, such as `bug`, `feature`, `implementation`, `ops`, or `scaffolding`.
- Use `estimate` as a rough relative implementation-effort signal; current board values follow `XS`, `S`, `M`, and `L`.
- Write `title` as a concise action-oriented summary.
- Write `summary` as a compact one-sentence overview if nearby tasks use it.
- Write `description` as one implementation-ready paragraph with clear boundaries.
- Make `acceptance_criteria` a short list of observable outcomes.
- Use `depends_on` for prerequisite task IDs.
- Use `blocked_by` for external blockers or unresolved decisions.
- Keep `docs` limited to canonical docs that must stay synchronized.
- Keep `files` limited to likely primary implementation paths.
- Keep `commands` to the minimum verification checklist for the task.
- Use `notes` only for durable implementation hints, not active execution logs.

## Decomposition Rules

- Split tasks when work crosses distinct surfaces such as schema, server API, graph UI, note authoring, PWA/speech, or docs.
- Keep each task focused on one behavioral outcome.
- Create subtasks only when they reduce ambiguity or enable independent execution.
- Prefer explicit dependency edges over large umbrella tasks.
- Avoid bundling unrelated docs and code changes into one task unless unavoidable.
