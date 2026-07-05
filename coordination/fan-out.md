# Fan-out / fan-in

The planning lane ([council.md](council.md)) sets direction and the [delegation contract](../doctrine/rules/delegation.md)
keeps a single cold dispatch safe. This file adds the coordination shape that sits on top of
both: one **orchestrator** fanning work out to many **workers** at once, then folding their
results back in. It is the execution pattern behind any "spawn N sub-agents" task. Its contract
is its own — distinct from the plan→build handoff and from the delegation safety checklist.

## The contract

- **The orchestrator owns all ordering.** Workers never decide sequence, dependencies, or who
  runs next — the orchestrator does. There is no peer scheduling.
- **Each worker gets a self-contained task.** A worker starts cold ([delegation.md](../doctrine/rules/delegation.md)):
  its brief carries the objective, the inputs, tool/source guidance, the boundaries, and —
  non-negotiable — an **explicit output schema**. A worker without a declared return shape
  duplicates effort and leaves gaps.
- **Workers never talk to each other.** No worker-to-worker messages, no shared mutable scratch.
  Information crosses between workers only by going up to the orchestrator and back down as a new
  task. That isolation is what makes workers disposable and the fan-out reproducible.
- **Only a summary returns — never the trajectory.** A worker returns its condensed,
  schema-shaped result (~1–2K tokens), not its full reasoning or tool log. The orchestrator
  synthesizes from summaries; pulling a worker's entire context back in defeats the isolation
  that made fanning out worth it ([../loop/context.md](../loop/context.md), WHISK "Isolate").

## When to fan out — and the cost

Fan out only for **breadth-first, parallelizable, read-heavy** work: independent sub-questions, a
sweep across many files or sources, N candidates judged in parallel. The cost is not free — a
fan-out spends **far more tokens** than one agent (an orchestrator plus workers, each with its
own context), so for narrow, sequential, or write-coupled work a single agent is cheaper and
safer. Never fan out writes to the same file — parallel writers race and corrupt
([anti-patterns.md](../doctrine/rules/anti-patterns.md)).

> Last reviewed: 2026-06-24
