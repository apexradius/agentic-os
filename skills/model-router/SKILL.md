---
name: model-router
description: "Decision framework for Opus vs Sonnet vs Haiku model selection — task-type mapping, cost/performance tradeoffs. Use when choosing which AI model to use for a task."
---

# Model Router — Task-to-Model Mapping

The canonical reference for **which model tier and effort level** a slice of work should run on.
Plans cite this table when they declare a per-slice recommendation (see the `plan` skill and
`framework/loop/artifacts.md`). Tiers are aliases that resolve to the current model — today:
**`opus` → Opus 4.8 · `sonnet` → Sonnet 4.6 · `haiku` → Haiku 4.5**.

## Decision Matrix (tier + effort)

| Slice nature | Tier | Effort | Why |
|---|---|---|---|
| Lookups, formatting, boilerplate, parallel read-only research | **Haiku** | `low` | Fast, cheap, subagent-friendly |
| Standard implementation, bug fix, single-area change, CLI/git ops | **Sonnet** | `medium` | The `opusplan` execution default |
| Complex multi-file refactor, cross-module debugging, integration, code review | **Sonnet** | `high` | Strong without Opus cost |
| Architecture, cross-system coordination, high-stakes / irreversible judgment, hardest debugging, client-facing deliverables | **Opus** | `xhigh` (`max` for frontier) | Deep reasoning earns the cost |

> **Sonnet has no `xhigh`** — it supports `low/medium/high/max`, and `xhigh` silently folds to
> `high`. Never write "Sonnet · xhigh" in a plan; write "Sonnet · high".

## `opusplan` default (how this pairs with the loop)

The session default is the `opusplan` alias: **Opus in plan mode, Sonnet on execution.** A plan is
authored by Opus; execution then runs on Sonnet *unless* a slice's recommendation above says
otherwise. A slice tagged **Opus** is the signal to switch (`/model opus`, or dispatch an Opus-tier
subagent) for that slice only, then return to Sonnet. This is why plans must name the tier per
slice — `opusplan` will not auto-pick Opus for hard *execution* work.

## Cost Awareness
- Opus: highest cost, use for the slices that justify it (the bottom matrix row)
- Sonnet: default for execution
- Haiku: ~10x cheaper than Opus, use for bulk/parallel/read-only operations

## When to Escalate to Opus
- Task requires reasoning across 10+ files
- Architectural decisions with long-term impact
- Client-facing deliverables (proposals, reports)
- Debugging complex multi-system issues
- Creative content that represents the brand

## When Haiku is Enough
- Running theme check across repos
- Simple file reads and searches
- Generating boilerplate
- Batch operations with clear patterns
