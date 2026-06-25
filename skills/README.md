# framework/skills — generic, reusable skills

Portable skills with **zero Apex coupling** — extraction-ready. Authored to the skills primitive
([`../primitives/skills/`](../primitives/skills/)): frontmatter (a *load signal* description, not a
workflow recap) + a procedure body kept under 500 lines, with detail pushed one level deep into
`references/`. Instance-coupled skills live in the adopter's instance zone.

**89 skills** (86 from the Stage 3·skills migration, plus later framework additions). The zone is enforced: `skills/validate.mjs` runs a
`checkZone` guard that fails any skill here whose `SKILL.md` or a reference file names an Apex host,
product, person, path, or `mcp__apex-*` tool. Validate with:

```bash
node framework/primitives/skills/validate.mjs framework/skills/*/SKILL.md
node framework/primitives/_lib/validate.mjs --all      # both zones + the rest
```

Skills are byte-identical across Claude and Codex (no emit/transform); distribution into the runtime
dirs is a pure copy via the adopter's instance sync script.
The per-skill routing rationale is logged in the adopter's instance knowledge zone.
