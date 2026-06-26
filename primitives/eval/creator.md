# Eval Creator

Use this when adding a new portable eval definition.

## Inputs

- The behavior under test.
- The task source: fixture file, dataset pointer, prompt pack, or instance-owned locator.
- The solver under test: agent, skill, command, MCP tool, or custom runtime.
- The scorer type: deterministic or judge.
- The pass threshold.

## Steps

1. Pick a kebab-case `id` that names the behavior, not the implementation.
2. Fill `task.id` and `task.source`; keep source pointers portable or instance-owned,
   never embedded secrets.
3. Fill `solver.type` and `solver.ref`; reference the canonical primitive where possible.
4. Choose `scorer.type` and set `grading_mode` to the same value.
5. Add a numeric `scorer.threshold` between `0` and `1`.
6. For deterministic evals, list the reviewable assertions or metric.
7. For judge evals, point `scorer.judge_gate` at a gate artifact that satisfies the
   judge-bias and judge-validity standards.
8. Run `node framework/primitives/_lib/validate.mjs eval`.

## Anti-patterns

- Do not put model API calls or provider-specific output schemas in the primitive.
- Do not put credentials, tokens, or private dataset contents in the eval definition.
- Do not use a judge scorer without a judge gate and gold-set validation.
- Do not leave the pass threshold implicit.
