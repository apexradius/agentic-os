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
4. **Test-first where it matters.** A discipline/behavioral skill should ship with a
   failing-baseline test (RED→GREEN), rationalization tables, and red-flags — the meta-skill
   below scaffolds these.

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
