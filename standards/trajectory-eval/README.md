# trajectory-eval — multi-turn trajectory evaluation

Skill evals (`eval-harness/`) score a **single answer**. This standard scores a **whole run**: the
sequence of steps an agent took to get there. It reads one recorded trajectory (all the spans under
one `trace_id`, exported from a spans-shaped store) and compares it to a **pinned baseline** — a
golden run of the same task — to decide, per dimension, pass / regress.

It is the first machine-gradeable signal on the agent's *process*, not just its output. The same
recorded-run shape is what the trace consumer renders and what a cross-version parity check reruns.

## What it measures

**Deterministic floor** — decided by a diff, never a model (deterministic-first is law):

| Dimension | Signal | Bar (baseline-set) |
|---|---|---|
| tool-path | edit distance of the `execute_tool` sequence vs the baseline path | similarity ≥ `tool_path` |
| verification-discipline | share of mutation spans (`Write`/`Edit`/…) followed by a verify span (`Read`/`Bash`/…) | ≥ `verification_discipline` |
| question-economy | count of operator-ask spans (`execute_tool` calls named in the baseline's `annotations.tool_classes.operator_ask`) | ≤ `question_economy_max`, when a vocabulary is declared |
| fan-out / efficiency | sub-agents dispatched + returned; token/span deltas | informational, never gating |

Question-economy counts **operator asks** — the tool calls by which a run pauses to the user — not
`end_turn` turn boundaries (which, on a multi-agent trace, are just message boundaries, not asks).
An ask is identified by its own span's `tool_name`, so a candidate cannot lower its count without
actually not-asking. The ask vocabulary is instance data on the baseline (`annotations.tool_classes.
operator_ask`); `plan_approval` names plan-approval tools that pause to the user but are a separate
class that never spends the ask budget (reported informationally). Two honest bounds: (1) a baseline
that declares **no** `operator_ask` makes question-economy **ask-vocabulary-required** — reported,
never a vacuous pass, never reverted to a turn-boundary count; (2) the baseline's vocabulary must
cover the **candidate runtime's** ask tools — scoring a candidate from a different runtime requires
extending the baseline vocabulary first, or an uncovered ask tool silently undercounts.

**Judge layer** — reached only for what a diff cannot settle (plan adherence, synthesis fidelity,
finding-class coverage, whether a stop was truly undiscoverable, whether verification hit the right
target, specific-artifact presence). Governed by the sibling `judge-gate.json` / `judge-replay.json`
/ `judge-validity-gold.json`: every judged dimension runs the baseline and candidate in **swapped
order** and the verdict counts only when both presentations agree; disagreement escalates. With no
instance-supplied provider, judge dimensions report as judge-required and never block.

A run **passes** only when it clears every gating threshold on its own AND does not regress against
the baseline's own scores (beyond `regression_tolerance`).

A score dimension (tool-path, verification-discipline) whose baseline sets its threshold to **0** is
**fully ungated**: reported informationally and excluded from **both** the floor and the regression
check — never a floor-off-but-regression-on half-gate. (Since the baseline scores 1.0 against itself,
a "0 bar but regression still on" configuration would fail every real candidate on regression while
claiming to be ungated — so 0 turns the whole dimension off.) `question_economy_max` is an absolute
cap, not a score threshold, so **0 there means zero asks allowed** — the strictest gate, not ungated.

## Files

- `lib/trajectory.mjs` — load, structural-validate, and extract signals from a trajectory (pure).
- `lib/score-deterministic.mjs` — the deterministic floor: edit distance, verification, operator-asks, fan-out.
- `lib/regression.mjs` — compare candidate vs baseline → per-dimension pass/regress verdicts.
- `lib/score-judge.mjs` — the judge seam: order-swap routing through an injected provider (no provider → judge-required).
- `lib/export.mjs` — **zone-pure** exporter: spans-shaped rows (local sqlite file or JSON on stdin) → a trajectory doc. Knows no host or path.
- `run.mjs` — the CLI: score a candidate against a pinned baseline, print the scoreboard, write an optional regression report, exit non-zero on floor-fail or regression.
- `trajectory.schema.json` — the artifact contract (draft-07).
- `fixtures/` — `mock-baseline` (golden), `mock-pass` (clears the floor cross-version), `mock-regress` (fails all three gating dimensions).
- `validate.mjs` — the selftest (zero npm, RED/GREEN over the fixtures).

## Use

```sh
# 1. export a candidate run and the baseline as trajectory docs (any spans-shaped sqlite):
node lib/export.mjs --sqlite /path/os.db --trace <trace_id> --fingerprint task:fix-auth > candidate.json
# 2. score it against a pinned baseline:
node run.mjs candidate.json --baseline golden.json --report ./reports
# exit 0 = pass · 1 = regression / floor-fail · 2 = usage / load error
```

The exporter takes a sqlite path or JSON on stdin — it ships clean to any spans-shaped store. An
instance whose spans live on a remote box writes a thin wrapper that fetches the rows and pipes them
in; that wrapper owns the coupling, this standard stays extractable.

## Verify

```sh
node validate.mjs                                   # this standard's selftest
node ../../primitives/_lib/validate.mjs --all       # the whole harness, this gate included
```

Law: [`../../doctrine/standards/trajectory-eval.md`](../../doctrine/standards/trajectory-eval.md).
