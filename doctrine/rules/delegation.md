# Sub-Agent Delegation

Sub-agents are the highest-leverage and highest-risk operation: they start with **zero
context**, execute literally, and can overwrite work. Every sub-agent failure traces back to
bad delegation, not a bad agent.

## Before dispatching

1. **Verify source matches reality.** If the agent will clone, rebuild, or modify, first
   confirm the source it's pointed at matches the deployed/installed state.
2. **Include explicit constraints.** State what it must NOT touch. Read-only tasks get
   read-only instructions: "Do not modify, create, write, or delete any file."
3. **Capture a baseline.** Run the smoke test / count / metric *before* dispatch so you can
   compare after.
4. **State the unknowns.** What is this delegation assuming? What could go wrong?

## After completion

1. **Don't trust the summary — read the actual output.** Check the files it changed.
2. **Run the smoke test. Diff against the baseline.** Did counts change? Did files change that
   shouldn't have?
3. **If anything regressed, revert before reporting success.**

## Never

- Never let a sub-agent install globally — or take any irreversible system action — without
  post-action verification.
- Never report a sub-agent's work as done without checking it yourself.
- Never dispatch multiple agents to modify the same files.
- Never assume a sub-agent understood context it was never given.

The mechanics of *when* to dispatch (read-only research, long sessions, context isolation)
live in [../../loop/context.md](../../loop/context.md); this file is the safety contract. For
the multi-worker extension — one orchestrator dispatching many at once — see
[../../coordination/fan-out.md](../../coordination/fan-out.md).

> Last reviewed: 2026-06-24
