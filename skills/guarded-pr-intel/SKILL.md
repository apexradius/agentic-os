---
name: guarded-pr-intel
description: Use for guarded PR intelligence pilots, Greptile/check-pr evaluation, or PR review automation where read-only mode is required before any write loop.
mcp_dependencies: mcp-github
user-invocable: true
disable-model-invocation: true
argument-hint: "[owner/repo#pr or PR URL]"
---

# Guarded PR Intelligence

Run a read-only PR intelligence pass before merge. This skill is the Apex guardrail around Greptile/check-pr/greploop-style workflows: inspect, score, and report first; do not mutate GitHub or code.

## Hard Gates

- Read-only only: no commits, pushes, review submissions, PR comments, thread resolution, labels, branch updates, or auto-fix loops.
- Never run Greploop or any tool command that can write to a branch unless a separate AORG task has explicit human approval for that exact repo, PR, branch, and write mode.
- Use only non-main head branches. Stop if the PR head branch is `main`, `master`, or a protected release branch.
- Do not read or print secrets. Do not invoke external paid services unless auth and billing scope are already approved for this PR.
- If Greptile/check-pr is unavailable or unauthenticated, complete the local GitHub-only read-only report instead of blocking the PR on vendor access.

## Inputs

Accept one of:
- `owner/repo#123`
- `https://github.com/owner/repo/pull/123`
- current repo plus PR number

## Steps

1. **Parse target**
   - Extract owner, repo, and PR number.
   - Confirm the PR exists and is open unless the user explicitly asks for a closed PR postmortem.

2. **Verify branch guard**
   - Read PR base/head refs.
   - Stop if head is `main`, `master`, `production`, `prod`, `release`, or a protected branch.
   - Confirm base branch and mergeability status.

3. **Collect read-only evidence**
   - PR title, author, body, labels, base/head refs, merge state.
   - Changed files and diff summary.
   - CI/check rollup and failing job URLs.
   - Existing review decisions and unresolved review comments.
   - Commit count and last pushed timestamp.

4. **Optional Greptile/check-pr evidence**
   - Use Greptile or imported `check-pr` only if the command is confirmed read-only for this invocation.
   - Capture score, findings, and unresolved comments.
   - Do not trigger auto-fix, apply patches, post comments, approve, request changes, or resolve threads.

5. **Score**
   - Correctness risk: logic, edge cases, regressions.
   - Security risk: auth, injection, secrets, unsafe dependencies.
   - Operational risk: deploy, migrations, background jobs, rollback.
   - Test adequacy: touched paths covered, failure cases present.
   - Review hygiene: PR body, CI status, unresolved comments.

6. **Report**
   - Verdict: `PASS`, `NEEDS_HUMAN_REVIEW`, or `BLOCKED`.
   - List findings with severity and file references where available.
   - Record exact commands/tools used and whether Greptile/check-pr was unavailable.
   - State whether write-loop escalation is allowed. Default is `no`.

## Output Format

```markdown
## Guarded PR Intel
- Target:
- Mode: read-only
- Verdict:
- Write-loop allowed: no

## Evidence
- Checks:
- Reviews:
- Diff:
- Optional Greptile/check-pr:

## Findings
- [severity] file:line - issue

## Required Before Merge
- ...
```

## Stop Conditions

- PR head branch is protected or mainline.
- Tool asks for credentials that are not already approved.
- Tool tries to write, comment, push, resolve, approve, or request changes.
- External review service would create billing or outbound side effects.

## Verification

- Confirm no GitHub write API was called.
- Confirm `git status --short` is unchanged after the review.
- Confirm the report includes the PR URL, commit SHA, and CI status source.
