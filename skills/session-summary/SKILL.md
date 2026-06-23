---
name: session-summary
description: "End-of-session close-out — capture what changed and was decided, then reconcile every open item into the durable task ledger so nothing is lost on context reset. Use when ending or wrapping up a session, saving progress, closing out for the day, moving on to the next session, or on /session-summary."
user-invocable: true
disable-model-invocation: false
---

# Session Summary — end-of-session close-out

The wrap-up that makes a session safe to end: a quick summary, and — the step usually skipped —
**every loose end reconciled into the durable task ledger**, so open work survives the reset
instead of dying in a scrolled-away conversation. This is the per-session form of the loop's plan
close-out (Plan → Implement → Verify → **Close out**): same move, wider scope.

## 1. Compile the summary
1. **Changed** — `!git diff --stat`, plus uncommitted / untracked state.
2. **Accomplished** — features, fixes, and decisions (with the *why* on anything that would cause
   rework if reversed).
3. **Open** — pending items, blockers, and anything gated on someone else's decision.
4. **VNA** — the single concrete next action a cold session could resume from (not "continue X").

## 2. Reconcile open items into the task ledger — the step that's usually missed
For **each** open item, pending, or blocker from step 1:
1. **Search the ledger first** — is it already tracked? (Don't re-add; don't re-ask what's decided.)
2. **If absent**, append a ledger entry: what's left, the owner, and the gate/blocker if any.
3. **If present but changed this session**, update it in place (status, new evidence).

Report exactly what you **added** vs **already-present** vs **updated** — no silent writes. The
task ledger is where open work survives a context reset; the summary report does not — it scrolls
away. Items gated on a human decision are recorded as gated, never silently dropped.

## 3. Save the durable residue
- Fold session-spanning **decisions and context** into the knowledge / memory store — standing
  facts only, never ephemeral session state.
- **Retire finished plans** per the loop's close-out: once the outcome is in knowledge and any
  remainder is in the ledger, delete the plan file. A finished plan left on disk reads as open work.

## Output
Concise markdown — **Accomplished · Open (→ ledger: added / already-present) · Decisions · VNA.**

## Constraints
- **Never blind-commit a working tree you don't own.** Write the ledger entry, but a multi-author
  tree gets banked per the repo's commit policy and ownership — write, don't auto-commit.
- **Don't duplicate** an item already in the ledger — reconcile, don't re-add.
- **Don't save ephemeral state** as a standing fact — only what a future session needs.

## Anti-Patterns
- A pretty summary with open items left only in the report (they vanish at reset).
- Re-asking or re-listing something the ledger already tracks.
- Declaring the session closed while a plan file or uncommitted thread silently holds open work.
