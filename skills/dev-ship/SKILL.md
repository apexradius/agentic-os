---
name: dev-ship
description: "Pre-merge quality gate — lint, test, security scan. Reports pass/fail, no git ops. Use for /dev-ship or checking if code is ready to ship."
user-invocable: true
---

# Dev-Ship — Pre-Merge Quality Gate

Runs all quality checks and reports pass/fail. Does NOT commit, push, or create PRs. Use this to validate code before running `/ship` or `/release`.

## Checks (run in parallel where possible)

### 1. Lint
- Detect and run project linter (ESLint, Ruff, Biome, Pylint, etc.)
- Report: error count, warning count, files affected

### 2. Tests
- Run full test suite
- Report: pass/fail count, coverage % if available
- Flag any skipped or pending tests

### 3. Security Scan
- Hardcoded secrets: `grep -rn` for API keys, tokens, passwords in source
- Dependency vulnerabilities: `npm audit` / `pip audit` / equivalent
- OWASP basics: SQL concatenation, innerHTML, missing auth checks on routes
- Report: critical / warning / info counts

## Output

```
Quality Gate: PASS / FAIL
-----------------------------
Lint:     PASS (0 errors, 2 warnings)
Tests:    PASS (42/42, 87% coverage)
Security: WARN (0 critical, 1 warning)
-----------------------------
Details: [itemized findings]
Next: Run /ship (low-risk) or /release (production)
```

## Rules

- This skill never modifies files, commits, or pushes
- FAIL = any lint error, any test failure, or any critical security finding
- WARN = non-critical security findings or low coverage
- Always recommend `/ship` or `/release` as the next step based on risk level

## Anti-Patterns

- Running this after already committing — run it before
- Ignoring WARN findings — review them even if gate passes
