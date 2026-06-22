# Primitive: Skills

> A skill is a reusable SOP the agent loads on demand — a procedure with a load-signal
> description, progressive disclosure, and a failing-baseline eval (measured coverage,
> see below). This spec is the contract.
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

The whole live set across both runtimes passes (one reconciliation: `mcp_dependencies`
appears live as a comma-separated string, now accepted). An inline `--selftest` keeps
`node _lib/validate.mjs --all` non-vacuous on a fresh clone.

## Evals: the failing-baseline standard (measured, not blocking)

Every skill SHOULD carry an `eval.md` next to `SKILL.md` — the proof a skill *earns its
context*. There are **two shapes**, chosen by `eval-type` in the eval's frontmatter
(default `baseline`); both are minimal and machine-checkable.

**`baseline` (RED→GREEN) — the default.** For behavioral, discipline, and output-shape skills
where a discrete pass exists (the agent either swallows the error or finds the root cause):

```markdown
---
skill: debug          # the slug this eval pins down
---
## Baseline
The prompt + the failure observed WITHOUT the skill (e.g. agent swallows the error).
## Pass            # (or '## With skill')
The success criterion WITH the skill loaded — what must be true to count as a pass.
```

**`rubric` — for creative/generative skills.** For skills whose output is *graded, not
binary* (generate an image, write a brand kit, draft an email sequence). Forcing RED→GREEN
onto these produces a hollow eval — the exact folklore the standard exists to kill — so a
scored rubric is the honest shape:

```markdown
---
skill: ai-image
eval-type: rubric
---
## Task
A representative prompt that exercises the skill.
## Rubric
A table of weighted, checkable criteria specific to what the skill claims to deliver
(an LLM-judge or human can score each). Generic "is it good?" criteria are not acceptable.
## Pass threshold
The score (of the rubric total) required to pass.
```

The validator enforces this **asymmetrically**, on purpose:

- **Absent `eval.md` → WARNING.** Coverage is reported on every run
  (`eval coverage: N/total … (P%)`), so the gap is visible and shrinking — never hidden
  behind a green check. The target is 100%; we warn rather than block so the standard
  doesn't get gamed by deleting skills or stubbing evals to clear a gate.
- **Present but malformed `eval.md` → ERROR.** A broken eval (empty, an unknown `eval-type`,
  or missing its shape's required sections) reads as "covered" when it isn't — strictly worse
  than absent. So a *present* eval must be a real one of a known shape.

This mirrors the framework-level pattern: per-primitive `--selftest` IS the failing-baseline
test for the validator itself; `eval.md` is the same idea applied to each skill.

## Constraints (what NOT to do)

- **Never write a workflow-summary `description`.** It must be a load signal, or agents skip
  the body.
- **Never let `SKILL.md` sprawl.** Keep it under ~500 lines; references load on demand,
  one level deep (no nested ref chains).
- **Never assume per-runtime variants.** One SKILL.md serves both; reconcile in the source,
  sync the copy.

## Verify (executable acceptance)

```
node framework/primitives/skills/validate.mjs --selftest                       # inline good/bad (incl. eval cases)
node framework/primitives/skills/validate.mjs ~/.codex/skills/*/SKILL.md       # real artifacts
node framework/primitives/skills/validate.mjs                                  # in-repo set + eval-coverage report
```
Green = the skill set conforms. The `eval coverage: N/total (P%)` line is the standard's
scoreboard — drive it toward 100%.
