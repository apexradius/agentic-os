---
name: pr-review
description: "Review a PR with 3 parallel agents — correctness, security, performance. Use when reviewing pull requests, code review, or /pr-review."
user-invocable: true
disable-model-invocation: true
argument-hint: "[pr-number]"
---

# PR Review

Review a pull request with three parallel perspectives.

## Pre-Flight

Before launching agents, run these checks:

1. **Draft check** — `mcp__github__get_pull_request`: if `draft: true`, warn user and ask whether to proceed or wait.
2. **CI status** — `mcp__github__get_pull_request_status`: if checks are failing or pending, warn user with failing check names. Proceed with review but note CI state in summary.
3. **Size guard** — `mcp__github__get_pull_request_files`: count total additions + deletions.
   - If >1000 lines changed: group files by directory/module, recommend splitting into logical PRs, then review in groups (one agent pass per group) rather than one monolithic pass.
   - If <=1000 lines: proceed normally.

## Steps

1. **Get PR data via GitHub MCP**:
   - `mcp__github__get_pull_request` with owner, repo, and pull_number from `$ARGUMENTS` — get PR metadata (title, description, base/head branches, author)
   - `mcp__github__get_pull_request_files` with owner, repo, and pull_number — get all changed files with diffs
   - `mcp__github__get_pull_request_reviews` with owner, repo, and pull_number — check for existing reviews to avoid duplicate feedback
   - `mcp__github__list_commits` with owner, repo, sha (head branch) — get all commits in the PR, not just the latest
2. **Filter files** — skip auto-generated content unless this is a test-only PR:
   - Skip: lockfiles (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`), `.min.js`, `dist/`, `vendor/`, `build/`, `.map` files
   - Skip: test fixtures/snapshots UNLESS the PR only touches test files
   - Review all remaining files against ALL commits in the PR
3. **Launch 3 agents in parallel:**

### Agent 1: Correctness
- Logic errors, off-by-one, null handling
- Missing edge cases
- Broken existing functionality
- Missing validation at system boundaries
- Review against all commits — catch issues introduced and then partially fixed within the PR

### Agent 2: Security
- Injection vulnerabilities (SQL, XSS, command)
- Exposed secrets or credentials
- Auth/authz bypass
- Insecure dependencies

### Agent 3: Performance
- N+1 queries or redundant API calls
- Unnecessary re-renders (React) or recomputation
- Memory leaks, missing cleanup
- Hot-path bloat

4. **Conflict arbiter** — when agents disagree or findings conflict:
   - Security wins over performance (never sacrifice security for speed)
   - Correctness wins over style (working code > pretty code)
   - Security vs correctness conflict → escalate to user with both perspectives
5. **Aggregate findings** with severity (critical/high/medium/low)
6. **Generate structured review**:

### Output Format
```
## Summary
[1-2 sentence overview of what the PR does and overall assessment]

## Critical Issues
[Must-fix before merge. Each with file:line, description, suggested fix]

## Suggestions
[Would improve but not blocking. Each with file:line, description, rationale]

## Questions
[Things the reviewer doesn't understand or wants the author to clarify]
```

**Tone**: Constructive, specific, senior peer-programmer voice. No snark. Every criticism comes with a fix or alternative. Acknowledge good patterns when spotted.

7. **Submit review** via `mcp__github__create_pull_request_review` with:
   - owner, repo, pull_number
   - event: `APPROVE` (no issues), `REQUEST_CHANGES` (critical/high findings), or `COMMENT` (medium/low findings only)
   - body: the structured review from Step 6
   - Confirm with user before submitting `REQUEST_CHANGES` or `APPROVE`

## Error Handling
- GitHub MCP tools (`get_pull_request`, `get_pull_request_files`, `get_pull_request_reviews`, `create_pull_request_review`): retry once after 2s, again after 5s, skip after 3 failures.
- If `get_pull_request_files` returns empty: verify the PR number is correct and the PR has commits.
- If `create_pull_request_review` fails: fall back to posting review as a PR comment via `mcp__github__add_issue_comment`.
- If any MCP tool returns unexpected data: re-read this skill SOP to verify correct tool was called with correct parameters.
- Never proceed with flawed data — flag the issue and continue with the next step.

## Constraints
- Do not modify files outside the scope of this skill
- Do not add dependencies without explicit approval
- Do not skip the verification step
- Do not submit `APPROVE` or `REQUEST_CHANGES` without confirming with user first

## Verify
- Confirm `mcp__github__get_pull_request_files` returned the expected file list before starting agent analysis.
- After submitting review: run `mcp__github__get_pull_request_reviews` to confirm the review was posted successfully.
- Verify the review event type matches the severity of findings (REQUEST_CHANGES for critical/high, COMMENT for medium/low, APPROVE for clean).
