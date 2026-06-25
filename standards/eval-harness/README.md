# eval-harness

Runs each skill's [`eval.md`](../../primitives/skills/spec.md) against an instance-supplied model and
emits a pass/fail **scoreboard** — the executable counterpart to the
[observability standard](../../doctrine/standards/observability.md)'s claim that "the framework makes
agents better" is only honest if it is *measured*. Results land in the
[run-record sink](../../runtime/observability/) so a skill's pass-rate over time becomes queryable.

Like [`design-gate`](../design-gate/) and [`tool-gate`](../tool-gate/), it is a single tree of plain
`.mjs` with **zero npm dependencies** — `validate.mjs --all` runs its selftest with bare `node` on a
fresh clone, no install, no network.

## Two grading paths

An `eval.md` describes a skill's win condition. Some of that is machine-checkable; most is judgment.
The harness handles both, and is explicit about which it used:

- **Deterministic** — an `eval.md` that carries explicit assertions is graded with no model judgment
  beyond the model's own output. CI-gradeable; runs under `--all`.
- **Judge-required** — an `eval.md` written purely for human/LLM judgment (no assertions) is reported
  `gradeable: false` and handed to the instance's judge endpoint, or counted as covered-but-not-CI-graded.

### The `expect` block (baseline)

A fenced `expect` block inside the Pass section makes a baseline eval deterministic:

````markdown
## Pass
With the skill, the response names a root cause and greps for the same pattern elsewhere.

```expect
contains: ROOT CAUSE
regex: ^Step \d+
not_contains: TODO
```
````

`contains` / `regex` / `not_contains` are repeatable; the eval passes iff every `contains`/`regex`
matches the model output and no `not_contains` does. An eval with no `expect` block is judge-required.

### Rubric predicates

A rubric row is deterministically graded when its *Pass condition* cell carries a predicate
(`contains:"…"`, `not_contains:"…"`, or `regex:/…/`); `★` marks an auto-fail criterion. The eval passes
iff no auto-fail row is missed and the summed weight of matched rows meets the `## Pass threshold` number.
A rubric with any predicate-less row is judge-required.

## Run it (instance)

```bash
# endpoint.mjs: `export default async ({skill, evalType, raw}) => <model output string>`
EVAL_HARNESS_ENDPOINT=/abs/path/to/endpoint.mjs \
RUNRECORD_LOG=/abs/path/runs.ndjson \
node framework/standards/eval-harness/run.mjs /abs/path/to/skills
```

The framework supplies the parser, the graders, and the scoreboard; the instance supplies the model
endpoint and the skills root. `run.mjs` exits non-zero if any eval errored or failed. With
`RUNRECORD_LOG` set it also appends one [run-record](../../runtime/observability/) per gradeable eval.

## Scoreboard shape

```json
{
  "total": 7, "gradeable": 5, "passed": 5, "failed": 0, "skipped": 2, "errored": 0,
  "coverage": { "withEval": 7, "total": 9, "pct": 78 },
  "generated_at": "2026-06-25T12:00:00.000Z",
  "results": [ { "skill": "debug", "evalType": "baseline", "gradeable": true, "pass": true } ]
}
```

## Verify

```bash
node framework/standards/eval-harness/validate.mjs    # MOCK-model selftest: parse, both graders, scoreboard, presence, zone-purity
node framework/primitives/_lib/validate.mjs --all      # runs the above inside the full harness
```

> Last reviewed: 2026-06-25
