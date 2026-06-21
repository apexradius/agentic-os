## Planner-Generator-Evaluator

```text
Separation of powers: the generator does NOT grade its own output. A distinct evaluator
checks every output against explicit pass criteria before the loop advances. Self-
affirmation bias ("looks good to me") is the failure mode this pattern eliminates.

───────────────────────────────────────────────────────────────
PLANNER  (role: define the task and success criteria)
───────────────────────────────────────────────────────────────
1. Define the task in terms of its OUTPUT CONTRACT, not its process:
   - What does a passing output look like? (concrete, measurable, falsifiable)
   - What does a failing output look like? (at least 2 failure modes named explicitly)
   - What is the budget? (max attempts before ESCALATE)

2. Enumerate the pass criteria as a checklist. Each criterion must be evaluable from
   the output text alone — no inference, no "spirit of the requirement." Write them
   so a different agent could grade them consistently.

3. Write the task definition and pass criteria to disk before generation starts.

───────────────────────────────────────────────────────────────
GENERATOR  (role: produce output; do not evaluate)
───────────────────────────────────────────────────────────────
4. Read the task definition and pass criteria. Generate exactly what was specified.
   Do not add unrequested content. Do not self-evaluate ("this looks correct" is
   prohibited output from the generator).

5. Tag the output with attempt number: "ATTEMPT N of MAX_N".

6. Hand the output to the Evaluator. The generator's turn ends here.

───────────────────────────────────────────────────────────────
EVALUATOR  (role: grade against criteria; do not generate)
───────────────────────────────────────────────────────────────
7. Grade each pass criterion independently: PASS or FAIL, with a one-line reason.
   No partial credit. No averaging. If one criterion fails, the output fails.

8. If ALL criteria PASS → emit verdict ACCEPTED, include attempt number and the
   full grade sheet. Loop exits.

9. If ANY criterion FAILS → emit verdict REJECTED, include the complete grade sheet
   listing every criterion with PASS/FAIL and the failure reason. Do NOT suggest a
   fix — that is the generator's job. Hand control back to the Generator with the
   grade sheet as context.

10. If attempt N equals MAX_N and the verdict is still REJECTED → emit ESCALATED with
    the last grade sheet and all attempt outputs attached. Loop exits; do not generate
    attempt N+1.

───────────────────────────────────────────────────────────────
INVARIANTS
───────────────────────────────────────────────────────────────
- The same agent instance must not play both Generator and Evaluator in the same
  iteration. If only one agent is available, enforce the role boundary with explicit
  role-switching: complete the Generator turn fully before starting the Evaluator turn,
  and never let the evaluation pass criteria be modified by the generator mid-loop.
- The pass criteria are SET by the Planner and FROZEN at the start of generation.
  The Evaluator cannot relax them. The Generator cannot amend them.
- Every loop iteration must produce a written grade sheet on disk so the loop is
  resumable after context compaction.
```
