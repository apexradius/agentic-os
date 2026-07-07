---
name: adversarial-verify
description: Independently refute deliverable done-claims before ship or during disputes. Use when a claim-set needs evidence-backed adversarial verification.
---

# Adversarial Verify

Use this when a deliverable's "done" claims need independent verification for a code change,
deployment, report, handoff, or dispute.

## Inputs

- Claim-set: the closeout, report, or prose claims being verified.
- Artifact paths: files, logs, screenshots, reports, packets, traces, or build outputs the
  claimant cites.
- Diff: the exact change under verification, or an explicit honest-absence marker if no diff
  exists.

## Procedure

1. **Establish independence.** Treat the claimant as untrusted for this pass. Do not verify
   your own work; if you authored the deliverable, hand the verification to an independent lane.
2. **Run the deterministic floor first.** Execute every machine-checkable gate before any judge:
   tests, validators, linters, schema checks, diff checks, replay scripts, shape checks, and
   build commands. A mechanical red is already a fail; do not ask a judge to overrule it.
3. **Build the evidence packet.** Put every cited artifact into the packet, not just a pointer
   to it. F30 requires evidence-complete packets. Apply the configured per-file cap, record any
   truncation, and add an explicit honest-absence marker for every expected artifact that is
   missing.
4. **Convert claims into refutation targets.** Rewrite each done-claim as a falsifiable target:
   what would prove it false, what evidence should exist, and which probe would settle it.
5. **Judge refute-first.** Ask the judge to refute each claim, not confirm it. The claimant
   carries the burden of proof. A claim with no persisted evidence remains unproven.
6. **Run order-swap presentations.** Present the packet twice: candidate-first then
   baseline-first, or claim-first then evidence-first. If the verdict changes, escalate to
   artifact verification by hand. Never average split presentations.
7. **Enforce cross-family review.** The judge model must not share the candidate's model
   family. A same-family PASS is provisional until a cross-family judge or hand verification
   confirms the passing dimensions.
8. **Classify every finding.**
   - `fixed`: requires the executed probe artifact that proves the fix.
   - `ruled-non-defect`: requires an executed probe under F35 and F40; a source citation is not
     a probe.
   - `recorded`: use when the finding is real but cannot be fixed or settled in this scope.
9. **Render the verdict.** PASS only when every claim survives refutation with persisted
   evidence. Otherwise return FAIL, SPLIT, or RECORDED with the exact next artifact needed.
   Splits have one escalation path: inspect the cited artifacts and probes directly.

## Constraints

- Never verify your own work; independence is part of the proof boundary.
- Never accept prose-only proof. F34 requires persisted proof artifacts cited by path.
- Never let a judge ratify exposure, rollout, access, or operator-risk decisions. F41 and R7
  make those operator calls, outside the judge's authority.
- Never average split judges or split order-swap outcomes. Escalate to direct artifact
  verification.
- Never trim the packet silently to fit. Cap per file, mark truncation, and preserve honest
  absence markers for missing evidence.
- Never treat a source-line citation as a probe. F40 requires an executed artifact; F35 requires
  dismissal to be backed by a probe.

## Verify

The output is a verification report that is itself F34-conformant:

```markdown
# Verification Report

## Deterministic floor
- Gate: [command or check] -> [pass/fail] -> [artifact path]

## Claims
| Claim | Evidence ref | Probe ref | Verdict |
|---|---|---|---|
| [claim] | [packet path or absence marker] | [executed probe path] | PASS/FAIL/SPLIT/RECORDED |

## Verdict
[PASS only if every claim survives refutation with persisted evidence.]

## Escalation
[For SPLIT: exact artifacts to inspect by hand and the decision rule.]
```
