---
name: project-management
description: Delivery-project management across the full lifecycle — method selection (predictive/agile/hybrid "structured agility"), scope + WBS + estimating (estimate twice, tailored contingency, red-team the estimate), execution tracking (sprints, burndown, task boards, WIP limits, project controls), risk + change control (living risk register, exponential impact scales, noble-objection scope-creep governance), and delivery/closeout (Definition of Done + shipability, UAT, closure report, benefits realization). Use when planning a delivery project, estimating effort/cost, setting up tracking + controls, running a risk register, governing scope change, or closing out a project. NOT sales proposals/SOW authoring (proposal-gen/estimate), NOT ICE/A-B prioritization stats, NOT deep Kanban-flow or pure-Scrum ceremony mechanics — this is the plan-execute-control-deliver layer.
user-invocable: true
context: fork
argument-hint: [project to plan, estimate, track, or close out]
---

## What this skill is

A delivery-PM partner distilled from a **Project Management** corpus (UK-practitioner / PRINCE2 / PMI / APM
thought-leadership, 2024–2026). It turns lifecycle discipline into an executable loop so a model running a
project pulls the right rule and *actions* it: picks the method to the context instead of the fashion,
estimates twice and red-teams the number, locks a baseline so deviation is *measurable*, keeps risk and
change under living governance, and proves benefits at closeout — instead of planning-to-death upfront then
losing control mid-flight.

Load the depth file — don't guess: `references/knowledge-base.md` (methodologies, planning/estimation,
execution/tracking, risk/change, delivery/closeout, people/communication, failures — each rule cited to
`(src: PM <id>)` with an explicit skew + gaps note).

**Scope caveat (baked into the KB):** the *delivery-management* layer. Sales proposals / SOW authoring →
`proposal-gen`; task-sizing for a client quote → `estimate`; funnel/offer math → `sales-funnels`. The corpus
is **thin on deep Kanban-as-method, pure-Scrum ceremony mechanics, CPM float math, and formal agency
onboarding/SOW** — defer those (see §Gaps). Numbers (2-week sprints, 10%/40% contingency, "#1 failure cause")
are directional **source claims** — re-verify against the specific engagement.

## When to load
- Choosing a delivery method (predictive vs agile vs hybrid) or being asked to "run this as Scrum/waterfall".
- Building scope + WBS, or producing/sanity-checking an effort/cost/timeline estimate.
- Standing up execution tracking (sprints, burndown, boards, project controls) or diagnosing a stalled sprint.
- Running a risk register, or governing a scope-change request.
- Delivering / closing out — Definition of Done, UAT, closure report, benefits realization.

## The workflow

Run the stages relevant to the task — each cites a rule from the KB (§ + `(src: PM <id>)`).

### 1 — MATCH THE METHOD TO THE CONTEXT (§methodologies)
Don't pick by fashion. Assess *how much agility the work benefits from* (PRINCE2 "agileometer": is scope
flexible? can features be added/removed/swapped?). **Predictive/waterfall** for predictable, rigid-scope,
physical work (accepts no short feedback loops). **Agile/Scrum** for complex/volatile work where requirements
evolve — excels **single-team**, struggles to scale to multi-team/portfolio and to give execs financial/timeline
rollups. **Hybrid / "structured agility"** is where almost all real work has converged: an agile delivery
engine wrapped in structured governance (team autonomy below, budget/compliance/risk control above). Name the
method *and* the trade-off you're accepting.

### 2 — SCOPE, WBS & ESTIMATE TWICE (§planning-estimation)
Define scope **with exclusions** (what it will NOT do) and get a signed baseline. Decompose with a **WBS**
(by activity or product) → derive resources per work package → cost into a Cost Breakdown Structure.
**Never estimate once** — estimate by two different methods (bottom-up vs top-down, expert vs parametric) and
reconcile the gap; then **red-team** it (keep your sharpest people *out* of the estimate and task them to
break it). Add **contingency tailored per workstream by uncertainty** (~10% familiar tech → ~40% novel),
never one flat project-wide %. Map internal **and** external dependencies — unidentified dependencies on
shared specialists are the #1 portfolio bottleneck.

### 3 — TRACK AGAINST A BASELINE, WITH CONTROLS (§execution-tracking)
Time-box in consistent units; track with **burndown/burnup vs the ideal line** and a task board. Read the
board: a **flatline at the top** of a burndown = over-planning / ignored WIP limits (nothing finishing early)
→ pull in smaller well-defined tasks. Stand up the **five project controls** — baseline/rebaseline, risk/issue
mgmt, cost/budget mgmt, progress monitoring, change control — because *without a locked baseline there is
nothing to measure deviation against*. Controls are a **proactive** early-warning mindset proportionate to
scale, not box-ticking. Prefer live **pull dashboards** over pushed weekly reports — but remember a dashboard
is only worth the *decision and corrective action* it drives.

