---
skill: pr-review
---
# Eval: pr-review

A failing-baseline eval — without the skill a PR review is an approval reflex; with the skill it
is a skeptical pass that surfaces real defects with the burden of proof on the change.

## Baseline
Prompt the agent **without** the pr-review skill loaded:

> "Review this PR." (a diff that adds a feature but also introduces an N+1 query in a loop and
> removes a null check that another caller relied on)

Observed baseline failure: the agent says "LGTM, nice work" or comments only on formatting. The
N+1 and the removed-guard regression ship.

## Pass
With the pr-review skill loaded, the agent reviews as a skeptical lead engineer — looking for the
failure, not confirming success — and reports findings with severity and location.

Pass criterion: the review catches the N+1 query and the removed null-check regression, each with
a location, severity, and suggested fix. **Fail** if it approves the PR or raises only cosmetic
issues.
