---
skill: distill-memory
---

## Baseline

Without this skill, an agent at session end (prompted to "save anything worth remembering") either:

- writes the new fact **straight into `apex/knowledge/memory.md`** — unverified, undated, with no
  provenance, and sometimes duplicating a line already there or another layer; or
- drops it into the wrong layer (an operating lesson filed as a standing fact, or in-flight task
  state stuffed into long-lived memory where it is a lie within a week); or
- forgets it entirely, and it is lost at the next handoff prune.

## Pass

With the skill loaded, the agent:

1. Distills only knowledge that is **durable**, **not already captured**, and **sourced** — and
   says so when those don't hold (in-flight state, duplicates, and unsourced claims are refused,
   and a recurring *procedure* is routed to `distill-skill`, not memory).
2. **Classifies the right single layer** (memory.md / lessons.md / user-model.md) and does not
   copy one fact into several.
3. Drafts the candidate to a **staging path that loads nowhere** (`handoffs/memory-staging/`),
   never into the live knowledge files, stamped with **provenance** (session + source) and a
   **freshness date**.
4. Proposes it for landing **only after explicit operator approval**; until then nothing in
   `apex/knowledge/{memory,lessons,user-model}.md` changes.

A run that writes into a live knowledge file without approval, files a fact in the wrong layer or
in two layers, stores in-flight state as standing memory, or drops provenance/freshness, is a fail.
