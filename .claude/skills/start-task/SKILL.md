---
name: start-task
description: "Use this skill when the user wants to start working, pick up the next task, continue the current backlog, or begin a fresh Techy session. This skill executes one workboard task end-to-end with strict dependency checks, targeted board updates, verification, documentation concurrency, and a local commit."
version: 1.0.0
---

# Start Task

Use this skill to execute exactly one Techy workboard task from start to finish.

Follow this repo's agent rules, available tool constraints, and user-update requirements while you work.

## Workflow

1. Read `CLAUDE.md` first.
2. Do not open `docs/workboard.json` directly. Use targeted `jq` queries only.
3. Choose one startable task using the same startability rules as `workboard-query`.
4. If the best overall task is blocked but a different task is startable, tell the user which blocked task would have been next and which task you are taking instead.
5. If no startable todo task exists, report the top blocked items and stop.
6. Load only the chosen task record.
7. Do not introduce a new task status. Techy's current statuses are `todo` and `done`; only use another status if the repo explicitly documents it.
8. Read every path in the task's `docs` array and every existing path in its `files` array before editing. Keep context tight. Do not speculatively read unrelated files.
9. Implement only what `description` and `acceptance_criteria` require.
10. Run task `commands[]` as preferred verification.
11. Add the minimum extra validation needed for changed surfaces if commands are absent or incomplete.
12. Update authoritative docs affected by behavior changes.
13. Mark the task `done` only after verification passes.
14. Create one local git commit for the completed task after verification passes and the board is updated.
15. Summarize: task, commit, files changed, validations, docs updated, and next startable tasks.

## Startability Queries

Query the highest-priority todo task:

```bash
jq '
  [.tasks[] | select(.status == "todo")]
  | sort_by(if .priority == "high" then 0 elif .priority == "medium" then 1 else 2 end)
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
  sort_by(if .priority == "high" then 0 elif .priority == "medium" then 1 else 2 end) |
  .[0] | {id, title, priority, group_id, depends_on, blocked_by}
' docs/workboard.json
```

If no startable todo task exists, report the top blocked items:

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
  sort_by(if .priority == "high" then 0 elif .priority == "medium" then 1 else 2 end) |
  .[0:5]
' docs/workboard.json
```

Load only the chosen task record:

```bash
jq '.tasks[] | select(.id == "TASK-ID")' docs/workboard.json
```

## Techy Rules

- Respect `CLAUDE.md` as the repo dispatcher.
- Use SvelteKit 5 rune-mode patterns and TypeScript strict.
- Keep database access in server files, never client `.svelte` files.
- Use `$derived()` for values derived from `$props()`.
- Never nest delete forms inside other forms.
- If you add a route, run `npm run prepare` before final verification.
- For UI tasks, read and follow `docs/STYLE-GUIDE.md`, `docs/DESIGN-SPEC.md`, and any relevant `references/UI` material named by the task or clearly implied by the surface.

## Targeted Board Edit Rules

- Never rewrite the full `docs/workboard.json`.
- Never mutate tasks other than the selected task.
- Use precise patches around the selected task block only.
- If blocked mid-task and unresolved, leave or restore the selected task as `todo` and stop cleanly.

## Verification Rules

- Run every command in task `commands[]` unless impossible in the current environment; if skipped, state why.
- Run any extra task-specific validation needed to prove the acceptance criteria.
- Run `npm run check` before marking the task done.
- If a command fails, fix the problem and rerun the failed validation. Do not claim completion with failing checks.

## Documentation Concurrency

Before finishing, update documentation in the same task cycle whenever the implementation changed repo truth.

- Revisit every doc listed in the task's `docs` array.
- Also update any other doc named in `CLAUDE.md` that your change affected, especially `docs/ARCHITECTURE.md`, `docs/schema.md`, `docs/API.md`, `docs/NOTES.md`, `docs/PWA-SPEECH.md`, `docs/DESIGN-SPEC.md`, `docs/STYLE-GUIDE.md`, `docs/DECISIONS.md`, `docs/PRD.md`, or `docs/test.md`.
- Do not skip a doc just because the feature name already appears there. Add the implementation detail that is now true.
- Do not append active execution notes to archive-only logs.

## Completion

1. Mark the task `done` with another targeted `apply_patch` edit to the same task block.
2. Create one local git commit for the completed task after verification passes and `docs/workboard.json` is updated.
3. Include only the selected task's related code, docs, tests, and targeted board status changes.
4. Do not push the branch or publish the commit.
5. Summarize:
   - task id and title
   - commit hash and message
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
  sort_by(if .priority == "high" then 0 elif .priority == "medium" then 1 else 2 end) |
  .[0:3] | map({id, title, priority, group_id})
' docs/workboard.json
```

## Guardrails

- One task per run.
- One commit per task cycle. Create exactly one commit after verification passes. Do not split the task across multiple commits.
- Do not bypass dependency checks.
- Never read the full workboard into context.
- Never bulk-rewrite `docs/workboard.json`.
- Do not import board fields, groups, or docs from other repo variants.
- Do not mark `done` before checks pass.
- Do not push; stop after creating the local commit.
- Never add Claude or any AI model as a co-author or contributor in commit messages (no `Co-Authored-By: Claude` or similar trailers).
