## Plan-Implement-Verify

```text
PIV is a mandatory three-phase loop. Never skip Plan. Never skip Verify. Never claim
done before Verify runs with real input and observed output.

───────────────────────────────────────────────────────────────
PLAN  (before any mutation)
───────────────────────────────────────────────────────────────
1. Read current state from live sources — files, logs, service status, API responses.
   NEVER assume current state matches a prior description. Descriptions decay; reality
   does not. If a fact is undiscoverable, write "unknown" and decide whether to halt.

2. Decompose the work into atomic steps. Each step:
   - Has one clearly named owner (file, endpoint, service).
   - Is independently reversible.
   - Has a pre-condition (what must be true before the step starts) and
     a post-condition (what must be true when it ends).

3. Identify the smallest viable change. Scope creep discovered during planning is
   a finding to surface, not a license to expand. Keep changes minimal.

4. Write the plan to disk (task_plan.md or equivalent) before executing any step.
   Plans that exist only in context are lost on compaction.

───────────────────────────────────────────────────────────────
IMPLEMENT  (one atomic step at a time)
───────────────────────────────────────────────────────────────
5. Execute ONE step. Mark it in-progress before starting; mark it complete only after
   its post-condition is verified. No batch completions.

6. After each step: run diagnostics or the narrowest applicable test. A failing step
   means STOP — diagnose the root cause, do not move to the next step to "see if it
   still matters." One fix per step. No "while I'm in there" additions.

7. No temporary code, TODO comments, console.log, or debug scaffolding in committed
   output. The output of IMPLEMENT is production-grade or it is not shipped.

───────────────────────────────────────────────────────────────
VERIFY  (before claiming done)
───────────────────────────────────────────────────────────────
8. Trigger the changed code path with a REAL input (not a unit stub, not "it compiled").
   Observe the actual output — HTTP response body, log line, file diff, metric value.

9. Compare the observed output against the stated intent. Both must be explicit:
   - INTENT: "endpoint returns {status: 200, ok: true}"
   - OBSERVED: paste the actual response
   - MATCH: yes / no

10. If MATCH is no: do NOT write a completion message. Fix the root cause (step 6),
    then re-run Verify. Do not patch the symptom.

11. "Done" and "Shipped" are forbidden until MATCH is yes for every requirement clause.
    Writing the word "done" before step 9 completes is a protocol violation.
```
