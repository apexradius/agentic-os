# framework/prompting — how we write what agents read

Two layers, two files:

| File | Owns |
|---|---|
| [agent-prompt.md](agent-prompt.md) | **Structure** — the `<Agent_Prompt>` XML contract: which tags exist, their order, the two required shapes. The skeleton every agent body fills. |
| [techniques.md](techniques.md) | **Craft** — how to write the prose *inside* those tags so it works: six techniques, from decision-complete instructions to cache-aware prompt ordering. |

`agent-prompt.md` is enforced by the agents primitive
([../primitives/agents/](../primitives/agents/)): its validator checks the required `<Role>`
and the two-shape rule on every body. `techniques.md` is judgment, not a schema — the
difference between a body that passes the validator and a body that works.

These apply wherever we write instructions for a model to follow — agent bodies first, but
also skill procedures, command dispatch, and hook messages.

> Last reviewed: 2026-06-24
