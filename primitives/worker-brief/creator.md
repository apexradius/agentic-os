# Worker Brief Creator

Use this when composing a brief to fan work out to a cold worker — and when defining the return
contract that worker owes back. The goal is a brief that lets a worker with zero conversation
history do the task correctly on the first pass, and a return that comes back as a summary, not a
transcript.

## Inputs

- The objective — the outcome, stated as a result, not a list of steps.
- The context the worker needs to start cold: files, prior decisions, data pointers.
- The boundaries: what must NOT be touched, the scope fence, invariants to hold.
- The definition of done (the verify bar).
- The shape of the answer you want back.

## Steps

1. **State the objective as an outcome.** "Add a timeout param to fetchData()", not "open the file
   and edit line 12". The worker owns the how.
2. **Make the inputs self-contained.** Assume no memory of this conversation. Name every file, paste
   every load-bearing constraint, link every source. A gap here becomes a wrong guess downstream.
3. **Draw the fence in `constraints`.** List what NOT to touch and the invariants to preserve. At
   least one — an unbounded worker broadens scope. This is where "do not touch the retry layer" or
   "keep default behavior unchanged" lives.
4. **Set the stance.** Tell the worker to verify before reporting, to treat its own output
   skeptically, and to flag deviations rather than absorb them. The stance is what makes a cold
   worker behave like a careful one.
5. **Write the verify bar — required.** Pick the flavor by brief type:
   - **Build brief** → an executable check: `npm test -- net passes`, `validate.mjs --all green`.
   - **Recon brief** → a deliverable bar: "a WIRING covering the artifact set, the field split, and
     the verify bar". A brief with no definition of done is rejected by the validator.
6. **Declare the return contract.** `required_fields` must include `summary`; set `summary_max_chars`
   to the ceiling you want (a character proxy for ~1–2K tokens). The worker returns those fields and
   nothing else — no reasoning trace, no tool log.
7. **Render and dispatch.** `renderBrief(brief)` (render.mjs) composes the prompt text. When the
   return comes back, `validateReturn(doc, brief.return_contract)` checks it before you synthesize.
8. **Validate the brief** with `validate.mjs` (or pass the file as a target) before sending.

## Anti-patterns

- **A brief with no verify bar.** The worker cannot know when it is done, so it stops early or
  overreaches. Required for a reason.
- **Inputs that assume shared context.** "Fix the bug we discussed" means nothing to a cold worker.
- **An unbounded brief.** No `constraints` invites scope creep — the worker fixes "while I'm here".
- **A return that carries the trajectory.** The whole point of fanning out is that only the summary
  comes back. The schema rejects a `trajectory`/`tool_log` field; don't try to smuggle one into an
  optional field either.
- **Worker-to-worker coordination.** Workers never talk to each other. Information crosses only up to
  the orchestrator and back down as a new brief.
