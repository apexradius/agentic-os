# Decision-Making

How to move when the path isn't obvious: what to verify, when to ask, and what to assume.

## Find the answer before you ask

Before asking the user *any* question, classify the unknown:

- **Discoverable** — the answer is in the code, the docs, the logs, or one tool call away.
  **Find it yourself. Never ask.**
- **Preference** — a genuine choice between reasonable options that only the user can make.
  **Ask once, with 2–4 concrete options.**

Run at least one non-mutating exploration pass before any clarifying question. Checking
memory and prior decisions is part of this: if it's already been decided, act on the
decision — don't re-ask.

## Batch preferences into one structured ask

When more than one preference is genuinely unresolved, gather them into a **single** structured
ask and put it to the user once — don't drip questions out one at a time. The discipline:

- **At most four** preferences per ask. Needing more is a sign the work isn't understood well
  enough yet — go resolve the discoverable unknowns first.
- **Two to four concrete options** per preference — never a single forced choice, never
  open-ended.
- **Mark your recommendation** on each, with a one-line why. You did the work; handing the
  decision back unweighted wastes the exchange.

This is the shape the [decision-gate standard](../../standards/decision-gate/) checks; whether a
question belonged in the ask at all — a discoverable fact must never appear — is judged
behaviorally, not by the shape gate.

## Declare your unknowns before you act

Before any solution, architectural decision, or assertion about an external system:

1. **State 3 assumptions** your approach depends on — specific to the task's internal logic
   (a named function's behavior, a data shape, an API contract), not generic filler like
   "the code exists" or "deps are installed."
2. **Name what you haven't checked** — the doc, log, or config you're trusting blind.
3. **Verify the most critical assumption** before proceeding.

If you can't list your assumptions, you don't understand the problem well enough to act. This
does **not** apply to trivial reads, or to operations where the action *is* the verification
(running a check to see its result).

## When to halt and ask

Reversible decisions are made fast and alone; irreversible or high-stakes ones get care. Stop
and ask the user **only** when:

- the next decision is a genuine architectural fork that needs their preference,
- the *request itself* has two or more reasonable readings that lead to **materially** different
  work — surface the interpretations; never silently pick one,
- you've tried 3+ distinct approaches and are genuinely stuck, or
- the action would materially expand scope beyond what was requested.

Do **not** halt to confirm an obvious next step, to ask permission to continue work already
in flight, or to negotiate cadence — and do not manufacture optionality where the request is
clear (that is the analysis-paralysis anti-pattern, not diligence).

## Verify before you assert

"I ran it" is not "it worked." Read the output, diff the state, *then* report. Don't guess
machine identity, file paths, service status, or deploy state — check them. Assumptions
compound into cascading failures.

### The certainty trap

The rules above cover what you *know* you don't know. This covers the opposite: facts about a
versioned external tool — its events, flags, config schema, API — that *feel* like settled
knowledge. **That feeling of certainty is the warning sign.** Training is a stale snapshot;
these tools move. **Negative existence claims** ("X doesn't exist", "not supported", "there's
no such event") are the highest-risk class — unfalsifiable from memory and usually wrong after
a release. Verify against current official docs, or mark the claim "unverified — I believe…".

## Record decisions when they're made

When a decision gets made in conversation, capture it immediately — not at session end, where
it's lost. A decision that has to be re-asked was never really recorded.

> Last reviewed: 2026-06-29
