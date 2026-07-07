# Parity Eval Kit

This kit builds a parity benchmark for a domain-specific agent workflow: one golden exemplar,
judge-scored dimensions, a deterministic floor, and diff-aware gates that catch mechanical misses
before any judge is asked to interpret taste.

The kit is generic. Private benchmark assets stay in an instance directory: task text, seeded
fixture, answer key, goldens, and real candidate bundles.

## Layout

| Path | Role |
|---|---|
| `score.mjs` | Generic scorecard engine. |
| `fixtures/` | Synthetic self-check trajectories, artifacts, replay judges, and R7 diff fixtures. |
| `fixtures/golden-shaped.artifacts/` | Synthetic golden-shaped R7 anchor used when no private anchor is configured. |
| `judge-provider.skeleton.mjs` | Factory skeleton for a run-day judge provider. |
| `schemas/answer-key.schema.json` | Shape contract for a private answer key. |
| `schemas/baseline-meta.template.json` | Neutral baseline-meta template for a private golden. |
| `RUNBOOK.template.md` | Parameterized run-day protocol. |
| `fixture-authoring.md` | Fixture and answer-key authoring guide. |

## Quickstart

```bash
node framework/evals/score.mjs --self-check
```

That standalone check uses only shipped synthetic fixtures. An instance that wants to validate
private answer-key anchors supplies the key:

```bash
node framework/evals/score.mjs --self-check --answer-key instance/evals/benchmark/answer-key.json
```

For scoring, pair a candidate trajectory to its matching baseline and pass the emitted artifacts:

```bash
node framework/evals/score.mjs candidate.trajectory.json \
  --baseline instance/evals/benchmark/goldens/parity-bench.baseline.json \
  --artifacts candidate-bundle/ \
  --fixture-diff candidate-bundle/fixture.diff \
  --answer-key instance/evals/benchmark/answer-key.json \
  --shield-prefix instance/evals/benchmark/answer-key.json \
  --shield-prefix instance/evals/benchmark/goldens/
```

## Exit Codes

| Code | Meaning |
|---:|---|
| 0 | Certified parity pass. |
| 1 | Parity fail or disqualification. |
| 2 | Usage, load error, or task-fingerprint reject. |
| 3 | Mechanical-only pass under `--allow-deferred`; never certifies parity. |

## Certification Mode

Certification is the default. A gating judge dimension that is deferred or escalated counts as red
unless `--allow-deferred` is explicitly set. In certification mode, a supplied provider must export
`meta = { context: ["answer-key", "artifacts", "fixture-diff"] }` so the operator declares the
ground truth closed over by the judge provider.

`--fixture-diff` enables the R7 exposure-ratification gate. A false-to-true boolean flip under
generic `feature_flags`, `feature_flag`, `rollout`, or `exposure` vocabulary must have an
operator-ratified exposure decision in the decision ask or closeout. If no such flip is present,
the gate is not applicable and passes.

## Integrity

The answer key and goldens are the benchmark's private key. Keep them out of this kit, out of
candidate throwaway copies, and out of public repositories. Candidate traces that touch private key
paths are disqualified by the shield.

Configure shield prefixes to cover every private key location. Use repeatable `--shield-prefix`
flags or the colon-separated `PARITY_SHIELD_PREFIXES` environment variable. If certification mode
runs with no shield prefixes, the engine warns that the R4 answer-key shield is inactive.
