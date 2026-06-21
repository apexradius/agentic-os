---
name: refactor
description: "Refactor code with specific patterns — extract function, split component, remove duplication, simplify conditionals. Use when refactoring, cleaning up code, reducing complexity, or /refactor."
user-invocable: true
argument-hint: "[pattern] [file-path]"
---

# Refactor

## Supported Patterns
- **extract-function** — Pull logic into a named function
- **split-component** — Break a large component into focused sub-components
- **remove-duplication** — Unify near-duplicate code blocks
- **simplify-conditionals** — Flatten nested if/else, use early returns, guard clauses
- **extract-constants** — Replace magic numbers/strings with named constants
- **introduce-types** — Add TypeScript types to untyped code
- **consolidate-imports** — Clean up import statements

## Rules
- Read target code first — understand before changing
- Verify no behavior change (same inputs → same outputs)
- One pattern per invocation — don't combine
- Preserve existing tests — they should still pass
