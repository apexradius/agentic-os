---
skill: gemma-serve
---
# Eval: gemma-serve

A failing-baseline eval — without the skill the agent picks a serving stack at random; with the
skill it matches the backend to the task and hardware and verifies it serves.

## Baseline
Prompt the agent **without** the gemma-serve skill loaded:

> "Serve a local LLM for our app."

Observed baseline failure: the agent reaches for one tool by default regardless of fit (e.g.
high-throughput vLLM on a laptop, or llama.cpp for a high-concurrency service), with no model-size
vs hardware check and no health verification. It may not run or will be badly matched.

## Pass
With the gemma-serve skill loaded, the agent selects the backend (Ollama / vLLM / llama.cpp) by
task and hardware, sizes the model to the hardware, and verifies the endpoint serves.

Pass criterion: the serving choice is justified by task + hardware and confirmed live with a health
check. **Fail** if it defaults to one backend with no fit reasoning or no verification that it
serves.
