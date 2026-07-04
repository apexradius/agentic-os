# Primitive: Eval

> An eval is a portable Task/Solver/Scorer contract. It says what task is being
> tested, which solver is under test, how the output is scored, and what threshold
> passes. Schema: [`eval.schema.json`](eval.schema.json). Validator:
> [`validate.mjs`](validate.mjs). Runner: [`run.mjs`](run.mjs). Creator:
> [`creator.md`](creator.md).

## The shape of an eval

An eval is a JSON object with three required blocks:

```json
{
  "id": "answer-grounding",
  "grading_mode": "deterministic",
  "task": {
    "id": "grounded-answer",
    "source": "fixtures/grounded-answer.jsonl"
  },
  "solver": {
    "type": "skill",
    "ref": "research"
  },
  "scorer": {
    "type": "deterministic",
    "threshold": 0.95,
    "assertions": ["cites supplied source", "does not invent unsupported facts"]
  }
}
```

- **Task** names the dataset, fixture, prompt pack, or other source pointer.
- **Solver** names the agent, skill, command, MCP tool, or custom runtime under test.
- **Scorer** declares deterministic or judge grading plus the pass threshold.

The primitive is intentionally portable. The included runner executes only local,
fixture-backed deterministic evals; runtime model calls, hosted judge APIs,
provider-specific structured output, and result sinks belong to an instance.

## Deterministic versus judge scoring

`grading_mode` and `scorer.type` must agree:

- `deterministic` means the scorer can be computed from fixtures, assertions, schemas,
  exact matches, or other local checks.
- `judge` means an external or model-backed judge is involved. A judge eval must point
  at a gate artifact that satisfies the judge-bias and judge-validity standards before
  its verdicts are trusted.

The deterministic runner loads `task.source` as local JSON, JSON array, `{ "cases": [] }`,
or JSONL. Each case must provide a string `output`, `actual`, or `response`. Assertions are
plain `contains` checks unless prefixed:

- `contains:TEXT`
- `not_contains:TEXT`
- `regex:/PATTERN/FLAGS`

## Validation

`validate.mjs` checks the JSON contract with `eval.schema.json`, applies the
cross-field rule that `grading_mode` and `scorer.type` match, and selftests the
deterministic runner. `run.mjs <eval.json>` emits JSON with a run-record-compatible
`run_record` for deterministic evals. Judge evals validate but return `gradeable:false`
unless an instance-owned judge runner executes them.

## Constraints

- **No provider coupling.** The framework does not name model vendors, endpoints, API
  keys, or hosted judge services.
- **No secret inputs.** Dataset/source pointers may point at private data in an
  instance, but the eval definition itself must not contain credentials.
- **No hidden pass criteria.** A threshold is required, and deterministic assertions or
  a judge gate pointer should make the scoring basis reviewable.

## Verify

```bash
node framework/primitives/_lib/validate.mjs eval
node framework/primitives/eval/run.mjs path/to/eval.json
node framework/primitives/_lib/validate.mjs --all
```
