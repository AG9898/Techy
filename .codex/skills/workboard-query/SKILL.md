---
name: workboard-query
description: "Use this skill when the user asks to find, inspect, pick up, or filter tasks from Techy's `docs/workboard.json`. This skill keeps Codex out of the full workboard by using targeted `jq` queries only and returns either compact summaries or a single full task record when needed."
---

# Workboard Query

Use this skill whenever the user wants task selection or workboard inspection.

## Core Rule

Never open `docs/workboard.json` directly. Query it with `jq` and only bring the matching result into context.

If `jq` is unavailable, use a minimal scripted fallback that returns only the requested slice, never the whole file.

## Query Patterns

Translate the user's request into one of these patterns.

### Exact task by ID

Use when the user names a task like `FOUND-001` or `UI-003`.

```bash
jq '.tasks[] | select(.id == "TASK-ID")' docs/workboard.json
```

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
  sort_by(if .priority == "critical" then 0 elif .priority == "high" then 1 elif .priority == "medium" then 2 else 3 end) |
  .[0]
' docs/workboard.json
```

### Next task in a group

Use when the user asks for the next task in a group such as `FOUND`, `GRAPH`, `NOTES`, `ASSIST`, `UI`, `AI`, or `DEPLOY`.

```bash
jq '
  (.tasks | map({(.id): .}) | add) as $byId |
  [.tasks[] |
    select(.group_id == "GROUP" and .status == "todo") |
    select((.blocked_by // []) | length == 0) |
    select((.depends_on // []) | map($byId[.].status == "done") | all)
  ] |
  sort_by(if .priority == "critical" then 0 elif .priority == "high" then 1 elif .priority == "medium" then 2 else 3 end) |
  .[0]
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
    select(.status == "todo" and (.priority == "critical" or .priority == "high")) |
    {id, title, group_id, priority, depends_on, blocked_by}
  ] |
  sort_by(if .priority == "critical" then 0 else 1 end)
' docs/workboard.json
```

### Blocked or not-startable tasks

Use this instead of looking for a literal `blocked` status. Techy's workboard may represent blocked work through `depends_on` and `blocked_by` while tasks remain `todo`.

```bash
jq '
  (.tasks | map({(.id): .}) | add) as $byId |
  [.tasks[] |
    select(.status == "todo") |
    select(((.blocked_by // []) | length > 0) or (((.depends_on // []) | map($byId[.].status == "done") | all) | not)) |
    {
      id,
      title,
      priority,
      blocked_by,
      unmet_deps: ((.depends_on // []) | map(select($byId[.].status != "done")))
    }
  ] |
  sort_by(if .priority == "critical" then 0 elif .priority == "high" then 1 elif .priority == "medium" then 2 else 3 end)
' docs/workboard.json
```

## When the User Wants to Start a Task

1. Fetch the exact task JSON.
2. Verify it is startable:
   - every `depends_on` entry is `done`
   - `blocked_by` is empty
3. If it is not startable, report the unmet dependencies or blockers instead of starting it.
4. If it is startable and the user wants execution, read only the task's `docs` and `files` entries next.
5. Update task status with a targeted `apply_patch` edit. Never rewrite the whole workboard.

## Output Discipline

- For lists, prefer summary objects rather than full task payloads.
- Only return the full task JSON when the user asks for a specific task or when execution is about to begin.
- Keep answers task-focused. Do not dump unrelated workboard data.

## Guardrails

- Never read the full `docs/workboard.json` into context.
- Never start a task with unmet dependencies.
- Never start a task with a non-empty `blocked_by`.
- Never mutate any task except the one the user is acting on.
