---
skill: ai-sdk
---
# Eval: ai-sdk

A failing-baseline eval — without the skill the agent hand-rolls raw provider HTTP calls from
memory; with the skill it uses the AI SDK's current primitives correctly.

## Baseline
Prompt the agent **without** the ai-sdk skill loaded:

> "Add a feature that streams a model response and calls a tool when needed."

Observed baseline failure: the agent writes raw `fetch` calls to a provider endpoint with a
hand-built request body and manual SSE parsing, or uses an outdated SDK signature. Tool calling is
improvised and the streaming is brittle.

## Pass
With the ai-sdk skill loaded, the agent uses the SDK's current primitives (e.g. `streamText` with
typed `tools`) per the documented API, not hand-rolled HTTP.

Pass criterion: the implementation uses the SDK's streaming + tool-calling primitives with the
current API shape. **Fail** if it hand-builds provider HTTP/SSE or uses a deprecated SDK signature.
