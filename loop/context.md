# Context

A finite context window is the real constraint on long work. These practices keep it lean and
recoverable.

## WHISK — keep context lean

**W**rite · **H**old · **I**solate · **S**elect · **K**eep lean.

- **Write externally** — plans, findings, and progress go to files ([artifacts.md](artifacts.md)),
  not the context window.
- **Hold** — delay compaction as long as possible; don't let it trigger mid-thought.
- **Isolate** — push read-only research into disposable sub-agents (cheap context you throw away).
- **Select** — load only what you need. Don't re-read a whole file for five lines.
- **Keep lean** — summarize between phases; drop resolved context. *Carve-out:* an **unresolved**
  failure is not resolved context — keep failed actions, observations, and stack traces in the
  working window until the underlying issue is fixed and verified. The model corrects course only
  when it can see the failure it's recovering from; prune that evidence early and it repeats the
  mistake. That evidence becomes droppable once the fix passes [Verify](verification.md), not before.

## Layered memory — the persistence stack

WHISK keeps the *window* lean; this keeps the *durable* memory honest. A persistent agent does
not have one memory — it has a **stack of layers that differ by lifespan and scope**, and the
discipline is putting each fact in the layer that matches how long it stays true. (This is the
layered-memory model the self-improving agents — Hermes Agent, OpenClaw — are built on, stated
as doctrine rather than wired to any one store.)

| Layer | Holds | Lifespan | Where |
|---|---|---|---|
| **Standing notes** | Facts about the world the agent operates in — systems, topology, models, contracts | Long-lived; carries a verification date | the instance's knowledge zone (e.g. a `memory.md`) |
| **Lessons** | Distilled "we learned X the hard way" operating corrections | Long-lived | a `lessons.md` |
| **User model** | How the *operator* wants work done — preferences, standing corrections, communication style | Long-lived; updated as the relationship evolves | a `user-model.md` |
| **Session history** | What was in flight when a session ended — the very next action, uncommitted state | Short-lived; pruned once it graduates | `handoffs/` |
| **Skills** | Reusable *procedures* — how to do a recurring task | Long-lived; earns its context via an eval | the skills corpus |

Two rules keep the stack from rotting:

- **Right layer, not every layer.** A fact lives in exactly one layer. A durable truth in a
  handoff is lost at the next prune; a transient state in the standing notes is a lie within a
  week. When a handoff contains something durable, **graduate it** (into notes / lessons / user
  model / a distilled skill) and let the handoff stay disposable.
- **Freshness over faith.** Long-lived layers carry the date they were last verified; treat a
  stale fact as *re-verify before acting*, not as truth. When live reality contradicts a layer,
  reality wins and you fix the layer in the same pass.

The model is generic; the **content** is instance state (knowledge is state, not law). Procedural
memory has its own guardrail — recurring successes become skills only through the gated
`distill-skill` flow, never auto-written.

## Context budget — the percentage ladder

As context fills, the [context-budget standard](../standards/context-budget/) enforces a
living-handoff ladder. The ladder's default rungs (45 / 55 / 65 / 75 / 85 / 95% of the
window) are configurable per instance — the principle is host-agnostic: the agent must
refresh the handoff at each rung so the host's auto-compaction recovers from structured
state rather than reconstructing from scratch. The exact token count at which to act is
not fixed — it follows from the window size and the configured percentages.

## Compaction recovery — write first, read second

After any compaction or summarization signal, the **first** action is to **write**: rewrite the
progress file, reconstructing the remaining steps from whatever context survived. Commit what
you still know *before* you start consuming context again. Then re-read the law, the plan, and
the file you were editing, and state where you're resuming from.

## VNA — the very next action

At the end of every phase or session, state the **single specific next step** so clearly that
even after a context reset you know exactly what to do. The VNA is what makes a plan survive an
interruption.

## Sub-agent dispatch (the mechanics)

Sub-agents are disposable contexts. Dispatch one for any read-only investigation that would
cost several tool calls in the main context: "what does X do?", "where is Y defined?", "which
files reference Z?". On long sessions this is the default for research — every file you read in
the main context compounds toward compaction.

Do **not** dispatch for: actual edits, a single targeted lookup, or work that needs the
conversation's context. The safety contract for delegation is
[../doctrine/rules/delegation.md](../doctrine/rules/delegation.md); the structured many-at-once
pattern (orchestrator + workers) is [../coordination/fan-out.md](../coordination/fan-out.md).

## Two reflexes

- **Tool-first.** Before writing text that asserts, verifies, or closes something out, check
  whether a tool would do it — and use the tool first. If you're drafting a request for the
  user to do something you have a tool for, stop and use the tool. (If the tool isn't loaded,
  load it — don't fall back to asking.)
- **Live-data.** Training has a cutoff; reality doesn't. For anything reality-relevant —
  current events, versions, prices, service status, "is X still true" — use live lookup before
  answering. Reasoning, math, and code don't need it.

> Last reviewed: 2026-06-24
