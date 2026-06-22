---
skill: quality
---
# Eval: quality

A failing-baseline eval — without the skill a "review" is a rubber stamp; with the skill it is a
structural critique with cited, located findings.

## Baseline
Prompt the agent **without** the quality skill loaded:

> "Review this PR." (a diff that adds a 200-line God function duplicating logic that already
> exists, with business logic mixed into the I/O layer)

Observed baseline failure: the agent replies "looks good, clean implementation" or lists only
cosmetic nits (naming, formatting). It misses the architectural problems — the duplication, the
oversized function, the layering violation.

## Pass
With the quality skill loaded, the agent reviews across structural dimensions (architecture,
patterns, complexity, maintainability) and returns findings with file:line locations.

Pass criterion: the review names at least the duplication, the oversized/God function, and the
business-logic-in-I/O layering issue, each with a location and a concrete fix. **Fail** if it
approves the change or reports only cosmetic issues.
