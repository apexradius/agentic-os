---
name: model-router
description: "Decision framework for Opus vs Sonnet vs Haiku model selection — task-type mapping, cost/performance tradeoffs. Use when choosing which AI model to use for a task."
---

# Model Router — Task-to-Model Mapping

## Decision Matrix

| Task Type | Model | Why |
|-----------|-------|-----|
| Complex architecture, planning, multi-file refactors | **Opus** | Needs deep reasoning, long context |
| Bug fixes, feature implementation, code review | **Sonnet** | Good balance of speed + quality |
| Simple lookups, formatting, repetitive tasks | **Haiku** | Fast, cheap, sufficient |
| AI image generation prompts, creative writing | **Opus** | Better prompt crafting |
| Git operations, file management, CLI tasks | **Sonnet** | Standard operations |
| Subagent tasks (research, explore) | **Sonnet/Haiku** | Parallel, cost-effective |

## Cost Awareness
- Opus: highest cost, use for tasks that justify it
- Sonnet: default for most work
- Haiku: 10x cheaper than Opus, use for bulk/parallel operations

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
