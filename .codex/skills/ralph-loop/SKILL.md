---
name: ralphloop
description: "Use this skill when the user explicitly asks for an autonomous delegated loop that repeatedly runs a skill or prompt, gates each cycle, commits successful results, and stops at an `iterations:N` or `tasks:N` threshold. This Codex version uses spawned subagents instead of `claude -p`."
---

# Ralph Loop

You are the monitoring agent. Your job is orchestration and gating. Do not implement the task yourself.

Use this skill only when the user explicitly asks for delegated looping or sub-agent execution.

## Inputs

Parse two inputs from the user's invocation:

- `TASK`: either a skill name such as `start-task` or a quoted free-form prompt
- `THRESHOLD`: either `iterations:N` or `tasks:N`

If either input is missing or malformed, stop and print:

```text
ERROR: Usage is /ralphloop <skill-or-prompt> <threshold>
Examples:
  /ralphloop start-task iterations:3
  /ralphloop start-task tasks:2
  /ralphloop "audit the repo for dead code" iterations:1
```

## Setup

Track:

- `ITER = 0`
- `BASELINE_DONE` when using `tasks:N`

If `THRESHOLD` is `tasks:N`, capture the baseline:

```bash
jq '[.tasks[] | select(.status == "done")] | length' docs/workboard.json
```

If `TASK` looks like a skill name, confirm the skill exists at one of:

- `.codex/skills/<TASK>/SKILL.md`
- `$HOME/.codex/skills/<TASK>/SKILL.md`

If it does not exist, stop with a clear error.

## Cycle

Before each cycle:

- For `iterations:N`, stop when `ITER >= N`
- For `tasks:N`, re-check the done count and stop when `(current_done - BASELINE_DONE) >= N`

If the threshold is reached, print the final summary and stop.

## Worker Launch

Spawn one fresh subagent per cycle. Keep it isolated:

- use `spawn_agent`
- prefer `agent_type: "worker"`
- prefer `fork_context: false`
- tell the worker it is not alone in the repo and must not revert others' edits
- tell the worker to update any required docs before considering the task complete
- tell the worker to run the required validation for the task
- tell the worker to make commit and push the last step only after docs are updated and tests pass
- tell the worker to do at most one task/cycle and then stop

### Worker prompt when `TASK` is a skill name

Tell the worker:

1. Use the named skill in this repo.
2. Follow the skill fully.
3. Update any required docs before considering the task complete.
4. Run the required tests or checks for the task.
5. Only if docs are updated as required and tests pass, stage only the files for that task, commit with an intentional message, and push `HEAD` to `origin`.
6. If docs are missing, tests fail, or the task is blocked, do not commit or push.
7. End with this exact trailer as the last thing in the final message:

```text
RALPH-SUMMARY-START
STATUS: SUCCESS|FAILURE|BLOCKED
TASK_ID: <task id or n/a>
TASK_TITLE: <task title or one-line summary>
DOCS: UPDATED|N/A|MISSING (<brief detail>)
TESTS: PASS|FAIL|SKIP (<brief detail>)
FILES_CHANGED: <comma-separated paths, max 5>
COMMIT_MSG: <one-line commit message, max 72 chars>
PUSHED: YES|NO (<commit sha or reason>)
FAILURE_REASON: <reason or none>
RALPH-SUMMARY-END
```

Status meanings:

- `SUCCESS`: work is complete, docs are updated as required, tests passed, and the commit was pushed
- `FAILURE`: the cycle attempted work but ended with an unresolved problem
- `BLOCKED`: nothing startable was available

### Worker prompt when `TASK` is a free-form prompt

Pass the prompt directly with the same restrictions and the same required `RALPH-SUMMARY` trailer.

## Result Handling

Wait for the worker to finish with `wait_agent`, then parse only the `RALPH-SUMMARY` block from the worker's final message.

Do not read or reason over the full worker transcript if the summary is present.

If the summary block is missing, treat the cycle as:

- `STATUS = FAILURE`
- `FAILURE_REASON = Worker did not return a RALPH-SUMMARY block`

If the summary says `STATUS = SUCCESS` but `DOCS` is `MISSING` or `PUSHED` is `NO`, treat the cycle as:

- `STATUS = FAILURE`
- `FAILURE_REASON = Worker reported success without updated docs or a pushed commit`

Close completed workers when they are no longer needed.

## SUCCESS Branch

1. Increment `ITER`.
2. If using `tasks:N`, re-check the done count:

   ```bash
   jq '[.tasks[] | select(.status == "done")] | length' docs/workboard.json
   ```

   If the done count did not increase across a supposedly successful `start-task`-style cycle, stop and treat that as a blocked loop.

3. Do not commit or push from the monitor. The worker must already have done that before reporting `SUCCESS`.
4. Print a compact cycle result with the cycle number, task title, docs status, tests, and commit message.

## FAILURE Branch

1. Do not commit or push.
2. Do not auto-revert the worktree with destructive git commands.
3. Capture the current `git status --short` output for the user.
4. Optionally write a concise failure report to `docs/ralph-loop-failure.md` if that file is useful in the repo context.
5. Halt the loop.

## BLOCKED Branch

Print that no startable work was available and stop gracefully.

## Final Summary

Report:

- cycles completed
- tasks completed relative to baseline when using `tasks:N`
- threshold and whether it was reached
- whether the loop stopped because of `FAILURE` or `BLOCKED`

## Guardrails

- You are the monitor, not the implementer.
- Never use `claude -p` or any Claude-specific subprocess workflow.
- Never parse more than the worker's summary block unless the summary is missing.
- Never commit a failed cycle.
- Never discard changes automatically with `git checkout -- .`, `git clean`, or similar destructive commands.
- Never run extra cycles after the threshold is met.
