# skill-ref-integrity

Every skill an agent names in its `skills:` frontmatter must be a skill that actually exists. This
standard is the executable proof of that invariant.

A single `validate.mjs` with **zero npm dependencies**, discovered by `validate.mjs --all` like every
other standard (dropping this directory in wires it — no runner edit).

## Why it exists

An agent's `skills:` list resolves each entry by exact name at dispatch time. No other gate proves those
names resolve:

- the capability index renders agents **without** their per-agent skills, so its `--check` sees zero drift
  when an agent points at a deleted skill;
- mirror-parity compares manual outlines, not skills;
- the agent emitter's `--check` proves the runtime mirrors equal the canonical source — but it will emit a
  dead name just as faithfully as a live one.

So a collapse or retire that misses one agent line degrades that agent **silently**: it still dispatches,
the promised capability simply never loads, and the failure only shows up mid-task as missing behavior.
This gate converts that whole failure class into a loud build break.

## What it checks

- **Live skill set** — the flat directory names under `framework/skills/` and `apex/skills/` (routers
  included; they are live skills).
- **Alias keys** — the keys of the instance alias registry (`apex/skills/.aliases.json`), so an agent may
  reference a renamed/collapsed skill by an aliased name that still resolves.
- **Resolution** — for every canonical agent (`framework/roles/*.md` and `apex/agents/*.md`), each
  `skills:` entry must resolve to a live skill directory **or** an alias key. Any miss fails with
  `file:line` and the unresolved name. Scanning canonical agents is sufficient because the agent emitter's
  own `--check` guarantees the emitted mirrors equal the canonical source.

## Selftest

Inline RED/GREEN fixtures prove the resolver: a seeded ref matching neither a live directory nor an alias
key must make the validator exit non-zero; a fixture whose refs all resolve must pass. Run bare:

```bash
node framework/standards/skill-ref-integrity/validate.mjs
```

It prints `skill-ref-integrity: X/Y selftest checks passed` and exits non-zero on any failure.
