# Standard-Shape Standard

The no-bloat contract holds every **primitive** to spec + schema + creator + validator. But the
**standards-as-code** — the gates that enforce design taste, tool safety, versioning, reference integrity,
and the rest — are the framework's enforcement layer, and they had no contract of their own. Each
`validate.mjs` was authored to an *implicit* convention carried in the author's head and demonstrated by
the gates that came before. That convention is load-bearing: the one-command harness (`validate.mjs --all`)
**relies** on it — it discovers each gate, runs it, and rolls up the exit code. A gate that quietly broke
the convention would break the rollup, or the extraction promise, with no warning.

The sharpest risk is **dependency creep**. The framework's defining promise is that it runs on a bare
extraction with *zero install* — every checker imports only Node's own builtins. One `validate.mjs` that
`import`s an npm package would pass locally (the author has it installed) and fail the moment a consumer
clones the public tree and runs the gate without `npm install`. The convention is the promise; nothing
enforced it.

This standard makes the enforcement layer obey its own discipline. It is the gate that holds the gates to
their contract.

## The contract

Every `framework/standards/<name>/validate.mjs` satisfies all of:

| Requirement | Why |
|---|---|
| **Node shebang** (`#!/usr/bin/env node` as the first line) | runs bare (`./validate.mjs`) and under the harness alike |
| **Zero npm dependencies** — imports only `node:` builtins or relative paths | runs on a fresh extraction with no `npm install`; the core portability promise |
| **Parseable selftest tail** — prints `<name>: X/Y selftest checks passed` and exits non-zero on any failure | the line + exit code `--all` rolls up; without it a failure is silent |
| **Sibling `README.md`** | the human entry point next to the machinery |

The selftest itself (a RED/GREEN proof on a temp or inline fixture that the checker actually catches the
violation it guards) is a discipline this standard's prose mandates; the shape gate proves the *result* of
that discipline (the tail line) is present and parseable.

## What this does not require

**Name-matched doctrine law is not required.** A gate's prose law may live in a differently-named doctrine
file — `design-gate/` is the executable half of [`design.md`](design.md), `eval-harness/` of
[`observability.md`](observability.md) — or in a shared one (`mirror-parity/` points at
[`doctrine/README.md`](../README.md)). The requirement is that a gate *is documented*, not that its folder
name equals a doctrine filename.

## Enforced vs. judged

Shape is enforced here; **substance is not**. This gate proves a `validate.mjs` is well-formed and
portable — it cannot prove the checks inside it are the *right* checks, or that the selftest's RED case is
genuinely adversarial. That judgment stays with review. Executable enforcement lives in
[`standards/standard-shape/`](../../standards/standard-shape/).

> Last reviewed: 2026-06-25
