---
name: ralphloop
description: "Use this skill when the user explicitly asks for an autonomous delegated loop that repeatedly runs a skill or prompt, gates each cycle, and stops at an `iterations:N` or `tasks:N` threshold. This Codex version uses spawned subagents instead of `claude -p`."
version: 1.0.0
---

# Ralph Loop

This skill is for explicit delegated loop requests only.

You are the monitoring agent. Your job is orchestration and gating. Do not implement the task yourself.

## Invocation

`$ralphloop <skill-or-prompt> <threshold>`

Examples:

- `$ralphloop start-task iterations:3`
- `$ralphloop start-task tasks:2`
- `$ralphloop "audit docs links" iterations:1`

## Inputs

- `TASK`: skill name or quoted free-form prompt
- `THRESHOLD`: `iterations:N` or `tasks:N`

If either input is missing or malformed, stop and print usage.

## Setup

Track:

- `ITER = 0`
- `BASELINE_DONE` when threshold is `tasks:N`

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
- tell the worker to do at most one task/cycle and then stop

## Per-Cycle Contract

Tell the worker to end with this exact trailer as the last thing in the final message:

```text
RALPH-SUMMARY-START
STATUS: SUCCESS|FAILURE|BLOCKED
TASK_ID: <task id or n/a>
TASK_TITLE: <task title or one-line summary>
DOCS: UPDATED|N/A|MISSING (<brief detail>)
TESTS: PASS|FAIL|SKIP (<brief detail>)
FILES_CHANGED: <comma-separated paths, max 5>
COMMIT_MSG: <one-line commit message, max 72 chars>
PUSHED: YES|NO (<sha or reason>)
FAILURE_REASON: <reason or none>
RALPH-SUMMARY-END
```

Status meanings:

- `SUCCESS`: work is complete, docs are updated as required, tests passed, and any required local commit was created
- `FAILURE`: the cycle attempted work but ended with an unresolved problem
- `BLOCKED`: nothing startable was available

## Publish Policy

- Monitor policy: the monitor/orchestrator never creates commits and never pushes.
- Worker commit policy: workers create local commits when the delegated skill requires commits, for example `start-task`, and checks pass.
- Worker push policy: workers never push unless the user explicitly requested publishing for this run; when publishing is requested, push only on `SUCCESS` after docs and tests pass.

## Result Handling

Wait for the worker to finish with `wait_agent`, then parse only the `RALPH-SUMMARY` block from the worker's final message.

Do not read or reason over the full worker transcript if the summary is present.

If the summary block is missing, treat the cycle as:

- `STATUS = FAILURE`
- `FAILURE_REASON = Worker did not return a RALPH-SUMMARY block`

If the summary says `STATUS = SUCCESS` but `DOCS` is `MISSING`, or publishing was required and `PUSHED` is `NO`, treat the cycle as:

- `STATUS = FAILURE`
- `FAILURE_REASON = Worker reported success without satisfying docs/publish gates`

Close completed workers when they are no longer needed.

## Success Handling

1. Increment `ITER`.
2. If using `tasks:N`, re-check the done count:

   ```bash
   jq '[.tasks[] | select(.status == "done")] | length' docs/workboard.json
   ```

   If the done count did not increase across a supposedly successful `start-task`-style cycle, stop and treat that as a blocked loop.

3. Do not commit or push from the monitor.
4. Print a compact cycle result with the cycle number, task title, docs status, tests, and commit message.

## Failure/Blocked Handling

- `FAILURE`: halt the loop, report reason, and capture current `git status --short` for the user.
- `BLOCKED`: halt gracefully and report that no startable work was available.
- Optionally write a concise failure note to `docs/ralph-loop-failure.md` only if useful in this repo.
- Do not auto-revert the worktree with destructive git commands.

## Final Summary

Report:

- cycles completed
- tasks completed relative to baseline when using `tasks:N`
- threshold and whether it was reached
- whether the loop stopped because of `FAILURE` or `BLOCKED`

## Guardrails

- Monitor never does implementation work.
- Never use `claude -p` or any Claude-specific subprocess workflow.
- Never parse more than the worker's summary block unless the summary is missing.
- Never commit a failed cycle.
- Never auto-discard changes with destructive git commands.
- Never continue past reached threshold.
- Never treat `SUCCESS` as valid when docs/tests/publish gates fail for a publish-required run.
