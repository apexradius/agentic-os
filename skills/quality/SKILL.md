---
name: quality
description: "Structural code review — architecture, patterns, complexity, maintainability. Not testing (use /dev-ship). Use for /quality, code review, or reviewing a PR."
user-invocable: true
---

# Quality — Code Review

Structural review of code for architecture, patterns, and maintainability. Complementary to `/dev-ship` (which runs lint/test/security). This skill reads and analyzes — it does not run commands.

## Review Dimensions

### 1. Architecture
- Single responsibility: does each module do one thing?
- Dependency direction: are dependencies flowing the right way?
- Abstraction level: is the right amount of abstraction used (not too much, not too little)?
- Separation of concerns: business logic vs. I/O vs. presentation

### 2. Code Patterns
- Consistency: are similar things done the same way throughout?
- Error handling: are errors caught, logged, and surfaced appropriately?
- Naming: do names reveal intent? Are conventions consistent?
- DRY violations: duplicate logic that should be extracted

### 3. Complexity
- Functions over 50 lines — flag for splitting
- Cyclomatic complexity: deeply nested conditionals, long switch/match chains
- God objects: classes/modules doing too many things
- Dead code: unreachable branches, unused exports

### 4. Maintainability
- Would a new developer understand this code in 10 minutes?
- Are edge cases handled or at least documented?
- Are magic numbers/strings extracted as constants?
- Is the public API surface minimal and intentional?

### 5. AI Failure Modes (the four that AI-written code reliably hits)
- **Wrong assumptions** — does the code assume an API shape, file, or invariant nobody verified? Name the assumption; demand the check.
- **Overcomplexity** — solving a more general problem than asked (premature abstraction, config for a single caller). Cut to the case actually in front of you.
- **Orthogonal edits** — changes unrelated to the stated goal riding along in the diff. Flag them out; one fix per commit.
- **Imperative over declarative** — hand-rolled loops/branches re-implementing what a declarative construct (map/filter, a schema, a query, a lookup table) states directly. Prefer the declarative form.

When most code under review is AI-drafted, this lens is the highest-yield pass — these four account for the bulk of "works but wrong" findings.

## Output

```markdown
# Code Review: [scope]
**Verdict**: CLEAN / NEEDS WORK / SIGNIFICANT CONCERNS

## Findings (by severity)
### Blockers
- [none, or itemized]

### Recommendations
- [actionable items with file:line references]

### Observations
- [non-blocking notes, patterns noticed]

## Strengths
- [what's done well — always include this]
```

## Rules

- Always cite file and line references for findings
- Always include strengths — review is not just criticism
- Score findings by ICE (Impact x Confidence x Ease) to prioritize
- This skill does NOT run lint, tests, or security scans — use `/dev-ship` for that

## Anti-Patterns

- Reviewing generated/vendored code as if it were authored code
- Suggesting refactors that don't serve a concrete goal
- Nitpicking style when a linter should handle it
