# Trajectory Evaluation Standard

An eval that scores only the final answer cannot see how the agent got there. Two runs can return
the same conclusion while one found the root cause and verified it and the other wrapped a symptom
in a try/catch and guessed. The process is part of the work, so the process is part of verification.

A trajectory is one run: the OTel-GenAI spans under a single `trace_id`
(`invoke_agent` → `chat` / `execute_tool`), exported from a spans-shaped store. Evaluating a
trajectory means comparing a recorded run to a **pinned baseline** — a golden run of the same task,
identified by a stable `task_fingerprint` — and deciding, per dimension, pass or regress. This is
the first machine-gradeable signal the framework has on the agent's *behavior over time*, not just
its output.

Deterministic-first still governs. A criterion a diff can decide must never spend a judge call:

- **tool-path** — the edit distance between the candidate's `execute_tool` sequence and the
  baseline's. A run that took a different route to the answer is visible here before any taste enters.
- **verification-discipline** — every mutation span must be followed by a verifying span. "It works"
  without an observed check is the failure mode this dimension makes loud.
- **question-economy** — a paused-to-user stop that a diff can count. Whether the question was
  *discoverable* (answerable from context) is a judge dimension; that it *happened* is not.
- **fan-out and efficiency** — sub-agents dispatched and returned, token and span deltas. Reported
  as informational deltas, never gating, because "more tokens" is not by itself a regression.

What remains genuinely unavoidable for judgment — plan adherence, synthesis fidelity, finding-class
coverage, whether a verification hit the right target, whether a specific artifact was produced —
goes to the judge layer, and the judge layer is bound by the judge-bias and judge-validity standards:
order-swapped presentation, required agreement across the swap, separation between producer and
judge where feasible, and escalation when swapped verdicts disagree. A judge dimension with no
instance-supplied provider is judge-required and never blocks a run.

The cross-version guarantee is the point: rerun the same task on a new model or a changed prompt and
a dimension **regresses** when it drops below the baseline's declared threshold, or falls more than
the tolerance below the baseline's own score. The baseline owns the bar it sets. A run passes only
when it clears every gating threshold on its own and does not regress.

The exporter that produces a trajectory is **zone-pure**: it reads a spans-shaped sqlite file or a
JSON array of rows and knows nothing of any host or deploy path. An instance whose spans live
elsewhere writes a thin wrapper that fetches the rows and pipes them in — the wrapper owns the
coupling so the standard ships clean on extraction.

The executable gate is [`../../standards/trajectory-eval/`](../../standards/trajectory-eval/).

> Last reviewed: 2026-07-05
