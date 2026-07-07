---
name: model-router
description: "Decision framework for routing a slice to a model tier (strongest/mid/fast) and effort level by task difficulty and cost — vendor-neutral; the concrete tier-to-model map is instance data. Use when choosing which tier a task should run on."
---

# Model Router — Task-to-Tier Mapping

The canonical reference for **which capability tier and effort level** a slice of work should run
on. Plans cite this when they declare a per-slice recommendation (see the `plan` skill and
`framework/loop/artifacts.md`). Tiers are generic and vendor-neutral — the concrete tier-to-model
resolution is the instance's data, never named here (names go stale; the concern is the routing
rule). The declared vocabulary is enforced by the
[`model-tier-routing`](../../standards/model-tier-routing/) standard.

## The tiers

Three capability tiers, from deepest reasoning to cheapest throughput:

- **`strongest`** — deepest reasoning, highest cost. The slices that justify it.
- **`mid`** — the execution default: strong and cost-balanced.
- **`fast`** — cheapest, subagent-friendly, for bulk and parallel read-only work.

## Decision matrix (tier + effort)

| Slice nature | Tier | Effort |
|---|---|---|
| Lookups, formatting, boilerplate, parallel read-only research, summarization, mechanical transforms | **fast** | `low` |
| Standard implementation, bug fix, single-area change, integration | **mid** | `medium`–`high` |
| Complex multi-file refactor, cross-module debugging, code review | **mid** | `high` |
| Architecture, cross-system coordination, high-stakes / irreversible judgment, hardest debugging, client-facing deliverables | **strongest** | `high`–`max` |

The effort ladder is `low` · `medium` · `high` · `xhigh` · `max`. Which levels a given model
accepts (some fold `xhigh` down to `high`) is instance-matrix content, carried in the instance's
tier-to-model map — not here.

## When to escalate to the strongest tier
- Reasoning across many files at once
- Architectural decisions with long-term impact
- Client-facing deliverables (proposals, reports)
- Debugging complex, multi-system issues

## When the fast tier is enough
- Batch operations with a clear pattern
- Simple file reads and searches
- Generating boilerplate
- Parallel read-only research fan-out

## Cost awareness
- **strongest**: highest cost — spend it on the bottom matrix row only.
- **mid**: the default for execution.
- **fast**: an order of magnitude cheaper — use for bulk/parallel/read-only work.

## Pairing with the loop

A slice's recommendation is part of a decision-complete plan (`framework/loop/planning.md`). The
default posture plans on the strongest tier and executes on the mid tier; a slice that needs the
strongest tier *for the build itself* must say so, or it will run mid. That is why plans name the
tier per slice. The concrete tier-to-model resolution — and any per-agent model pins that outrank
the tier default — are the instance's, not the framework's.
