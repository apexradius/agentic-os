---
name: code-health
description: "Score a codebase on complexity, test coverage, duplication, dependency freshness, type safety (0-100). Use when assessing code quality, measuring tech debt, or /code-health."
user-invocable: true
argument-hint: "[optional-path-scope]"
---

# Code Health

Generate a health score for the codebase.

## Metrics (weighted)

| Metric | Weight | How to check |
|--------|--------|-------------|
| Complexity | 25% | Nesting depth >4, functions >50 lines, files >300 lines |
| Test coverage | 25% | Ratio of test files to source files, critical paths tested |
| Duplication | 20% | Near-duplicate code blocks, copy-paste patterns |
| Dependency freshness | 15% | `npm outdated`, known CVEs |
| Type safety | 15% | `any` usage, missing generics, unsafe casts |

## Steps
1. **Scan** files with Glob/Grep for each metric
2. **Score** each category 0-100
3. **Calculate** weighted total
4. **Recommend** top 5 improvements ordered by impact

## Output
```
Code Health Score: 72/100
  Complexity:    80/100 ✓
  Test Coverage: 45/100 ✗ (critical gap)
  Duplication:   85/100 ✓
  Dependencies:  70/100 ⚠
  Type Safety:   80/100 ✓

Top 5 Improvements:
1. Add tests for src/api/ (0 test files, 12 source files)
...
```
