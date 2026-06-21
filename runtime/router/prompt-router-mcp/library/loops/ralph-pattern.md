## Ralph Pattern

```text
The Ralph Pattern runs a well-specified task repeatedly in a FRESH context per
iteration, externalizing all state to disk, until a mechanical done-condition fires or
a budget is exhausted. It is the safe continuous-loop pattern — the infinite-loop guard
is structural, not a reminder.

───────────────────────────────────────────────────────────────
SETUP  (once, before the first iteration)
───────────────────────────────────────────────────────────────
1. Define DONE_CONDITION: a boolean predicate evaluable from on-disk state alone,
   with no context required. Examples:
   - "all rows in work-queue.jsonl have status=done"
   - "target directory contains exactly N files with no .tmp extension"
   - "health endpoint returns {status: ok} with p95 < 200ms for 3 consecutive polls"

2. Define MAX_ITERATIONS: a numeric hard ceiling. If the loop hits MAX_ITERATIONS
   without DONE_CONDITION firing → ESCALATE immediately.

3. Define the STATE FILES: every piece of information the next iteration needs must
   live in a named file before the current iteration exits. No state in context.
   Canonical set: plan.md (static), progress.md (updated each iteration),
   findings.md (append-only log), work-queue.jsonl (work items with status fields).

4. Write state files to disk before starting the first iteration.

───────────────────────────────────────────────────────────────
ITERATION LOOP
───────────────────────────────────────────────────────────────
Each iteration (fresh context):

5. READ state files first. Current state = what is on disk. Do not assume continuity
   from a previous context. Do not trust memory.

6. CHECK DONE_CONDITION against current on-disk state.
   - If true → write final summary to findings.md, emit DONE verdict, exit loop.
   - If false → continue.

7. CHECK iteration count against MAX_ITERATIONS.
   - If count >= MAX_ITERATIONS → write escalation summary to findings.md,
     emit ESCALATED verdict, exit loop.

8. EXECUTE exactly the work unit defined for this iteration (from work-queue or plan).
   External state mutations must be atomic where possible (write to .tmp, rename).
   Never leave a partial write as a committed state.

9. UPDATE progress.md: increment iteration count, record what was done, record the
   current DONE_CONDITION evaluation result.

10. EXIT this iteration. The next iteration starts fresh from step 5.

───────────────────────────────────────────────────────────────
INVARIANTS
───────────────────────────────────────────────────────────────
- State lives on disk, never in context. An iteration that cannot reconstruct its
  state from disk alone is broken.
- The infinite-loop guard (MAX_ITERATIONS) is checked before work begins (step 7),
  not after. An iteration that starts work and then discovers it is over budget is
  a design violation.
- DONE_CONDITION must be evaluable without running the task — it reads output state,
  not intermediate process state.
- Never spin on a DONE_CONDITION that requires an external SLA (waiting for a
  third-party API to respond, waiting for a human). External waits get a
  timeout + escalation, not a polling loop.
```
