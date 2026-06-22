---
skill: market-scan
---
# Eval: market-scan

A failing-baseline eval — without the skill the agent gives a hand-wave on a market; with the
skill it quantifies size, players, pricing, and scores the opportunity with evidence.

## Baseline
Prompt the agent **without** the market-scan skill loaded:

> "Is the market for X worth entering?"

Observed baseline failure: the agent answers "yes, it's a big and growing market" with no
sizing, no named competitors, no pricing data, and no validation — an unfalsifiable opinion.

## Pass
With the market-scan skill loaded, the agent reports market size, key players, pricing, trends,
and pain points, then scores the opportunity against evidence.

Pass criterion: the scan includes a sizing figure with its source, named competitors with
pricing, identified pain points, and an opportunity score with the reasoning behind it. **Fail**
if it returns "big growing market" with no quantification or evidence.
