# faithfulness-trace

Executable enforcement for closeout evidence. A completion report can say "done" only
when each done claim maps to the tool call, command, artifact, or observed output that
proves it.

This turns [`framework/doctrine/standards/faithfulness-trace.md`](../../doctrine/standards/faithfulness-trace.md)
from prose into a deterministic artifact-shape check.

## Run it

```bash
node framework/standards/faithfulness-trace/validate.mjs
node framework/primitives/_lib/validate.mjs --all
```

## Trace shape

```json
{
  "claims": [
    {
      "claim": "Validator passes",
      "evidence": {
        "type": "command",
        "ref": "node framework/primitives/_lib/validate.mjs --all",
        "observed": "Exited 0 and printed ALL VALID",
        "timestamp": "2026-06-25T18:00:00Z"
      }
    }
  ]
}
```

`evidence.ref` is the generic pointer. A runtime may also provide `command` or `tool`
for richer traces; at least one of the three must be present.

## What it checks

- A trace is an object with a non-empty `claims` array.
- Every claim has non-empty claim text.
- Every claim has evidence.
- Evidence declares a type, pointer, observed result summary, and timestamp.
- Evidence type is one of `tool`, `command`, `artifact`, or `observed-output`.

## What it does not check

This gate proves trace completeness, not truth. Whether the cited command or artifact
really proves the claim remains a review judgment. The shape gate prevents the more
basic failure: claims with no evidence at all.
