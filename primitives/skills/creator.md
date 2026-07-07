# Creator: how to add or change a skill

> The SOP for authoring a new skill or editing one. Read [`spec.md`](spec.md) first. The last
> step is an executable gate. The deeper meta-skill that scaffolds and *tests* skills is the
> reference implementation named below.

## Decide the zone

- Is the SOP **generic** — would it help in any codebase (a research method, a review
  protocol)? → `framework/skills/<name>/SKILL.md`. Name no host, client, product, or person.
- Is it **Apex-specific** — does it know our systems or domain? → `apex/skills/<name>/SKILL.md`.

## Author the skill

1. **Directory + entry point.** Create `<name>/SKILL.md`. The `name` frontmatter field must
   equal the directory.
2. **Frontmatter.** `name` (kebab-case) and `description` are required. Write the
   `description` as a **load signal** — "does X; use when Y" plus the symptoms/triggers/error
   strings that should fire it. Add `user-invocable`, `argument-hint`, `context`, `agent`,
   `allowed-tools` as the skill needs. The schema is open, so a new key won't fail — but
   prefer the known keys.
3. **Body (progressive disclosure).** Keep `SKILL.md` under ~500 lines: When-to-Use →
   Procedure → Decision-Criteria → Anti-Patterns. Push long detail into `references/`
   (one level deep, no nested ref chains), `scripts/`, `assets/`.
4. **Ship a failing-baseline `eval.md`.** Create `<name>/eval.md` next to `SKILL.md`. Pick the
   shape by `eval-type` (see `spec.md` → "Evals"):
   - **`baseline` (default)** for behavioral/discipline/output-shape skills — a `## Baseline`
     section (the prompt + the failure observed *without* the skill, a concrete RED) and a
     `## Pass` section (the success criterion *with* the skill, the GREEN).
   - **`eval-type: rubric`** for creative/generative skills (image/video/copy/brand) where a
     binary pass is contrived — a `## Rubric` of weighted, *specific, checkable* criteria and a
     `## Pass threshold`. Do not write generic "is it good?" criteria; tie each to what the
     skill claims to deliver, or the eval is folklore.
   Coverage is measured on every validate (`eval coverage: N/total`). A missing eval is a
   warning; a present-but-malformed eval (or unknown `eval-type`) is an error, so write a real
   one. The meta-skill below scaffolds rationalization tables and red-flags for discipline skills.
   The creator never fabricates `certification`; new skills ship uncertified.

## Verify (the gate)

```bash
node framework/primitives/skills/validate.mjs framework/skills/<name>/SKILL.md
node framework/primitives/skills/validate.mjs --selftest
```

A green `validate` is done. There is no emitted copy — a skill is one file synced (copied) to
where each runtime loads; see `spec.md` and `apex/config/codex-sync`.

## Reference implementations

Prior art worth reading (referenced, not imported): the `skill-creator` meta-skill at
`~/.codex/skills/.system/skill-creator/` (its `init_skill.py` scaffolds the directory; its
`quick_validate.py` is the *legacy* validator this primitive supersedes — note its allowed-keys
whitelist was too strict, which is why our schema is open). The live skill set under
`~/.codex/skills/` is the format corpus.
