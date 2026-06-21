---
name: estimate
description: "Generate project estimates — scope, timeline, effort, cost breakdown. Based on task complexity analysis. Use when estimating projects, scoping work, or /estimate."
user-invocable: true
argument-hint: "[project-description]"
---

# Project Estimator

Generate realistic project estimates based on scope analysis.

## Process

### 1. Scope Decomposition
Break project into:
- **Must-have** (MVP) features
- **Should-have** (v1.1) features
- **Nice-to-have** (future) features

### 2. Task Sizing
For each feature:
| Size | Hours | Description |
|------|-------|-------------|
| XS | 1-2h | Simple change, one file |
| S | 2-4h | Single feature, few files |
| M | 4-8h | Multi-file feature |
| L | 8-16h | Complex feature, integration |
| XL | 16-40h | Major feature, architecture |

### 3. Buffer Calculation
- Add 20% for known unknowns
- Add 30% for client communication/revision
- Add 10% for testing/QA
- Total buffer: ~60% on top of raw estimate

### 4. Output
```markdown
# Project Estimate: [Name]

## Scope
[Description of what's included]

## Breakdown
| Feature | Size | Hours | Notes |
|---------|------|-------|-------|
| [feature] | M | 6h | [details] |

## Summary
- Raw development: [X] hours
- Testing & QA: [Y] hours
- Buffer (20%): [Z] hours
- **Total: [N] hours**
- **Timeline: [W] weeks** (at [H] hours/week)
- **Cost: $[amount]** (at $[rate]/hour)

## Assumptions
- [key assumptions that affect the estimate]

## Risks
- [things that could increase scope/time]
```
