# runtime-capability-matrix

Executable gate for [`runtime/capabilities.json`](../../runtime/capabilities.json): the portable runtime capability matrix and shared validator finding contract.

This standard keeps the external-framework review lift honest. A runtime matrix that is not checked will drift; a validator finding shape that is only prose will not change repair loops. The gate proves the contract remains parseable, complete, and internally consistent without adding runtime behavior.

## What It Checks

- `framework/runtime/capabilities.json` parses as JSON and carries `version`, `status`, `purpose`, `validator_finding_shape`, and `runtimes`.
- `validator_finding_shape` declares the repair-loop fields: `severity`, `path`, `message`, `fix`.
- Every runtime has a unique lowercase id, a label, and support entries for `agents`, `skills`, `commands`, `hooks`, `mcp`, `plugins`, and `evals`.
- Every support value is one of `native`, `adapter`, `framework`, `plugin`, `partial`, or `none`.
- `capabilities.schema.json` agrees with the matrix contract's top-level required fields and support enum.

## Verify

```bash
node framework/standards/runtime-capability-matrix/validate.mjs
node framework/primitives/_lib/validate.mjs --all
```

> Last reviewed: 2026-07-07
