---
name: context-canary
description: "Per-turn canary signal (first line of every reply: name + turn counter + honest self-check) that makes silent context degradation visible the instant it happens, plus a trip protocol when it fails. Complements a token-% context guard by catching adherence/compaction drift a percentage gauge cannot see. Use at the start of a long or high-stakes session, when the user says 'canary' / 'context canary' / 'did you lose context' / 'you stopped using my name', to detect context rot / compaction loss / instruction drift, or /context-canary."
user-invocable: true
argument-hint: "[name]"
metadata:
  source: "Adapted from JuliusBrussee/skills context-canary (MIT)"
---

# Context Canary

A context canary is a trivially checkable standing instruction whose only job is to fail
visibly. The classic form: "start every response with my name." Complying costs almost
nothing — so when the name disappears, that absence is *data*. The instruction didn't get
harder; the agent's hold on its early-context instructions got weaker. Like the coal-mine
canary, it dies first — before the failures you actually care about (forgotten constraints,
ignored conventions, re-litigated decisions) start landing in the code.

This works because context degradation is **silent and gradual**. A model doesn't announce
that it stopped attending to instructions from 80k tokens ago, and compaction summaries
quietly drop standing instructions. The canary converts an invisible failure into a binary,
per-turn, zero-effort check. Why it happens — context rot, lost-in-the-middle, instruction
drift, compaction loss — is in [`references/research.md`](references/research.md).

## Where this fits

This is the **behavioral** half of context safety. The other half is structural:

- **A token-percentage guard** (a hook that triggers a handoff/checkpoint as the window fills
  — e.g. at 45/55/65/75/85/95%) answers *"how full is the window?"*
- **The canary** answers *"is the model still attending to what's already in the window?"* —
  adherence and compaction drift, which a percentage gauge is blind to. A session can sit at
  40% tokens and still have dropped a standing constraint after a summarization boundary.

They are complementary, not redundant. The guard watches capacity; the canary watches
fidelity. Run both if you have a percentage guard; the canary is independently useful if you
don't.

## When to use this skill

- Installing a canary at the start of a long or high-stakes session.
- The user notices the canary stopped appearing and asks what happened.
- The agent itself realizes it can no longer find its canary contract in context.
- The user asks how trustworthy the current context still is.

## The canary contract

When invoked, install the canary by stating the contract explicitly in one short message,
then follow it. Default format — first line of every response from then on:

```
**Sam · t14 · ctx ok**
```

Three fields, each probing something different:

| Field | Example | What its failure means |
|---|---|---|
| Name | `Sam` | The standing instruction itself fell out of effective context — adherence drift or compaction dropped it. |
| Turn counter | `t14` | Increment by 1 every response. A reset, skip, or repeat means continuity broke — almost always compaction or a summarization boundary. |
| Self-check | `ctx ok` / `ctx aging` / `ctx thin` | The agent's honest estimate. `aging`: the session is long and early details are getting summarized in its own working sense of the task. `thin`: the agent is reconstructing earlier decisions instead of remembering them. |

Default to the user's actual name; accept a `[name]` argument to override. If the user wants
the minimal version, name-only is fine — it's the original trick and still catches the big
failures. Never explain, apologize for, or decorate the canary line; it must
stay byte-stable so a human can pattern-match it in half a second.

**Session canary vs. standing canary.** A canary that lives only in the conversation tests
whether *conversation* context survives (compaction, truncation, drift). A canary written
into `CLAUDE.md` or memory survives compaction by design — so it tests whether file-based
instructions are being attended to, a different and weaker signal. Default to the session
canary; that's the one that detects degradation. Offer the standing variant only if the user
wants the habit across all sessions, and say what it no longer measures.

## Emission rules

1. Canary is the **first line** of every response — including short ones, error reports, and
   responses after tool calls.
2. Increment the counter every response. If unsure of the count, that uncertainty IS a signal
   — emit `t?` and flag it; never guess a plausible number.
3. The self-check must be honest. Reporting `ctx ok` by reflex defeats the entire instrument.
4. If the canary contract can no longer be found in context (you only know it from a summary,
   or not at all), **declare a trip yourself** — don't wait for the user to notice.

## Trip protocol

A trip is: the canary missing, malformed, a counter discontinuity, or an agent-side
self-declaration. Calibrate before alarming — one missed canary on an otherwise coherent
response is a warning (note it, resume the canary, keep going). **Two consecutive misses, a
counter discontinuity, or the agent failing its own contract check is a confirmed trip.**
Then:

1. **Stop trusting drifted state.** Do not barrel ahead on the current task using context you
   can no longer vouch for.
2. **Checkpoint** via the [`handoff`](../handoff) skill (or write durable state to a notes
   file): current goal, decisions made and why, files touched, verified vs. in-progress, next
   step. This is the same external-memory move WHISK mandates — get it out of chat.
3. **Re-anchor.** Re-read the project instructions (`CLAUDE.md`, your project's memory /
   standing-facts file, the original task statement) and any active `task_plan.md` /
   `progress.md` / `findings.md` — the standard compaction-recovery set. State back to the
   user, in three or four lines, what you believe the task and constraints are, so they can
   correct drift cheaply.
4. **Reset deliberately.** Recommend a fresh session (or an explicit `/compact`) seeded with
   the checkpoint, rather than limping on. Degraded context doesn't heal; it compounds.
5. **Re-install the canary** with the counter reset and the generation noted: `t1 (gen 2)`.

Never silently resume the canary after a gap as if nothing happened — that destroys the
instrument's credibility, which is all it has.

## What the canary does and doesn't tell you

The test is **one-sided**. A *missing* canary is strong evidence of degradation. A *present*
canary is weak evidence of health — a cheap stylistic habit can survive while harder
constraints (architecture decisions, "never touch X") quietly rot, and a canary stuffed into
a memory file can outlive the context it was meant to monitor. Treat it as a smoke detector,
not a structural inspection: when it fires, act; when it's quiet, stay reasonably suspicious
in sessions past ~50% of the window or after any compaction event.

Pair it with the cheap structural habits that reduce what the canary has to catch (the WHISK
discipline): keep durable decisions in files, not chat; compact at deliberate boundaries
instead of waiting for a forced compaction; prefer a fresh session per task over one immortal
session.

---
*Adapted from [`JuliusBrussee/skills` → `context-canary`](https://github.com/JuliusBrussee/skills) (MIT). Wired to a token-% context guard, the `handoff` skill, and the compaction-recovery protocol.*
