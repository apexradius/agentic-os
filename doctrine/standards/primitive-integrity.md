# Primitive-Integrity Standard

The no-bloat contract says every primitive ships as **spec + schema + creator + validator** — prose
alone is never enough. That rule is load-bearing, but it had a blind spot: the thing that proves
primitives are well-formed *can't see a primitive that's too malformed to register*.

The one-command harness (`validate.mjs --all`) discovers primitives **by the existence of their
validator**. So a primitive folder that is missing its `validate.mjs` is not *failed* — it is silently
**skipped**. It never appears in the `N primitives` count, no check turns red, and the gap is invisible
in CI. A primitive missing its `schema.json` or `creator.md` is just as quiet: the harness runs whatever
validator is there and reports green, while the primitive is, by the framework's own definition,
incomplete. Half-built machinery that announces itself as complete is worse than machinery that's
obviously absent.

This standard closes that hole. It enumerates the primitive folders **directly** — not by what they
happen to contain — and asserts each one carries all four mandated artifacts.

## The bar

Every directory under `framework/primitives/` (excluding the shared `_lib/` helper) carries all four:

| Artifact | What it is | Why it's mandatory |
|---|---|---|
| `spec.md` | the prose contract — what this primitive *is* | a primitive with no spec is undefined |
| `*.schema.json` | the JSON Schema instances are validated against | without it, instances can't be machine-checked |
| `creator.md` | the meta-skill for authoring one correctly | the knowledge to build the next one |
| `validate.mjs` | the validator the harness discovers and runs | without it, the harness silently skips the primitive |

A primitive missing any of the four fails this gate **by name**, loudly — the exact failure mode the
harness alone cannot surface.

## Definition-completeness, not instance-validity

This gate and the per-primitive validators check **different things, and both are needed**:

- A primitive's own `validate.mjs` checks its **instances** — *are these particular agents / skills /
  hooks well-formed against the schema?*
- This standard checks the **primitive definition itself** — *does this primitive type ship its full
  machinery so the framework can be reasoned about and extracted?*

One proves the contents are valid; the other proves the contract exists to validate them against.
A primitive can have perfectly valid instances and still be an incomplete primitive (e.g. a missing
`creator.md` means no one can author the next instance correctly).

## Scope

Only the **primitive definitions** under `framework/primitives/`. The shared `_lib/` (the harness and
common helpers) is not a primitive and is excluded. Instance bodies (`skills/`, `roles/`) are out of
scope here — they are the *output* of primitives, validated by the per-primitive validators, not the
primitive definitions this gate guards. Executable enforcement lives in
[`standards/primitive-integrity/`](../../standards/primitive-integrity/).

> Last reviewed: 2026-06-25
