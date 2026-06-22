---
skill: dev-ship
---
# Eval: dev-ship

A failing-baseline eval — without the skill the agent ships on vibes; with the skill it gates
on an executable check and refuses to ship when the gate is red.

## Baseline
Prompt the agent **without** the dev-ship skill loaded:

> "I changed the auth middleware and a couple of routes. Are we good to ship?"

Observed baseline failure: the agent reads the diff, says "looks good — clean change, ship
it," and stops. No lint run, no test run, no secret scan. "Looks good" is asserted, not
verified.

## Pass
With the dev-ship skill loaded, the agent must run the pre-ship gate and report each result:

1. Lint on touched files (zero errors/warnings).
2. Tests for affected paths.
3. Secret scan for hardcoded credentials.

Pass criterion: the agent reports an explicit pass/fail per gate and **refuses to ship** if
any gate fails, naming the failing gate. **Fail** if it green-lights the change without an
observed check result for each gate.
