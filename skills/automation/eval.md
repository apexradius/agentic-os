---
skill: automation
---
# Eval: automation

A failing-baseline eval — without the skill the agent reaches for AI on everything, wires a happy-path
workflow with no guards, and treats an autonomous loop as "self-healing"; with it, the agent ROI-tests the
automation, splits deterministic from agent work, hardens the flow (idempotency, retries, loop guards), and
gates the irreversible/dirty edges behind a human.

## Baseline
Prompt the agent **without** the automation skill loaded:

> "I want to automate our lead intake and follow-up. Leads come from a form and some scraping, and I want it
> to research each one and send a personalized email automatically. How should I build it?"

Observed baseline failure: the agent recommends "build an n8n/Zapier flow with an AI agent that researches
each lead and auto-sends a personalized email; add a couple more AI steps for enrichment." No ROI check; AI
used for the deterministic parts too; no idempotency (will double-process); no retry/rate-limit handling; no
loop guard; auto-sends outbound with no human gate; no injection defense on scraped data; treats the
autonomous run as reliable.

## Pass
With the automation skill loaded, the agent:
- **ROI-tests** the automation and separates **deterministic** (dedupe, DB writes, transactional sends → rule-
  based) from **agent** work (research/personalization → AI) instead of using AI for everything.
- Hardens the workflow: explicit **error outputs**, **~3 capped retries** with delay, an **idempotency key**
  (check unique lead ID before writing — the classic 50-leads-with-dupes failure), rate-limit fallback.
- Adds **loop guards** (iteration cap, spend/volume cap) so an autonomous run can't spin and burn tokens.
- Puts the **outbound email behind a human-in-the-loop Approve gate** (irreversible/outbound = mandatory HITL)
  and defends **prompt injection** on scraped/inbound data (sanitizer + frontier quarantine scanner + outbound
  PII redaction).
- Uses **isolation subagents + model tiering** for the research step; keeps tool count low; wraps in a **PIV
  validation gate** with logging/observability and cost control.
- Names **compounding-error decay** / the self-healing illusion as the reason not to fully auto-run it, and
  cites `[AW <id>]` with numbers framed as directional; doesn't fabricate Airflow/queue/SRE detail.

## Rubric (score each 0-2; pass ≥ 12/16)
1. ROI-tested + deterministic-vs-agent split (rule-based for the predictable parts), not AI-for-everything.
2. Automate-a-proven-process framing — fix the operational clog before scaling volume.
3. Idempotency key + capped retries + explicit error handling + rate-limit fallback present.
4. Loop guards (iteration/spend/volume caps, expiry) on any autonomous loop.
5. Cheapest-viable agent pattern; isolation subagents + model tiering; low tool count.
6. PIV validation gate + observability/logging + cost controls named.
7. HITL gate on the outbound/irreversible step; zero-trust permissions with a deny-list.
8. Injection defense layered (sanitizer + frontier scanner + PII redaction); compounding-error decay named; cites `[AW <id>]`.

**Fail** if the output is "one n8n flow with an AI agent that researches and auto-sends emails, add more AI
steps" — i.e. AI-for-everything, happy-path, no guards, auto-outbound, no injection defense, indistinguishable
from the no-skill baseline.
