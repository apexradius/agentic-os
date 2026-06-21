---
name: test-gen
description: "Generate unit/integration tests matching existing test patterns and framework (Vitest, Jest, Playwright). Use when writing tests, adding test coverage, or /test-gen."
user-invocable: true
argument-hint: "[file-path]"
---

# Test Gen

Generate tests for a file or function.

## Steps
1. **Detect test framework** — Check package.json for vitest, jest, playwright, @testing-library
2. **Find existing test patterns** — Read 1-2 existing test files to match: import style, describe/it structure, assertion library, mock patterns
3. **Analyze target file** — Identify functions, edge cases, error paths, happy paths
4. **Generate tests** covering:
   - Happy path (expected inputs → expected outputs)
   - Edge cases (empty, null, boundary values)
   - Error paths (invalid input, network failure, missing data)
   - For components: render test, interaction test, accessibility test
5. **Place test file** in correct location (colocated or `__tests__/` per project convention)

## Rules
- Match project's test naming: `*.test.ts`, `*.spec.ts`, etc.
- Don't mock what you can test directly
- Prefer `toEqual` over `toBe` for objects
- One assertion concept per test
