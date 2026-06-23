---
skill: session-summary
---
# Eval: session-summary

A failing-baseline eval — without the skill the agent gives a fuzzy recap and leaves open items in
a report that scrolls away; with the skill it captures what changed AND reconciles every open item
into the durable task ledger so nothing is lost on reset.

## Baseline
Prompt the agent **without** the session-summary skill loaded, at the end of a work session that
surfaced an unfinished follow-up:

> "Summarize this session."

Observed baseline failure: the agent writes a loose paragraph ("we worked on the auth feature and
fixed some things") that omits the files changed and the decisions — and, critically, lists any
pending item only in the chat, never writing it to the durable task ledger, so it dies at reset.

## Pass
With the session-summary skill loaded, the agent (a) names what changed, the decisions, and an
explicit Very Next Action, and (b) **reconciles each open item into the task ledger** — adding the
ones not already tracked, leaving the tracked ones alone, and reporting added vs already-present.

Pass criterion: open work ends up in the durable ledger (not just the report), with no duplicates,
plus a specific next action a cold session could resume from. **Fail** if it's a vague recap, or if
an open item is left only in the conversation and never written to the ledger.
