---
name: automation
description: Automation + AI-agent workflow design — deciding what to automate (10x-ROI rule, deterministic-vs-agent split, automate-a-proven-process-not-chaos), workflow mechanics (triggers/polling/branching, error outputs, capped retries, idempotency keys, rate-limit fallback, loop guards), agent patterns (single-vs-multi, isolation subagents + model tiering, tool-count discipline, memory/context-rot), RAG (context-aware chunking, hybrid search + RRF, re-ranking), reliability/ops (PIV validation, observability, cost control), and governance (human-in-the-loop gates, zero-trust permissions, injection defense). Use when designing/auditing an automation or agent workflow, choosing rule-based vs AI, setting up n8n/cron/webhooks, or hardening an autonomous run. NOT enterprise orchestration (Airflow/Temporal), NOT message-queue/SRE architecture — this is the practitioner automation-design layer.
user-invocable: true
context: fork
argument-hint: [workflow/automation to design or audit]
---

## What this skill is

An automation-design partner distilled from an **AI & Automation Workflows** corpus (n8n + agentic-coding
practitioner content, 2024–2026). It turns workflow discipline into an executable loop so a model building
automations pulls the right rule and *actions* it: automates a *proven* process only when the ROI clears the
bar, splits deterministic work from agent work, hardens the flow (idempotency, retries, loop guards), and
gates the irreversible/dirty-data steps behind a human — instead of throwing an autonomous agent at chaos and
watching compounding error decay it into slop.

Load the depth file — don't guess: `references/knowledge-base.md` (when-to-automate, workflow-design,
agent-patterns, rag, platforms-integrations, reliability-ops, governance, failures — each rule cited to
`[AW <id>]` with an explicit skew + absent-list note).

**Scope caveat (baked into the KB):** the *practitioner* automation layer — n8n as default no-code, agentic
coding assistants for the agent patterns. **Absent (do not fabricate):** formal orchestration
(Airflow/Dagster/Temporal/Prefect), message queues / event-driven-at-scale, dead-letter queues, circuit
breakers, formal SLA/SRE, and compliance frameworks (SOC2/GDPR). Cost/ROI/reliability numbers are
subscription-window-specific **source claims** — re-verify against the actual workload.

## When to load
- Deciding whether to automate a task, and rule-based vs AI-agent.
- Designing/auditing an n8n (or Zapier/Make) workflow — triggers, branching, error handling, retries.
- Building an agent system — single vs multi, subagent isolation, memory, tool-count.
- Standing up RAG, or hardening an autonomous run (idempotency, loop guards, HITL, injection defense, cost).

## The workflow

Run the stages relevant to the task — each cites a rule from the KB (§ + `[AW <id>]`).

### 1 — DECIDE WHAT (AND WHETHER) TO AUTOMATE (§when-to-automate)
Quantify the manual cost first (frequency × people × hourly value × error rate) and apply the **10x-ROI rule**
— an automation should return ~10× its first-year build cost. **Automate a proven, stable process, never
chaos** (a clog early in the pipe isn't fixed by adding AI — clear the operational clog first). Make the core
design call: **deterministic → rule-based** (DB sync, logging, transactional notifications); **AI agent only**
for high variability, subjective judgment, or unstructured data.

### 2 — DESIGN THE WORKFLOW TO SURVIVE PRODUCTION (§workflow-design)
Pick the trigger (manual / scheduled-cron / webhook / polling). Handle success *and* failure explicitly (error
outputs, not a halt). **Cap retries ~3 with a delay**; **check a unique key before writing (idempotency)** so
nothing double-creates; catch rate-limit errors and fall back to a batch endpoint; and set **loop guards** —
hard iteration caps (20–50), auto-expiry timers, spend/volume caps — so an autonomous loop can't spin and burn
tokens.

### 3 — CHOOSE THE AGENT PATTERN (§agent-patterns)
Default to the **cheapest structure that works**: linear prompt-chains for predictable pipelines; intent
routing for messy inputs; orchestrator-worker only for genuinely complex work (cap parallel teammates 3–5).
Use **isolation subagents** for heavy research (return only a summary — big context saver) paired with
**asymmetric model tiering** (cheap models for subagents, premium reasoner for the lead). Keep active tools
**under ~10**; proactively compact before context-rot degrades quality.

### 4 — RAG & RELIABILITY (§rag, §reliability-ops)
If retrieval is involved: **context-aware chunking** at semantic boundaries (not fixed splits), **hybrid
search** (semantic + keyword) merged with **Reciprocal Rank Fusion**, then a **re-ranker** to prune. Wrap
everything in **PIV** (plan → implement → validate — never commit without a validation gate), instrument with
observability/logging, and control cost (model-tiering, off-peak crons, compaction).

### 5 — GOVERN THE DANGEROUS EDGES (§governance, §failures)
**Human-in-the-loop is mandatory** for (1) destructive/outbound/irreversible actions, (2) brand-critical
artifacts, (3) ingesting dirty external data. **Zero-trust permissions**: start read-only, add write
incrementally, keep a deny-list that overrides allow. Defend **prompt injection** with a deterministic
sanitizer *plus* a frontier-model quarantine scanner + outbound PII redaction. And respect **compounding-error
decay** — a 95%/step agent over 20 autonomous steps drops to ~36% reliability; long-horizon full automation
without structural checks degenerates into slop.

## Output contract
Return, in order:
1. **Automate decision** — the ROI check and the deterministic-vs-agent split (or "don't automate — fix the process first").
2. **Workflow design** — trigger, branching, error handling, retries, idempotency, loop guards.
3. **Agent pattern** — the structure chosen (chain/route/orchestrate), subagent isolation + model tiering, tool count.
4. **Reliability** — the validation gate, observability, and cost controls.
5. **Governance** — the HITL gates, permission posture, and injection defense on the dirty edges.

## Constraints (what NOT to do)
- **Never automate an unproven/broken process** — you scale the mess; clear the operational clog first.
- **Never use an AI agent for deterministic work** — rule-based is cheaper, faster, and reliable; reserve agents for variability/judgment/unstructured data.
- **Never ship an autonomous loop without guards** — hard iteration caps, spend/volume caps, expiry timers, idempotency keys, capped retries.
- **Never wire >~10 active tools or a huge MCP set naively** — it confuses the model and can eat ~48% of context before the first message.
- **Never let irreversible/outbound/dirty-data steps run unattended** — human-in-the-loop gate is mandatory there.
- **Never trust a single instant model as your injection scanner, or leave secrets in chat/logs** — frontier quarantine scanner + deterministic sanitizer + gitignored `.env`.
- **Never assume "self-healing"** — agentic self-correction happens in dev; once deployed on a schedule the reasoning is gone and it behaves like brittle code. Respect compounding-error decay.
- **Never fabricate enterprise-orchestration/queue/SRE/compliance detail** — the corpus is silent there; defer to dedicated sources.

## Verify (executable acceptance)
- [ ] The automate/don't decision is quantified (ROI) with the deterministic-vs-agent split stated — not "automate everything with AI".
- [ ] The workflow has explicit error handling, capped retries, an idempotency key, and (for any loop) hard guards.
- [ ] The agent pattern is the cheapest that works; subagent isolation + model tiering used where research is heavy; active tools kept low.
- [ ] A validation gate (PIV) + observability + cost controls are named.
- [ ] HITL gates cover destructive/outbound/dirty-data; permissions are zero-trust with a deny-list; injection defense is layered.
- [ ] Every claim cites `[AW <id>]`; numbers framed as directional; enterprise-orchestration/queue/SRE/compliance not fabricated.
