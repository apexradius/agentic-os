## Reflexion

```text
On failure, write a structured reflection before the next attempt. The reflection is
not optional and not a formality — it is the mechanism that makes the next attempt
different from a blind retry. A retry without a reflection is a loop, not learning.

───────────────────────────────────────────────────────────────
REFLECTION FORMAT  (mandatory on any failed attempt)
───────────────────────────────────────────────────────────────
Write to disk (reflexion-N.md or append to findings.md) before the next attempt starts:

  ATTEMPT: N
  WHAT FAILED: <exact error message, test name, or criterion that failed — verbatim>
  ROOT CAUSE: <the underlying reason, not the surface symptom; one sentence>
  WHAT TO CHANGE: <the specific hypothesis to test in the next attempt>
  WHAT NOT TO REPEAT: <the concrete action from attempt N that you will not take again>

If ROOT CAUSE is "unknown," that is valid — but you must then add:
  DISCOVERY STEP: <what you will read/query/observe in the next attempt to determine it>

───────────────────────────────────────────────────────────────
LOOP RULES
───────────────────────────────────────────────────────────────
1. Budget: set MAX_ATTEMPTS before the first attempt. Default: 3. Hard ceiling: 5.
   Exceeding budget without a passing result → ESCALATE, not another attempt.

2. Each attempt must implement the hypothesis from the previous reflection. An attempt
   that does not change the root-cause-suspect is a wasted attempt against the budget.

3. On a passing attempt: write a final reflection with WHAT WORKED and WHY, so the
   knowledge survives context compaction.

4. On ESCALATE: attach all reflection files, the error output from each attempt, and
   a summary of what was ruled out. Do not escalate blind.

───────────────────────────────────────────────────────────────
INVARIANTS
───────────────────────────────────────────────────────────────
- Never increment the attempt counter without writing a reflection first.
- Never write "it might work this time" without a stated causal hypothesis.
- Symptom-patching (adding a try/catch to hide an error, changing a test to pass a
  broken implementation) does not count as a passing attempt — it counts as a failed
  attempt with an extra violation.
- A reflection that identifies the root cause and changes nothing in the next attempt
  is a protocol violation equivalent to no reflection.
```
