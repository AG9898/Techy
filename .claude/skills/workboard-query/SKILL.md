---
name: workboard-query
description: "Use this skill when the user asks to find, inspect, pick up, or filter tasks from Techy's `docs/workboard.json`. This skill queries actionable tasks without dumping the full board and supports task selection, dependency checks, and targeted task inspection."
version: 1.0.0
---

# Workboard Query

Use this skill whenever the user wants task selection or workboard inspection.

## Core Rules

1. Treat `docs/workboard.json` `tasks[]` as canonical active work.
2. Prefer targeted `jq` queries; do not print unrelated board data.
3. Never open `docs/workboard.json` directly into context.
4. A task is startable only if:
   - `status == "todo"`
   - `blocked_by` is empty or missing
   - all `depends_on` tasks are `done`
5. Do not read archive/progress logs unless explicitly requested.

If `jq` is unavailable, use a minimal scripted fallback that returns only the requested slice, never the whole file.

## Validation

Before query operations, confirm board shape:

```bash
jq -e '.tasks and (.tasks | type == "array")' docs/workboard.json >/dev/null
```

If invalid, report and stop.

## Query Patterns

Translate the user's request into one of these patterns.

### Next startable task overall

Use when the user asks what to work on next.

```bash
jq '
  (.tasks | map({(.id): .}) | add) as $byId |
  [.tasks[] |
    select(.status == "todo") |
    select((.blocked_by // []) | length == 0) |
    select((.depends_on // []) | map($byId[.].status == "done") | all)
  ] |
  sort_by(if .priority == "high" then 0 elif .priority == "medium" then 1 else 2 end) |
  .[0] | {id, title, priority, group_id, depends_on, blocked_by}
' docs/workboard.json
```

### Exact task by ID

Use when the user names a task like `FOUND-001` or `UI-003`.

```bash
jq '.tasks[] | select(.id == "TASK-ID")' docs/workboard.json
```

### Next task in a group

Use when the user asks for the next task in a group such as `FOUND`, `GRAPH`, `NOTES`, `ASSIST`, `UI`, `AI`, `DEPLOY`, `PWA`, `SPEECH`, or `PRACTICE`.

```bash
jq '
  (.tasks | map({(.id): .}) | add) as $byId |
  [.tasks[] |
    select(.group_id == "GROUP" and .status == "todo") |
    select((.blocked_by // []) | length == 0) |
    select((.depends_on // []) | map($byId[.].status == "done") | all)
  ] |
  sort_by(if .priority == "high" then 0 elif .priority == "medium" then 1 else 2 end) |
  .[0] | {id, title, priority, group_id, depends_on, blocked_by}
' docs/workboard.json
```

### List tasks in a group, summary only

```bash
jq '
  [.tasks[] |
    select(.group_id == "GROUP") |
    {id, title, status, priority, depends_on, blocked_by}
  ]
' docs/workboard.json
```

### High-priority tasks

```bash
jq '
  [.tasks[] |
    select(.status == "todo" and (.priority == "high")) |
    {id, title, group_id, priority, depends_on, blocked_by}
  ] |
  sort_by(if .priority == "high" then 0 elif .priority == "medium" then 1 else 2 end)
' docs/workboard.json
```

### Blocked or not-startable todo tasks

Use this instead of looking for a literal `blocked` status. Techy's workboard may represent blocked work through `depends_on` and `blocked_by` while tasks remain `todo`.

```bash
jq '
  (.tasks | map({(.id): .}) | add) as $byId |
  [.tasks[] |
    select(.status == "todo") |
    {
      id,
      title,
      priority,
      blocked_by: (.blocked_by // []),
      unmet_deps: ((.depends_on // []) | map(select($byId[.].status != "done")))
    } |
    select((.blocked_by | length > 0) or (.unmet_deps | length > 0))
  ] |
  sort_by(if .priority == "high" then 0 elif .priority == "medium" then 1 else 2 end)
' docs/workboard.json
```

## When the User Wants to Start a Task

1. Fetch the exact task JSON.
2. Verify it is startable:
   - every `depends_on` entry is `done`
   - `blocked_by` is empty
3. If it is not startable, report the unmet dependencies or blockers instead of starting it.
4. If it is startable and the user wants execution, hand off to `start-task` or read only the task's `docs` and `files` entries next.
5. Update task status only when executing the task, and use a targeted `apply_patch` edit. Never rewrite the whole workboard.

## Output Discipline

- For lists, prefer compact summaries rather than full task payloads.
- Only return the full task JSON when the user asks for a specific task or when execution is about to begin.
- If no startable task exists, return the top blocked items and why.
- Keep answers task-focused. Do not dump unrelated workboard data.

## Guardrails

- Never mutate the board in this skill unless the user explicitly asks to start or edit a specific task.
- Never assume `status == "blocked"` is required to identify blocked work.
- Never start a task with unmet dependencies.
- Never start a task with a non-empty `blocked_by`.
- Never mutate any task except the one the user is acting on.
