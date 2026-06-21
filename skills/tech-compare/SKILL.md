---
name: tech-compare
description: "Compare technologies, frameworks, or AI models — features, performance, pricing, model tiering, framework vs SDK decisions, retrieval strategy. Use when comparing tools, choosing tech stacks, or /tech-compare."
user-invocable: true
argument-hint: "[tech-a] [tech-b]"
---

# Tech Compare

## Steps
1. **Research each technology** — WebSearch for docs, benchmarks, GitHub stats
2. **Build comparison matrix** — features, performance, community, pricing, learning curve
3. **Assess migration effort** from current stack
4. **Recommend** with rationale
5. **Draft migration plan** if switching

## AI Model Evaluation Framework

### Model Tiering
| Tier | Models | Use For |
|------|--------|---------|
| Frontier Reasoner | Opus 4.6, GPT-o3 | Planning, orchestration, complex reasoning |
| Mid-tier | Sonnet 4.6, GPT-4.1 | Code generation, multi-step implementation |
| Small/Fast | Haiku 4.5, GPT-4.1-mini | Parallel research, classification, data labeling |

Rule: Match model cost to task complexity. Don't use Opus for tasks Sonnet handles.

### Framework vs SDK Decision
| Scenario | Choice |
|----------|--------|
| Personal use, reasoning overhead acceptable | SDK (Claude Agent SDK, Codex SDK) |
| Production-ready, multi-user, cost-sensitive | Framework (Pydantic AI, LangGraph) |

### Retrieval Strategy
| Data Type | Strategy |
|-----------|----------|
| Massive unstructured knowledge base | Traditional RAG / Semantic Search |
| Structured codebase with exact identifiers | File Search (Grep / RipGrep) |
| Hybrid (code + docs) | Combined: file search first, RAG fallback |

### Harness Engineering Note
Same model can produce 6x performance gap depending on how context is structured, retrieved, and presented. Benchmark your harness, not just the model.

## Anti-Patterns
- Benchmarking a model without the harness you'll actually use
- Choosing Frontier models for all tasks (token cost compounds fast)
- Using semantic RAG for exact code identifier lookups (precision suffers)
