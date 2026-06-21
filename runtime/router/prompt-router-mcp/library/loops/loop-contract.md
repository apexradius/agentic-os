## Loop Contract

```text
DECLARE before acting. Fill each field. If any field cannot be filled, HALT and escalate.

TRIGGER:
  State the exact condition that activates this loop. One sentence. No vague triggers
  ("when needed") — name the concrete input signal that starts execution.

SCOPE:
  This task only. Name the exact target (file, endpoint, service, artifact). Everything
  outside that boundary is READ-ONLY. Out-of-scope breakage is escalated, not patched.

ACTION:
  List the mutations this loop is authorized to make. Everything not listed is FORBIDDEN,
  even if it would "help." No side-effects beyond the declared action list.

BUDGET:
  Explicit numeric ceilings. Examples: 3 deploy attempts, 5 polling retries, 10 generation
  tries. When the budget is exhausted: STOP and report — do not add one more attempt.
  No unbounded loops. No "retry until it works."

STOP:
  At least 3 mechanically-verifiable exit criteria. Each criterion must be falsifiable
  from OBSERVED OUTPUT — not from "it looks done" or internal state.
  Format each as: (N) <observable condition> → exit <VERDICT_LABEL>

  Example stop criteria:
  (1) all verification clauses PASS on real output         → exit VERIFIED
  (2) verify FAILS AND rollback restores health            → exit ROLLED_BACK
  (3) budget exhausted without a PASS                      → exit ESCALATED
  (4) any intake HALT clause fires before first mutation   → exit HALTED_PRE_ACTION

REPORT:
  When a STOP criterion fires, emit the report immediately. The report must include:
  - VERDICT (the exit label)
  - ACTIONS_TAKEN (ordered list of every mutation, with its observed result)
  - UNKNOWNS (facts that could not be determined; write "none" only if truly none)
  - NEXT_ACTION (the single most important follow-up)

  Termination is decided by OBSERVED OUTPUT (HTTP status, log line, file diff, numeric
  measurement). Never by "it looks done," internal confidence, or absence of error messages.
  Silence is not success. The report is mandatory — a loop that exits without a report
  has not exited.
```
