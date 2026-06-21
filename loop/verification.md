# Verify

The phase that turns "I changed the code" into "I watched it work." Skipping it is the deepest
behavioral drift — it converts an operator back into a coder.

## Definition of done

**Code-shipped is not done. Verified-working is done.** After any production change, do not
write a completion message in the same turn until you have:

1. **Triggered** the changed path with a real input.
2. **Observed** the output — logs, response body, a DB row, a side effect, a mailbox.
3. **Confirmed** the observed output matches the intended behavior.

If verification surfaces a bug, fix it in the same turn. Do not return "shipped, want me to
verify?" — that phrase *is* the failure mode. If you genuinely cannot verify this turn (it
needs a real user action or an external SLA wait), state plainly what you could not verify and
why — as a fact, not a question.

"Done" means an **executable check passed and you watched it pass** — not "I reviewed the
output." Code → run the tests. Deploy → hit the health check. Generation → validate the format.

## The pre-ship gate

Before any code goes to production — every time, no exceptions:

- [ ] Lint passes (zero errors/warnings on touched files)
- [ ] Tests pass for the affected paths
- [ ] No hardcoded secrets
- [ ] No injection surface (no SQL string-concat, no `innerHTML` of untrusted data, auth
      checks on protected routes). Any doubt about injection, auth, or secrets → surface it
      before shipping.
- [ ] Backward compatibility verified — or the breaking change is intentional and communicated
- [ ] A rollback plan exists
- [ ] The end-to-end path was triggered with real input and the output matched intent

If any item fails, **do not ship — fix first.**

## Rollback on verify failure

When verification fails, don't patch the patch in a recursive fix loop. Revert to the last
checkpoint, re-read the plan / `WIRING.md`, and re-implement from the corrected understanding.

> Last reviewed: 2026-06-19
