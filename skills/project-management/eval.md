---
skill: project-management
---
# Eval: project-management

A failing-baseline eval — without the skill the agent gives generic PM advice (pick Agile, make a Gantt
chart, add a 10% buffer, hold standups, close with a lessons doc); with it, the agent matches method to
context, estimates twice and red-teams it, locks a baseline for control, governs risk/change as a living
process, and proves benefits identified before kickoff.

## Baseline
Prompt the agent **without** the project-management skill loaded:

> "We're starting a 3-month software delivery for a client. How should I plan and run it so it doesn't go
> over time and budget?"

Observed baseline failure: the agent recommends "use Agile/Scrum, break it into 2-week sprints, build a
Gantt chart / product backlog, estimate the tasks and add ~10-15% buffer, hold daily standups, track with a
burndown, and do a lessons-learned at the end." Method chosen by fashion not context; single estimate + one
flat buffer; no baseline/controls framing; risk register reduced to a checklist; scope-change governance
absent; benefits never defined; closeout is a shelved lessons doc.

## Pass
With the project-management skill loaded, the agent:
- **Matches method to context** (agileometer: how much does the work benefit from agility?) and names the
  trade-off — likely **hybrid / structured agility**, not reflexive Scrum.
- **Estimates twice** by different methods, reconciles the gap, and **red-teams** the number; adds
  **per-workstream contingency** (~10%→40% by uncertainty), not one flat %.
- Insists on a **locked baseline + the five project controls** (esp. change control + risk) because the #1
  failure mode is poor *control*, not poor planning; reads the burndown (flatline-at-top = WIP/over-planning).
- Runs a **living risk register**: exponential scale (1-2-4-8-16), unique IDs, one **named owner** per risk,
  transferred-≠-removed.
- **Governs scope creep** via a change process (PM governs, doesn't personally decide); refuses with a
  **Noble Objection**, never a naked no.
- Closes on a **Definition of Done incl. shipability + real-user UAT**, and identifies **1–3 measurable
  benefits before initiating** (post-kickoff benefit-hunting = "benefit fraud").
- Cites `(src: PM <id>)`, frames numbers as directional, and defers SOW/onboarding + deep-Kanban/Scrum-
  ceremony/CPM-math to siblings/dedicated sources.

## Rubric (score each 0-2; pass ≥ 12/16)
1. Method chosen against context (agileometer), with the trade-off named — not defaulted to a fashion.
2. Estimate produced by two methods + reconciled + red-teamed; contingency tailored per workstream, not one flat %.
3. Locked baseline + project controls named as the mechanism of control; poor-control-not-poor-planning framing present.
4. Living risk register: exponential scale, unique IDs, single named owner, transferred-still-monitored.
5. Scope change routed through governance (PM governs, not personally decides); Noble Objection over a naked no.
6. Definition of Done includes shipability + real-user UAT; backlog-completion tracked over task busywork.
7. 1–3 measurable benefits identified before initiating; closeout embeds lessons in live data, not a shelved doc.
8. Claims cite `(src: PM <id>)`; numbers directional; SOW/onboarding + deep-Kanban/Scrum/CPM deferred.

**Fail** if the output is "use Scrum, 2-week sprints, Gantt, one estimate + 10% buffer, standups, burndown,
lessons doc at the end" — i.e. fashion-first, single-estimate, no-baseline-control, benefits-never-defined
generic PM, indistinguishable from the no-skill baseline.
