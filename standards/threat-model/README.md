# threat-model

The executable half of [`doctrine/standards/threat-model.md`](../../doctrine/standards/threat-model.md):
the build-time security discipline. Before a primitive that touches untrusted input or wields privilege
ships, its author answers four questions — **trust boundary, privilege, blast radius, mitigation**. This
gate proves the **format**: every `THREAT-MODEL.md` in the tree answers all four with a non-empty body.

It deliberately does **not** judge whether the reasoning is correct — that is the
[`security-reviewer`](../../roles/security-reviewer.md) role. Format here, judgment there. A single tree
of plain `.mjs`, **zero npm dependencies**, discovered by `validate.mjs --all` like every other standard.

## What it checks

- `checkThreatModel(md)` — the four required questions are each present (as an `h2`–`h4` heading, space or
  hyphen spelling) **with a non-empty body**. A heading with nothing under it counts as missing.
- A **scan** of the whole framework tree (skipping `node_modules` and vendored dirs): every shipped
  `THREAT-MODEL.md` must be complete, and the [tool-gate exemplar](../tool-gate/THREAT-MODEL.md) — the
  framework's most privilege-critical component documenting its own posture — must be present and complete.

Adoption is incremental: the gate enforces the format on every threat model that exists and proves the
checker works; the doctrine states *when* a primitive owes one. A malformed `THREAT-MODEL.md` anywhere in
the tree fails `--all`.

## Verify

```bash
node framework/standards/threat-model/validate.mjs   # selftest: the four-question check + the tree scan
node framework/primitives/_lib/validate.mjs --all     # runs the above inside the full harness
```

> Last reviewed: 2026-06-25
