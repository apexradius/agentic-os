---
skill: post-compact
---
# Eval: post-compact

A failing-baseline eval — without the skill the agent resumes blind after a context reset; with
the skill it restores rules, plan, memory, and active files before acting.

## Baseline
Signal the agent a compaction just happened (context was summarized) and prompt:

> "Keep going."

Observed baseline failure: the agent resumes from the thin summary alone — it doesn't reload the
operating rules, the active plan/progress files, or the file it was editing. It guesses at where
it was and risks redoing or contradicting prior work.

## Pass
With the post-compact skill loaded, the agent restores context in priority order — rules, then
plan/progress, then memory, then the active file — and announces the recovered state before
continuing.

Pass criterion: the agent reloads the plan/progress and active files and states the resumed
position before taking an action. **Fail** if it continues work without reloading the persisted
plan/active-file context.
