# primitive-integrity

The executable half of [`doctrine/standards/primitive-integrity.md`](../../doctrine/standards/primitive-integrity.md):
it proves every primitive definition is **complete**. The one-command harness discovers primitives by the
existence of their `validate.mjs`, so a primitive missing its validator (or schema, or creator) is silently
**skipped** — never counted, never failed. This gate enumerates the folders directly and flags an
incomplete one by name.

A single file of plain `.mjs`, **zero npm dependencies**, discovered by `validate.mjs --all` like every
other standard.

## What it checks

Every directory under `framework/primitives/` (excluding the shared `_lib/`) carries all four mandated
artifacts:

| Artifact | Role |
|---|---|
| `spec.md` | the prose contract |
| `*.schema.json` | the JSON Schema instances validate against |
| `creator.md` | the meta-skill for authoring one |
| `validate.mjs` | the validator the harness runs |

A primitive missing any of the four fails **by name** — surfacing exactly the gap the harness's
discover-by-validator model would otherwise hide.

This is **definition-completeness**, not instance-validity: the per-primitive validators check whether the
*instances* are well-formed; this checks whether the *primitive type itself* ships its full machinery. Both
are needed, and they catch different failures.

## Verify

```bash
node framework/standards/primitive-integrity/validate.mjs   # selftest: completeness logic, then the real scan
node framework/primitives/_lib/validate.mjs --all            # runs the above inside the full harness
```

> Last reviewed: 2026-06-25
