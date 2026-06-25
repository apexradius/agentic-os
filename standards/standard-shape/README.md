# standard-shape

The executable half of [`doctrine/standards/standard-shape.md`](../../doctrine/standards/standard-shape.md):
the gate that holds the gates to their own contract. The standards-as-code are the framework's enforcement
layer, and the one-command harness relies on each one being shaped the same way. This proves they are —
catching the failure no other gate would: a checker that **imports an npm package**, passing for its author
and breaking the instant a consumer runs it on a bare extraction with no `npm install`.

A single file of plain `.mjs`, **zero npm dependencies**, discovered by `validate.mjs --all` like every
other standard — and scanned by itself.

## What it checks

Every `framework/standards/<name>/validate.mjs` (including this one):

| Requirement | Catches |
|---|---|
| node shebang (`#!/usr/bin/env node` first line) | a gate that won't run bare |
| zero npm dependencies (imports only `node:` / relative) | a dependency leak that breaks zero-install extraction |
| parseable selftest tail + non-zero exit on failure | a gate whose failure the `--all` rollup can't see |
| sibling `README.md` | a gate with no human entry point |

**Shape, not substance.** This proves a gate is well-formed and portable; it cannot prove the checks inside
are the *right* checks. That judgment stays with review. Name-matched doctrine law is deliberately **not**
required — a gate's prose may live in a differently-named or shared doctrine file.

## Verify

```bash
node framework/standards/standard-shape/validate.mjs   # selftest: shape helpers, then the real scan
node framework/primitives/_lib/validate.mjs --all       # runs the above inside the full harness
```

> Last reviewed: 2026-06-25
