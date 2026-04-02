---
name: start-task
description: "Use this skill when the user wants to start working, pick up the next task, continue the current backlog, or begin a fresh Techy session. This skill runs one full task cycle in Codex: select the next startable workboard task without loading the full workboard, read the task's required context, implement the change, verify it, update docs, mark it done, and summarize the result."
---

# Start Task

Use this skill to execute exactly one Techy workboard task from start to finish.

This is a Codex skill, not a Claude CLI prompt. Follow Codex repo rules, tool constraints, and user-update requirements while you work.

## Workflow

1. Read `CLAUDE.md` first.
2. Do not open `docs/workboard.json` directly. Use targeted `jq` queries only.
3. Choose one startable task:

   Query the highest-priority todo task:

   ```bash
   jq '
     [.tasks[] | select(.status == "todo")]
     | sort_by(if .priority == "critical" then 0 elif .priority == "high" then 1 elif .priority == "medium" then 2 else 3 end)
     | .[0] | {id, title, priority, group_id, depends_on, blocked_by}
   ' docs/workboard.json
   ```

   Query the highest-priority startable todo task:

   ```bash
   jq '
     (.tasks | map({(.id): .}) | add) as $byId |
     [.tasks[] |
       select(.status == "todo") |
       select((.blocked_by // []) | length == 0) |
       select((.depends_on // []) | map($byId[.].status == "done") | all)
     ] |
     sort_by(if .priority == "critical" then 0 elif .priority == "high" then 1 elif .priority == "medium" then 2 else 3 end) |
     .[0] | {id, title, priority, group_id, depends_on, blocked_by}
   ' docs/workboard.json
   ```

4. If the best overall task is blocked but a different task is startable, tell the user which blocked task would have been next and which task you are taking instead.
5. If no startable todo task exists, report the top blocked items and stop:

   ```bash
   jq '
     (.tasks | map({(.id): .}) | add) as $byId |
     [.tasks[] |
       select(.status == "todo") |
       {
         id,
         title,
         priority,
         blocked_by,
         unmet_deps: ((.depends_on // []) | map(select($byId[.].status != "done")))
       }
     ] |
     sort_by(if .priority == "critical" then 0 elif .priority == "high" then 1 elif .priority == "medium" then 2 else 3 end) |
     .[0:5]
   ' docs/workboard.json
   ```

6. Load only the chosen task record:

   ```bash
   jq '.tasks[] | select(.id == "TASK-ID")' docs/workboard.json
   ```

7. Mark that task `in_progress` with a targeted edit. Use `apply_patch` against the specific task block only; never rewrite the full workboard.
8. Read every path in the task's `docs` array and every existing path in its `files` array before editing. Keep context tight. Do not speculatively read unrelated files.
9. Implement exactly what `description` and `acceptance_criteria` require.

## Techy Rules

- Respect `CLAUDE.md` as the repo dispatcher.
- Use SvelteKit 5 rune-mode patterns and TypeScript strict.
- Keep database access in server files, never client `.svelte` files.
- Use `$derived()` for values derived from `$props()`.
- Never nest delete forms inside other forms.
- If you add a route, run `npm run prepare` before final verification.
- For UI tasks, read and follow `docs/STYLE-GUIDE.md`, `docs/DESIGN-SPEC.md`, and any relevant `references/UI` material named by the task or clearly implied by the surface.

## Verification

1. Run each command listed in the task's `commands` array, if any.
2. Run any extra task-specific validation needed to prove the acceptance criteria.
3. Run `npm run check` before marking the task done.
4. If a command fails, fix the problem and rerun the failed validation. Do not declare completion with a failing check.

## Documentation Concurrency

Before finishing, update documentation in the same task cycle whenever the implementation changed repo truth.

- Revisit every doc listed in the task's `docs` array.
- Also update any other doc named in `CLAUDE.md` that your change affected, especially `docs/ARCHITECTURE.md`, `docs/schema.md`, `docs/API.md`, `docs/NOTES.md`, `docs/DESIGN-SPEC.md`, `docs/STYLE-GUIDE.md`, `docs/DECISIONS.md`, or `docs/PRD.md`.
- Do not skip a doc just because the feature name already appears there. Add the implementation detail that is now true.

## Completion

1. Mark the task `done` with another targeted `apply_patch` edit to the same task block.
2. Summarize:
   - task id and title
   - concrete changes made
   - validation run and pass/fail state
   - docs updated
   - the next few startable tasks

Use this query for the next few startable tasks:

```bash
jq '
  (.tasks | map({(.id): .}) | add) as $byId |
  [.tasks[] |
    select(.status == "todo") |
    select((.blocked_by // []) | length == 0) |
    select((.depends_on // []) | map($byId[.].status == "done") | all)
  ] |
  sort_by(if .priority == "critical" then 0 elif .priority == "high" then 1 elif .priority == "medium" then 2 else 3 end) |
  .[0:3] | map({id, title, priority, group_id})
' docs/workboard.json
```

## Guardrails

- One task per run.
- Never read the full workboard into context.
- Never bulk-rewrite `docs/workboard.json`.
- If you hit a blocker mid-task and cannot resolve it safely, revert that task's status back to `todo`, explain the blocker clearly, and stop cleanly.
