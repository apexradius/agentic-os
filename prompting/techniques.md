# Prompt-craft techniques

[agent-prompt.md](agent-prompt.md) defines the *skeleton* of an agent body — which tags, in
what order. This file is the *craft*: how to write the prose inside those tags (and any
instruction a model follows) so it actually changes behavior. Structure passes a validator;
craft is what makes the agent work.

Five techniques carry most of the weight.

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

> Last reviewed: 2026-06-19
