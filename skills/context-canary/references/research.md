# Why context degrades silently — the research behind the canary

The canary exists because four well-documented failure modes all share one trait: they
degrade an agent's adherence to earlier context **without any visible signal**. The model
keeps producing fluent, confident output; it just quietly stops honoring instructions it can
no longer effectively attend to.

## The four failure modes

**1. Context rot.** As a context window fills, per-token attention to any individual earlier
instruction thins. A standing rule stated at token 2k competes with everything added since;
by token 120k it may receive almost no effective weight even though it is still technically
"in context." Larger windows do not fix this — they enlarge the haystack.

**2. Lost-in-the-middle.** Transformer attention is U-shaped over position: content at the
**start** and **end** of a long context is recalled well; content in the **middle** is
recalled worst. Instructions that were early (and have since been buried by later turns) land
in the weak zone. This is a property of the architecture, not a tuning bug.

**3. Instruction drift.** Over a long multi-turn session, the model's *working* sense of the
task gravitates toward the most recent turns. Early constraints get reinterpreted, softened,
or dropped — not by an explicit decision, but by the gradual pull of recency. The agent
"forgets" it agreed never to touch X, because X hasn't come up in 40 turns.

**4. Compaction loss.** When a session is summarized/compacted, the summary is lossy by
design. Standing instructions, subtle constraints, and the *why* behind past decisions are
exactly the kind of low-salience-but-load-bearing detail a summary tends to drop. After
compaction the agent often knows a rule only *via the summary* — or not at all.

## Why a canary catches all four

Each failure mode reduces the model's adherence to an early standing instruction. The canary
**is** an early standing instruction whose compliance is trivial and whose violation is
unmissable. So it degrades on the same curve as the constraints you actually care about — but
visibly, one turn before silent breakage starts landing in real work. It's an early-warning
proxy, deliberately chosen to be the cheapest possible thing to keep doing, so that failing
to do it is pure signal.

## The asymmetry (restated, because it's the whole point)

- **Missing canary → strong signal.** If the cheapest instruction fell out, harder ones
  almost certainly have too.
- **Present canary → weak signal.** A stylistic habit can survive on autopilot while a
  buried architectural constraint rots. Never read a present canary as "context is healthy" —
  read it as "the smoke detector hasn't fired *yet*."

## What actually fixes it (the canary only *detects*)

Detection is not treatment. The structural habits that *reduce* degradation:

- **Externalize durable state** (WHISK: write plans/decisions/findings to files, not chat) so
  compaction can't drop them.
- **Compact at deliberate boundaries**, seeded with a checkpoint, instead of waiting for a
  forced auto-compaction that summarizes blindly.
- **Prefer a fresh session per task** over one immortal session that accumulates rot.
- **Re-read the anchor set after any compaction** (`CLAUDE.md`, `memory.md`, active
  `task_plan/progress/findings`) — re-injecting the early context the summary thinned.
