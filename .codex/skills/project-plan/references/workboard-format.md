# Workboard Task Format

When breaking accepted documentation direction into implementation work, target the existing `docs/workboard.json` entry shape.

## Required Fields

Each task should include:

- `id`
- `status`
- `type`
- `description`
- `acceptance_criteria`
- `depends_on`
- `blocked_by`
- `files`
- `docs`

## Formatting Guidance

- Use the current repo naming style for IDs, such as `UI-016`, `NOTES-011`, `AI-010`, or another prefix that matches the subsystem.
- Default new tasks to `status: "todo"` unless the user asks for a different workflow state.
- Keep `type` aligned to the task intent, such as `feature`, `implementation`, `ops`, or `scaffolding`.
- Write `description` as one implementation-ready paragraph that states the intended behavior and boundaries.
- Make `acceptance_criteria` a short list of observable outcomes.
- Use `depends_on` for prerequisite tasks already identified.
- Use `blocked_by` when an external or earlier decision prevents work from starting.
- Keep `files` limited to the primary paths expected to change.
- Keep `docs` limited to the docs that must stay in sync with the implementation.

## Decomposition Rules

- Split tasks when the work crosses subsystems with different ownership, such as schema plus API plus UI.
- Keep related doc-only follow-up bundled unless separating it prevents parallel work.
- Create subtasks only when a parent item would otherwise be too broad for one agent pass.
- Prefer dependency edges over large umbrella tasks with vague scope.
