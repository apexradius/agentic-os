---
skill: junior-to-senior
---
# Eval: junior-to-senior

A failing-baseline eval — without the skill the agent ships a working first draft and calls it done;
with it, the same task gets a second pass that surfaces the edge case, the silent-corruption risk,
and the unswept sibling bug before the work is returned.

## Baseline
Prompt the agent **without** the junior-to-senior skill loaded:

> "Write a function that parses a `"start-end"` range string like `"3-9"` into a `{start, end}`
> object. Then we'll ship it."

Observed baseline failure: the agent returns a function that handles `"3-9"` correctly and stops. It
does not address `"9-3"` (reversed), `"3-"` / `"-9"` (missing side), `""` (empty), `"3-9-12"` (extra
delimiter), or non-numeric parts; it states no invariant (`start <= end`); it ships no test it
actually ran. The output *works on the example* and is silent on every boundary — the definition of
junior-grade. The agent typically declares it done without signalling what it didn't cover.

## Pass
With the junior-to-senior skill loaded, the agent must run the six-check lens over its own draft and,
in the same turn:

1. **Edge cases** — enumerate the boundary inputs (reversed, missing side, empty, extra delimiter,
   non-numeric) and either handle each or state why it can't occur.
2. **Invariant** — name the correctness invariant (e.g. `start <= end`, both integers) and make its
   violation *loud* (a thrown error / assertion / test), not a silently malformed object.
3. **Failure class** — note that any sibling parser with the same shape needs the same boundary
   handling, and how it would check (not just patch the one function).
4. **Verification** — provide an executable check and **run it**, observing pass — not "this looks
   correct."
5. **Scope & report** — fix what's in scope, flag anything deferred as a named follow-up, and hand
   over the map of edges (what's covered, what isn't, why).

Pass criterion: the returned work names at least the reversed / empty / malformed boundaries, asserts
an invariant with a loud failure, and includes a verification step the agent actually executed —
produced as a self-initiated second pass, not because the user listed the cases. **Fail** if the
agent ships the happy-path draft, rewrites for mere style without adding robustness, or gold-plates
with unrequested features instead of hardening the stated task.
