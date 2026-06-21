# Primitive: Skills

> A skill is a reusable SOP the agent loads on demand — a procedure with a load-signal
> description, progressive disclosure, and (ideally) a test. This spec is the contract.
> Schema: [`skills.schema.json`](skills.schema.json). Validator: [`validate.mjs`](validate.mjs).
> Creator: [`creator.md`](creator.md).

## The shape of a skill

A skill is a directory whose entry point is `SKILL.md`: YAML **frontmatter** (discovery
metadata) + a markdown **procedure body**. Heavier detail lives one level deep in
`references/`, `scripts/`, `assets/` — loaded only when the body points to it.

```markdown
---
name: deep-research                  # kebab-case; == the skill's directory name
description: Multi-step web research with source verification. Use when researching topics
             in depth, fact-checking, or /deep-research.
user-invocable: true
context: fork
argument-hint: [research-question]
---

## Procedure
1. Decompose the question …
```

The two fields that matter most: `name` (identity, == directory) and `description` — the
**load signal** ("does X; use when Y + symptoms/triggers"), never a workflow summary (a
workflow-y description makes agents shortcut the body). Both bounded by
[`skills.schema.json`](skills.schema.json).

## One format, both runtimes — no emit

A SKILL.md is **identical** across Claude and Codex (both read the same file). There is no
cross-runtime transform, so this primitive has **no `emit.mjs`**. Distribution is a pure
**copy** to where each runtime loads (`~/.claude/skills/`, `~/.codex/skills/`) handled by
the adopter's instance sync script — a mirror, not a projection.

## Validation: an OPEN schema (deliberately)

Unlike agents and commands (closed, control-plane vocabularies → `additionalProperties:
false`), the skill schema is **open** (`additionalProperties: true`). The skill ecosystem
evolves and a closed whitelist is exactly why the legacy `quick_validate.py` wrongly rejected
real production skills (`user-invocable`, `argument-hint`, `context`, `agent`). We type-check
the **known** keys strictly and let novel keys pass:

1. **Frontmatter** → `ajv` against `skills.schema.json`. `name` (kebab, ≤64), `description`
   (≤1024, no angle brackets) required; known optional keys type-checked; unknown keys allowed.
2. **Body** → code: must be **non-empty**; a **warning** if it exceeds 500 lines
   (progressive-disclosure budget — push detail into one-level-deep references) or if `name`
   ≠ the containing directory.

Verified empirically against the live set: **119/119** `SKILL.md` across both runtimes pass
(one reconciliation: `mcp_dependencies` appears live as a comma-separated string, now accepted).
An inline `--selftest` keeps `node _lib/validate.mjs --all` non-vacuous on a fresh clone.

## Constraints (what NOT to do)

- **Never write a workflow-summary `description`.** It must be a load signal, or agents skip
  the body.
- **Never let `SKILL.md` sprawl.** Keep it under ~500 lines; references load on demand,
  one level deep (no nested ref chains).
- **Never assume per-runtime variants.** One SKILL.md serves both; reconcile in the source,
  sync the copy.

## Verify (executable acceptance)

```
node framework/primitives/skills/validate.mjs --selftest                       # inline good/bad
node framework/primitives/skills/validate.mjs ~/.codex/skills/*/SKILL.md       # real artifacts
```
Green = the skill set conforms.
