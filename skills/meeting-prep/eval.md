---
skill: meeting-prep
---
# Eval: meeting-prep

A failing-baseline eval — without the skill the agent gives generic meeting tips; with the skill
it builds a prep pack from the actual attendees, history, and agenda.

## Baseline
Prompt the agent **without** the meeting-prep skill loaded:

> "Prep me for my 2pm with the Acme account."

Observed baseline failure: the agent offers generic advice ("review your notes, set an agenda")
without pulling the calendar event, prior thread/context with that account, or open items. The
user walks in cold.

## Pass
With the meeting-prep skill loaded, the agent assembles a prep pack — attendees, relevant history
(prior emails/notes), open items, and talking points/agenda.

Pass criterion: the prep reflects the specific meeting (real attendees, real prior context, open
items), not generic tips. **Fail** if it gives generic meeting advice with no pulled context.
