# Prompt-craft techniques

[agent-prompt.md](agent-prompt.md) defines the *skeleton* of an agent body — which tags, in
what order. This file is the *craft*: how to write the prose inside those tags (and any
instruction a model follows) so it actually changes behavior. Structure passes a validator;
craft is what makes the agent work.

Most of the techniques below change what the model does; two — stable-prefix ordering and
tool-result pruning — change only what the prompt costs to run. All ten are decisions you make
while writing the prompt, so they belong together here.

## 1. Decision-complete instructions

Resolve every fork in the prompt itself. "Handle errors appropriately" delegates a decision
the author should have made — the model will pick *an* answer, rarely the one you wanted. Name
the behavior: "On a 4xx, surface the body and stop; on a 5xx, retry twice then escalate." A
prompt is decision-complete when a competent reader makes no judgment call you didn't make for
them. Open choices are the single largest source of off-target output.

## 2. Costed, concrete imperatives

Every instruction should be checkable, and the high-stakes ones should carry their cost. "Cite
`file:line` for every claim" beats "be rigorous" — one is observable, the other is a mood.
Where a rule matters, attach the consequence so the model weights it correctly: "Never widen
the type to `any` — it silently disables every downstream check." Concrete + costed turns an
instruction the model can rationalize away into one it can't. (This sharpens the "imperative,
concrete, costed" writing rule in [agent-prompt.md](agent-prompt.md).)

## 3. Negative engineering

State what NOT to do, and where to STOP — not only what to do. Models drift toward helpfulness
and scope creep; an explicit ban and a hand-off boundary are higher-leverage than another
positive instruction. The strongest form names the anti-pattern *and* its corrective: "Don't
rewrite working code to taste — review fixes correctness, security, and plan-deviation only." A
constraint the reader can catch themselves about to violate is worth more than ten aspirations.

## 4. Evidence-bound claims

Require the model to ground assertions before it makes them: cite the source, show the command
output, quote the line. This converts "I think X" into "X — here's the proof," which does two
things: it suppresses confident-but-wrong output, and it makes the result checkable by whoever
(or whatever) reads it next. For diagnostic roles, push it further — demand a hypothesis with
evidence *for and against* before a conclusion, so the reasoning is auditable, not just the
answer.

## 5. A description is a load signal, not a summary

Any instruction that carries a triggering `description` — an agent's frontmatter, a skill's
metadata — has a job that is *not* to summarize the body. The description tells the router
**when to load this**: the symptoms, the trigger phrases, the "use when…" conditions. A
description written as a workflow summary makes the model think it already knows the procedure
and shortcut the body it was supposed to read. Write the trigger, not the recipe; the recipe
lives in the body.

## 6. Declare the output contract

Tell the model the exact shape of what it must return — the fields, their types, the order — not
just the task. An instruction that ends "…and report what you find" gets prose; one that ends
"return `{verdict, evidence[], confidence}`" gets something the next step can parse without a
second model call. The half authors forget is the **degenerate case**: name the shape for empty,
refusal, and uncertainty too, or the model invents one under pressure — an apology, an "N/A", a
confidently guessed answer where it should have abstained. A contract that says
`{verdict: "INSUFFICIENT_EVIDENCE", missing: […]}` gives uncertainty a home instead of forcing a
false pick. In an agent body this is the `<Output_Format>` block ([agent-prompt.md](agent-prompt.md));
a runtime that routes prompts enforces the same contract as a schema on the way out, so the
discipline holds whether or not a human wrote the prompt.

## 7. Stable-prefix ordering (cache-aware)

Order every prompt **static-first, volatile-last**: durable system instructions, tool
definitions, and long-lived examples at the top; task- and user-specific content at the bottom.
A model's prompt cache keys on the longest unchanged *prefix*, so a stable prefix turns the
expensive, repeated part of the prompt into a cache hit across calls while volatile content at
the end never invalidates it. The cost of getting it wrong is real and silent: interleaving one
per-task detail into the system block busts the cache on every call. Where the host supports it,
declare an explicit cache breakpoint after the static block. This is a *cost-and-latency*
technique, not a quality one — it changes what you pay, not what you get.

## 8. Match the reasoning budget to the task

How much a model deliberates before it answers is a decision you make in the request, not a
fixed property of the model. The current mechanism is *adaptive thinking* — set
`thinking: {type: "adaptive"}` and steer depth with a separate `effort` dial (`low` through
`max`), and the model spends more reasoning on a hard request and skips it on a trivial one.
Prefer this over a fixed token budget wherever the model exposes it: a hand-set budget is either
wasteful on easy calls or starving on hard ones, and the gap is worst in the mixed-difficulty,
long-horizon workloads agents actually run. Reach for an explicit `budget_tokens` only when you
need deterministic per-call cost or latency *and* you are on a model that still accepts it — on
the current Claude family (e.g. `claude-opus-4-8`, `claude-fable-5`) manual budgets are rejected
outright, so treat the explicit budget as an older-model fallback, not the default. One invariant
survives every mode: you are billed for the full reasoning the model generates whether or not it
is returned to you, so `effort` and `max_tokens` — not the display setting — are the cost
controls. (Per-model support moves every release; verify against
[extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking) and
[adaptive thinking](https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking),
as of 2026-07-05.)

## 9. Let the model think between tool calls

In a tool-using agent, the reasoning that matters most happens *between* the calls — reading a
tool result, deciding whether it answered the question, and choosing the next action instead of
blindly chaining to it. *Interleaved thinking* is what enables that: the model produces a thinking
block after each tool result, not only once at the start. On the current Claude family it turns on
with adaptive thinking and needs no special header; older models gated it behind a beta header
(`interleaved-thinking-2025-05-14`) that current models ignore — so the craft is to rely on
adaptive mode and verify the behavior, not to copy a header out of a stale example. The one rule
that breaks agents when ignored: pass each returned thinking block back unmodified on the next
turn. The blocks carry the model's own chain across tool calls; strip or edit them and you sever
the reasoning the technique exists to preserve. (Behavior and the header's status are per-model and
move each release; verify against
[extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking) and
[adaptive thinking](https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking),
as of 2026-07-05.)

## 10. Prune tool results the model no longer needs

A long, tool-heavy run accumulates tool results the model has already used and will never consult
again; left in context they cost tokens on every subsequent turn and eventually crowd out the
window. *Context editing* clears them for you: past a token or tool-use threshold the host drops
the oldest tool results while keeping the most recent few, and reports back how much it cleared.
Declare it for any agent that makes many calls over a long horizon — set the trigger, keep a
handful of recent results, and exclude the tools whose output stays load-bearing (a reference you
re-read, not a one-shot fetch). The cost is paid in what the model can still see: a cleared result
is gone from context, so this is safe exactly to the degree that what you prune is genuinely spent
— never clear a result a later step depends on. Like stable-prefix ordering (technique 7) above,
this changes what the prompt costs to carry, not the quality of the answer, provided you prune only
the truly stale. (Strategy identifiers and config fields are versioned and move; verify against
[context editing](https://platform.claude.com/docs/en/build-with-claude/context-editing),
as of 2026-07-05.)

> Last reviewed: 2026-07-05