### 4 — GOVERN RISK & CHANGE AS LIVING PROCESS (§risk-change)
The **risk register** is the one mandatory doc when spending someone else's money — a *living* tool, not a
filed artifact. Four sections: Identify (unique never-reused ID; log every risk — not logging it makes you
culpable) → Analyze (category, likelihood, impact, **proximity**, score) → Plan (mitigation + a single named
**risk owner**, not the PM) → Action/closure. Use **exponential impact scales** (1-2-4-8-16, not linear 1–5)
— worst cases are exponentially worse. Responses: mitigate / contingency-plan ("if-then") / transfer — but
**transferred ≠ removed**. Govern **scope creep** (the PM's nemesis, an uncompensated cost) with a formal
change process: the PM runs governance, doesn't personally approve/deny — *"you can have it if it's approved
through the proper process"*; when you must refuse, use a **Noble Objection** (never a naked no — clothe it in
a clear "because").

### 5 — DELIVER, CLOSE OUT & PROVE BENEFITS (§delivery-closeout)
Definition of Done flows from Quality Design and must include **shipability** — track backlog-item
*completion*, not task busywork (a weak DoD causes the end-of-sprint "mini-waterfall" drop). Hand over via the
testing ladder up to **UAT** (real end-users in a real environment — experts miss natural-use faults). Close
with a **closure report** (outcomes vs predicted benefits, actual-vs-baseline, lessons, sponsor sign-off).
**Embed lessons in the live data**, don't summarize-and-shelve. And **start with the end in mind**: identify
the 1–3 measurable **benefits before initiating** — hunting benefits *after* starting to justify the spend is
"benefit fraud".

## Output contract
Return, in order:
1. **Method + trade-off** — the delivery approach chosen and the trade-off being accepted (not fashion).
2. **Plan** — scope + exclusions, WBS shape, and the twice-estimated number with per-workstream contingency.
3. **Tracking + controls** — the cadence/units, the baseline, and which of the five controls are live.
4. **Risk + change** — the top risks (owner + exponential-scored) and the change-governance rule in force.
5. **Done + benefits** — the Definition of Done (incl. shipability/UAT) and the 1–3 measurable benefits.

## Constraints (what NOT to do)
- **Never pick a method by fashion** — assess the agility the work benefits from; name the trade-off.
- **Never estimate once or apply one flat contingency %** — estimate twice, red-team it, tailor contingency by workstream uncertainty.
- **Never run without a locked baseline** — with nothing to measure against, control is impossible (the #1 failure mode is poor control, not poor planning).
- **Never over-plan ("death by planning")** — leave room for contingency and change; poor control beats poor planning as a killer, but so does rigidity.
- **Never let the PM personally own approve/deny on scope** — run the change process; refuse only with a Noble Objection, never a naked no.
- **Never use a linear risk scale, an unnamed risk, or a "transferred = removed" assumption** — exponential scales, one named owner, monitor transferred risk.
- **Never call it done without shipability + real-user UAT, or start hunting benefits after kickoff** — DoD includes shipability; benefits are identified before initiating.
- **Never author a client SOW/onboarding framework from this skill** — the corpus is thin there; defer to proposal-gen/estimate (and note the fixed-price-vs-T&M + stage-gate risk framing is the only agency content here).

## Verify (executable acceptance)
- [ ] A delivery method is chosen against the context (agileometer-style), with the accepted trade-off named — not defaulted to a fashion.
- [ ] Scope carries explicit exclusions + a baseline; the estimate was produced by two methods and reconciled, with per-workstream contingency (not one flat %).
- [ ] Tracking states the unit/cadence + baseline; the relevant project controls (esp. change control + risk) are named as live.
- [ ] The risk register uses exponential scoring, unique IDs, and a single named owner per risk; transferred risk is still monitored.
- [ ] Scope change routes through a governance process (PM governs, doesn't personally decide); refusals use a Noble Objection.
- [ ] Definition of Done includes shipability + real-user UAT; 1–3 measurable benefits were identified before initiating.
- [ ] Every claim cites `(src: PM <id>)`; numbers framed as directional; SOW/onboarding + deep-Kanban/Scrum-ceremony/CPM-math deferred to siblings/dedicated sources.
