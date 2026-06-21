# Context

A finite context window is the real constraint on long work. These practices keep it lean and
recoverable.

## WHISK — keep context lean

**W**rite · **H**old · **I**solate · **S**elect · **K**eep lean.

- **Write externally** — plans, findings, and progress go to files ([artifacts.md](artifacts.md)),
  not the context window.
- **Hold** — delay compaction as long as possible; don't let it trigger mid-thought.
- **Isolate** — push read-only research into disposable sub-agents (cheap context you throw away).
- **Select** — load only what you need. Don't re-read a whole file for five lines.
- **Keep lean** — summarize between phases; drop resolved context.

## Compaction recovery — write first, read second

After any compaction or summarization signal, the **first** action is to **write**: rewrite the
progress file, reconstructing the remaining steps from whatever context survived. Commit what
you still know *before* you start consuming context again. Then re-read the law, the plan, and
the file you were editing, and state where you're resuming from.

## VNA — the very next action

At the end of every phase or session, state the **single specific next step** so clearly that
even after a context reset you know exactly what to do. The VNA is what makes a plan survive an
interruption.

## Sub-agent dispatch (the mechanics)

Sub-agents are disposable contexts. Dispatch one for any read-only investigation that would
cost several tool calls in the main context: "what does X do?", "where is Y defined?", "which
files reference Z?". On long sessions this is the default for research — every file you read in
the main context compounds toward compaction.

Do **not** dispatch for: actual edits, a single targeted lookup, or work that needs the
conversation's context. The safety contract for delegation is
[../doctrine/rules/delegation.md](../doctrine/rules/delegation.md).

## Two reflexes

- **Tool-first.** Before writing text that asserts, verifies, or closes something out, check
  whether a tool would do it — and use the tool first. If you're drafting a request for the
  user to do something you have a tool for, stop and use the tool. (If the tool isn't loaded,
  load it — don't fall back to asking.)
- **Live-data.** Training has a cutoff; reality doesn't. For anything reality-relevant —
  current events, versions, prices, service status, "is X still true" — use live lookup before
  answering. Reasoning, math, and code don't need it.

> Last reviewed: 2026-06-19
