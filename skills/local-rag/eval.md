---
skill: local-rag
---
# Eval: local-rag

A failing-baseline eval — without the skill the agent answers over a corpus from memory or a naive
keyword grep; with the skill it builds a real retrieval pipeline and answers with citations.

## Baseline
Prompt the agent **without** the local-rag skill loaded:

> "Let me ask questions over this folder of internal docs, offline."

Observed baseline failure: the agent either answers from memory or does a crude keyword grep with no
chunking, embeddings, or reranking. Answers miss relevant passages and aren't grounded in the
corpus.

## Pass
With the local-rag skill loaded, the agent builds the pipeline — ingest, chunk, embed, index, query,
rerank — running offline (e.g. ChromaDB + Ollama) and answers with passage citations.

Pass criterion: queries are answered via an embedding-based retrieval pipeline with reranking and
citations to the source chunks. **Fail** if it answers from memory or a naive keyword match with no
retrieval pipeline.
