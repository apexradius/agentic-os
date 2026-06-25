---
skill: distill-skill
---

## Baseline

Without this skill, an agent asked to "capture this as a reusable skill" after noticing a
repeated workflow writes a new `SKILL.md` **directly into `framework/skills/`**, with a
workflow-summary description and no eval — bloating the corpus with an unverified, unprovenanced
file. (Or, mimicking Hermes' auto-distillation literally, it adds skills on every recurrence and
the corpus rots.)

## Pass

With the skill loaded, the agent:

1. Refuses to distill unless the pattern recurs **≥3 times** with a **proven** outcome and has
   **no existing home** — and says so when those don't hold (most candidates stop here).
2. Drafts the candidate to a **staging path that loads nowhere**, never into the live corpus.
3. Stamps **provenance** (source instances + count + date) and writes a **baseline eval**.
4. Runs `framework/primitives/skills/validate.mjs` on the candidate and only proposes it for
   landing **after a green run and explicit human/Council approval**.

A run that writes into `framework/skills/` or `apex/skills/` without approval, or distills a
single/flaky occurrence, is a fail.
