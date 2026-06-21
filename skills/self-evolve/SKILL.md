---
name: self-evolve
description: "Capture lessons from corrections and confirmations into memory. Closed feedback loop with contradiction detection and aggregation. Triggers on user feedback or discovered patterns."
user-invocable: true
---

# Self-Evolve — Closed Feedback Loop

Learn from every correction AND confirmation. Check memory before acting. Surface contradictions. Consolidate patterns into rules.

## Pre-Task Check (MANDATORY)

Before any substantive task:
1. Scan memory for feedback entries relevant to the task type
2. If matches found, apply them — state which memories influenced your approach
3. If no matches, proceed but stay alert for new lessons

## Trigger Conditions

- User corrects: "no", "don't do X", "stop doing Y"
- User confirms non-obvious approach: "perfect", "yes exactly"
- A tool/approach fails and you find a better alternative
- You discover a project-specific pattern worth remembering

## Capture Format

**Corrections:** `Type: feedback | Rule: [what to do] | Why: [reason] | Trigger: [when it applies] | Replaces: [old memory or "new"]`

**Confirmations:** `Type: feedback | Rule: [validated approach] | Why: [confirmed by user/results] | Trigger: [when to reuse]`

**Discoveries:** `Type: project | Fact: [what was learned] | Context: [why it matters] | Trigger: [how it shapes future work]`

## Contradiction Detection

When saving new feedback:
1. Search existing memories for entries about the same topic
2. If contradiction found: surface both to user, do NOT silently overwrite
3. If refinement (not contradiction): update in place

## Feedback Aggregation

After saving, check: are there 3+ entries about the same pattern? If yes, suggest consolidating into a CLAUDE.md rule. If user approves, write the rule and archive individual memories.

## Rules

1. Capture from both failure AND success
2. Always include "why" — bare rules become blindly followed
3. Check for existing memories first — update, don't duplicate
4. Be specific — "use HTTPS URLs for npm" not "be careful with URLs"
5. Never save ephemeral state — only future-session patterns
6. Never skip the pre-task memory check

## Anti-Patterns

- Saving every minor interaction (noise drowns signal)
- Overwriting contradictions without user confirmation
- Forgetting to check memories before starting work (open loop)
