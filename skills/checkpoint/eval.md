---
skill: checkpoint
---
# Eval: checkpoint

A failing-baseline eval — without the skill the agent ends a session with state in its head; with
the skill it writes a resumable checkpoint to disk.

## Baseline
Prompt the agent **without** the checkpoint skill loaded, mid-task:

> "I have to stop here — save where we are."

Observed baseline failure: the agent writes a one-line chat summary ("we were working on the
auth refactor") and nothing to disk. After a context reset, the git state, the decisions made,
and the next action are all gone — the next session restarts cold.

## Pass
With the checkpoint skill loaded, the agent writes a checkpoint file capturing git state, key
decisions, remaining work, and an explicit Very Next Action.

Pass criterion: a durable checkpoint exists on disk with git state + decisions + a concrete VNA,
such that a cold session could resume from it. **Fail** if the state lives only in the chat or
omits the next action.
