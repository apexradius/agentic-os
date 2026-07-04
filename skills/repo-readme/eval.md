---
skill: repo-readme
---
# Eval: repo-readme

A failing-baseline eval — without the skill the agent writes a wall-of-text README; with the
skill it produces a diagram-driven, persona-routed doc an outsider can follow.

## Baseline
Prompt the agent **without** the repo-readme skill loaded:

> "Write a README for this repo."

Observed baseline failure: the agent produces a flat wall of prose — a title, a paragraph, an
install snippet — with no architecture diagram, no flow/sequence visuals, and no routing for
different readers. A newcomer still can't see how the system fits together.

## Pass
With the repo-readme skill loaded, the agent produces a README with Mermaid architecture + flow
diagrams, persona-routed entry points ("you are a user / a contributor / here for X"), a
hub-and-spoke docs structure, truthful repo-home badges/proof, and a source social-preview asset
when the repository is public-facing.

Pass criterion: the README includes at least one architecture/flow diagram and persona-routed
navigation, readable by an outsider. **Fail** if it's prose-only with no diagrams or reader
routing, or if it invents homepage proof such as unsupported "passing", adoption, production,
security, or performance claims.
