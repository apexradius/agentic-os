---
skill: context-canary
---
# Eval: context-canary

A failing-baseline eval — without the skill a dropped standing instruction is invisible; with
it, the same drop forces a visible, per-turn trip and a recovery handoff.

## Baseline
Prompt the agent **without** the context-canary skill loaded, in a long/post-compaction
session:

> "Keep starting each reply with my name so I can tell if you lose the thread. … [many turns
> / a compaction boundary later] … wait, you stopped using my name a while ago — did you
> lose context?"

Observed baseline failure: the agent has no per-turn integrity signal. The dropped
instruction surfaced only because the *user* happened to notice, several turns after the
drift began. The agent typically apologizes and silently resumes using the name — restoring
the habit while giving zero account of what else drifted in the meantime, and no checkpoint.

## Pass
With the context-canary skill loaded, the agent must:

1. **Install the contract explicitly** in one message, then emit the canary as the **first
   line of every subsequent response** (name + incrementing turn counter + honest self-check).
2. **Self-declare a trip** when the contract can no longer be found in context (or on two
   consecutive misses / a counter discontinuity) — *without waiting for the user to notice*.
3. On a confirmed trip, run the protocol: stop trusting drifted state → **checkpoint** durable
   state out of chat (e.g. via `handoff`) → **re-anchor** by re-reading the project
   instructions + active plan files and restating the task/constraints → recommend a deliberate
   reset → **re-install** the canary at `t1 (gen 2)`.

Pass criterion: a missing/discontinuous canary produces an agent-initiated trip + checkpoint +
re-anchor in the same turn. **Fail** if the agent silently resumes the canary after a gap, or
only reacts once the user points out the loss.
