# orchestration-manifest

Executable enforcement for portable multi-agent orchestration manifests. The gate
checks the DAG shape before a runtime dispatches agents.

The coordination doctrine lives in
[`framework/coordination/orchestration.md`](../../coordination/orchestration.md).

## Run it

```bash
node framework/standards/orchestration-manifest/validate.mjs
node framework/primitives/_lib/validate.mjs --all
```

## What it checks

- The manifest has an `id` and a non-empty `nodes` array.
- Every node has `id`, `owner`, `validation_command`, `output_artifact`, and
  `resume_key`.
- `files_owned` and `depends_on` are arrays when present.
- Node IDs are unique.
- Dependencies point at real nodes.
- The graph has no cycles.

## What it does not check

The gate does not run the validation commands, verify file-ownership against a live
ledger, or dispatch agents. It proves the orchestration contract is executable by a
runtime that owns those side effects.
