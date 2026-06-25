---
name: distill-skill
description: "Turn a recurring, proven-successful workflow into a candidate reusable skill, then gate it through the validator and a no-bloat review before it can land. Use when the same multi-step procedure has succeeded several times across sessions/handoffs and is worth capturing, or /distill-skill. Proposes only — never auto-writes the live corpus."
user-invocable: true
argument-hint: "[pattern-or-handoff-source]"
---

# Distill Skill

Hermes Agent's signature move is **procedural memory**: it converts successful workflows into
reusable skills automatically, so the agent improves through use. That upside is real — but
auto-writing skills straight into the corpus violates the no-bloat contract ("complexity is
*added*, not inherent; every file teaches or works"). This skill takes the upside and keeps the
guardrail: it **drafts** a candidate skill from a recurring success and **gates** it before
anything lands. It proposes; a human or the Council approves. The corpus never grows unattended.

## When this fires (the signal)

Distill only when all three hold — otherwise stop and say so:

1. **Recurrence.** The same procedure shape has been executed **≥3 times** across sessions
   (evidence in `apex/knowledge/handoffs/`, `lessons.md`, or the ledger), not once.
2. **Proven outcome.** Each instance ended **verified-in-reality** (an executable check passed),
   not "shipped, probably fine." A pattern that sometimes fails is not a skill, it is a risk.
3. **No existing home.** No current skill already covers it (search the corpus first — see step 1).

Fewer than 3 occurrences, a flaky outcome, or an existing skill → **do not distill**. Report the
finding instead. Most candidates should be rejected here; that is the point.

## Procedure

1. **Dedup against the corpus.** Search `framework/skills/*/SKILL.md` and `apex/skills/*/SKILL.md`
   for an existing skill whose `description` load-signal already covers this trigger. If one
   exists, stop — propose *improving* it (a separate, smaller change), not a new skill.

2. **Extract the procedure.** From the recurring instances, write the minimal ordered steps that
   were common to every successful run. Strip the instance-specific detail (paths, client names,
   one-off values) — a skill is the generic SOP, the instance supplies specifics. If the generic
   core is thin or the variance is high, it is not yet a skill — stop.

3. **Draft to staging, never the corpus.** Write the candidate to a **staging path** the runtimes
   do NOT load — `apex/knowledge/handoffs/distill-staging/<name>/SKILL.md` (or a scratch dir).
   Author it to the skills spec ([`framework/primitives/skills/spec.md`](../../primitives/skills/spec.md))
   and the [`creator`](../../primitives/skills/creator.md) meta-skill:
   - a **load-signal** `description` ("does X; use when Y + triggers"), never a workflow recap;
   - body under ~500 lines, progressive disclosure (heavy detail one level deep);
   - a **provenance** block in `metadata`: the source instances (handoff files / session ids),
     the occurrence count, and the date — the triage record (cf. OpenClaw/SkillSieve: a skill
     carries where it came from, so an imported/auto-drafted skill is never trusted blind).

4. **Write the eval.** A `baseline` `eval.md` next to it (RED→GREEN): the failure WITHOUT the
   skill, the success criterion WITH it. A candidate that cannot state a failing baseline does not
   earn its context — stop and say so.

5. **Gate it (executable).** Run the validator on the staged candidate; it must pass:
   ```
   node framework/primitives/skills/validate.mjs apex/knowledge/handoffs/distill-staging/<name>/SKILL.md
   ```
   Then the **no-bloat review**: does it *teach or work*? Is it law/state/machinery kept separate?
   Is the description a load signal, not a summary? A fail on any → fix in staging or discard.

6. **Hand off for approval.** Present the candidate, its eval, its provenance, and the green
   validator output to the human/Council. **Only on explicit approval** does it move from staging
   into `framework/skills/<name>/` (generic) or `apex/skills/<name>/` (Apex-coupled) and get
   synced to the runtime load paths. Until then it stays in staging and loads nowhere.

## What NOT to do

- **Never write into `framework/skills/` or `apex/skills/` without approval.** Staging → review →
  land. No shortcut, no "I'll just add it."
- **Never distill a single occurrence or a flaky one.** Recurrence + proven outcome are the gate.
- **Never drop provenance.** A skill with no recorded source cannot be triaged and must not land.
- **Never zone-confuse.** A pattern that names a host/client/path is Apex-coupled → `apex/skills/`,
  never `framework/skills/`.

## Verify

```
node framework/primitives/skills/validate.mjs <staged SKILL.md>   # candidate conforms (green required to land)
```
Done = a conforming, eval-backed, provenance-stamped candidate sitting in staging with a green
validator run, awaiting approval — and nothing changed in the live corpus.
