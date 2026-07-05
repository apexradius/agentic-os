---
name: distill-memory
description: "Capture a durable fact, lesson, or operator preference surfaced this session into a staged candidate — classified to the right memory layer, provenance- and freshness-stamped, and gated before it lands. Use at session end or when something worth remembering emerges that isn't yet in memory.md / lessons.md / user-model.md, or /distill-memory. Proposes only — never auto-writes the knowledge corpus."
user-invocable: true
argument-hint: "[fact-or-session-source]"
---

# Distill Memory

The memory stack only works if durable knowledge actually reaches it. The current path relies on
an agent *remembering* to hand-write a handoff at session end — so facts get written straight into
`memory.md` unverified and undated, written into the wrong layer, duplicated across layers, or
lost entirely at the next prune. The `distill-skill` skill already solved this shape for
*procedures*: draft a candidate, gate it, propose — never auto-write. This is its twin for
**facts, lessons, and preferences**. It proposes; the operator approves. The knowledge
corpus never grows unattended. Doctrine already gates *procedural* memory this way — skills graduate
"only through the gated `distill-skill` flow, never auto-written"
([`framework/loop/context.md`](../../loop/context.md)); this skill extends that same guardrail to the
fact, lesson, and preference layers.

## When this fires (the signal)

Distill a memory candidate only when all three hold — otherwise stop and say so:

1. **Durable.** It will still be true next session — a standing fact, an operating lesson, or an
   operator preference. *In-flight* state (what was mid-task when the session ended) is **not**
   durable memory; it belongs in a handoff and is meant to be pruned. If it expires with the
   session, it is not a candidate.
2. **Not already captured.** It is absent from `apex/knowledge/memory.md`, `lessons.md`, and
   `user-model.md` (dedup first — see step 1). A fact already recorded is not a candidate; at most
   it is a *freshness* update to the existing line.
3. **Sourced.** It came from observed reality this session — a command output, a decision the
   operator stated, a verified fact — not speculation. Knowledge with no source cannot be triaged.

Not durable, already captured, or unsourced → **do not distill.** Report the finding instead. A
*recurring procedure* is not memory — route it to [`distill-skill`](../distill-skill/SKILL.md), not here.

## The right layer (route, don't duplicate)

A fact lives in exactly **one** layer — "right layer, not every layer" ([`context.md`](../../loop/context.md)).
Classify before drafting:

| If it is… | Layer | File |
|---|---|---|
| A fact about the world — a system, topology, contract, where a credential lives | Standing note | `apex/knowledge/memory.md` |
| "We learned X the hard way" — an operating correction earned from a failure | Lesson | `apex/knowledge/lessons.md` |
| How the operator wants work done | User model | `apex/knowledge/user-model.md` |
| A reusable multi-step procedure | (not memory) | → [`distill-skill`](../distill-skill/SKILL.md) |
| State of work in flight at session end | (not durable) | → a handoff (`handoffs/`) |

If a candidate seems to fit two long-lived layers, it is usually a world-fact (memory) *plus* a
distinct lesson — split it, don't copy it into both.

## Procedure

1. **Dedup against the corpus.** Read `apex/knowledge/{memory,lessons,user-model}.md` and check the
   fact isn't already there. If it is but stale, propose a *freshness update* to that line (a
   smaller change), not a new entry.

2. **Classify the layer** (table above). If it routes to `distill-skill` or a handoff, stop and say
   so — this skill only handles durable facts/lessons/preferences.

3. **Draft to staging, never the corpus.** Write the candidate to a staging path the runtimes do
   NOT load — `apex/knowledge/handoffs/memory-staging/<id>.md` (sibling of `distill-skill`'s
   `distill-staging/`; created on demand). The candidate carries:
   - the **target layer + file**,
   - the **exact text to add**, in that file's house style (matching the surrounding entries),
     carrying its own **freshness date** (the long-lived layers are dated — stale = re-verify),
   - a **provenance** block: the session id/date and the source (command output, the operator's
     words, the verified observation) — the triage record, so an auto-drafted fact is never trusted
     blind.

4. **Review (no-bloat + right-layer).** Is it durable, in the right *single* layer, non-duplicate,
   sourced, and freshness-dated? Does it *teach or work*? A fail on any → fix in staging or discard.

5. **Hand off for approval.** Present the candidate, its target layer, and its provenance to the
   operator. **Only on explicit approval** is the candidate's text merged into the target
   knowledge file (with its freshness date) and the staging file deleted. Until then it stays in
   staging and is loaded nowhere. Graduation is the operator's call, not the agent's.

## What NOT to do

- **Never write into `memory.md`, `lessons.md`, or `user-model.md` without approval.** Staging →
  review → land. No shortcut, no "I'll just add it" — the corpus never grows unattended.
- **Never store in-flight state as standing memory.** That is a handoff; it is meant to be pruned.
  Putting it in a long-lived layer is a lie within a week.
- **Never duplicate across layers.** One fact, one layer. Split a compound finding; don't copy it.
- **Never drop provenance or the freshness date.** An unsourced, undated fact cannot be triaged
  and must not land.
- **Never distill a procedure here.** A recurring how-to is a skill → [`distill-skill`](../distill-skill/SKILL.md).

## Verify

```
node framework/primitives/skills/validate.mjs framework/skills/distill-memory/SKILL.md
```
Done = a deduped, layer-classified, provenance- and freshness-stamped candidate sitting in staging,
awaiting approval — and nothing changed in `apex/knowledge/{memory,lessons,user-model}.md`.
