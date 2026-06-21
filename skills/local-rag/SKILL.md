---
name: local-rag
description: "Build local RAG pipelines — ingest, chunk, embed, index, query, rerank. Fully offline with ChromaDB + Ollama. Use when building document search, knowledge bases, /local-rag."
user-invocable: true
disable-model-invocation: true
argument-hint: "[document-directory] [collection-name]"
---

# Local RAG Pipeline

## Architecture

```
Documents → Ingest → Chunk → Embed → Index (Vector Store)
                                            ↓
Query → Embed query → Similarity Search → Top-K → Rerank → LLM → Answer
```

## Stage 1: Ingest

Load documents from the target directory. Supported formats:

| Format | Library | Notes |
|--------|---------|-------|
| Markdown (.md) | Built-in read | Preserve headers as metadata |
| PDF (.pdf) | `pymupdf` or `pdfplumber` | Extract text per page, keep page numbers |
| HTML (.html) | `beautifulsoup4` | Strip tags, keep structure |
| Python (.py) / TypeScript (.ts) | Built-in read | Treat functions/classes as natural chunk boundaries |
| DOCX (.docx) | `python-docx` | Extract paragraphs and tables |

Track source file path and page/section number as metadata for every chunk — this enables citation in answers.

## Stage 2: Chunk

Choose a chunking strategy based on content type:

| Strategy | Best For | How It Works |
|----------|----------|-------------|
| **Semantic** | Prose, documentation | Split on paragraph/section boundaries; respect headers |
| **Fixed-size** | Uniform content | 500-1000 tokens per chunk with 100-token overlap |
| **Recursive** | Mixed content | Split by `\n\n` → `\n` → `. ` → ` ` until target size |
| **Code-aware** | Source code | Split on function/class boundaries using AST |

**Default recommendation:** Recursive with 500-token chunks and 100-token overlap. This handles most content well.

**Chunk size decision criteria:**
- Small chunks (200-500 tokens): higher precision retrieval, more chunks to search
- Large chunks (500-1500 tokens): more context per result, fewer chunks needed
- For Q&A, prefer smaller chunks. For summarization, prefer larger.

## Stage 3: Embed

```bash
# Pull embedding model via Ollama
ollama pull nomic-embed-text
```

| Embedding Model | Dimensions | Speed | Quality |
|----------------|-----------|-------|---------|
| `nomic-embed-text` | 768 | Fast | Good general-purpose |
| `mxbai-embed-large` | 1024 | Medium | Better for technical content |
| `all-minilm` (sentence-transformers) | 384 | Very fast | Lightweight, lower quality |

**Critical:** Use the same embedding model for indexing and querying. Mixing models produces garbage results.

## Stage 4: Index (Vector Store)

| Vector Store | Best For | Persistence | Setup |
|-------------|----------|-------------|-------|
| **ChromaDB** | Local dev, small-medium collections | File-based | `pip install chromadb` |
| **pgvector** | Production, existing Postgres | Database | Postgres extension |
| **Pinecone** | Cloud, large-scale, managed | Cloud-hosted | API key required |
| **FAISS** | In-memory, fast prototyping | Manual save/load | `pip install faiss-cpu` |

**Default recommendation:** ChromaDB for local/offline RAG.

```python
import chromadb
client = chromadb.PersistentClient(path="./chroma_db")
collection = client.get_or_create_collection(
    name="my_docs",
    metadata={"hnsw:space": "cosine"}
)
# Add chunks
collection.add(
    documents=chunks,
    metadatas=[{"source": path, "chunk_idx": i} for i, path in enumerate(sources)],
    ids=[f"doc_{i}" for i in range(len(chunks))]
)
```

## Stage 5: Query

```python
results = collection.query(
    query_texts=["user question"],
    n_results=5,
    include=["documents", "metadatas", "distances"]
)
```

Filter by metadata when possible: `where={"source": "specific_file.md"}` narrows the search space.

## Stage 6: Rerank (Optional but Recommended)

Initial vector similarity retrieval is fast but imprecise. Reranking improves relevance:

- **Cross-encoder reranking:** Use `sentence-transformers` CrossEncoder to score query-document pairs (slower but more accurate)
- **LLM-based reranking:** Ask the LLM to rank the top-K results by relevance (most accurate, slowest)
- **Simple heuristic:** Boost chunks where the query terms appear in the source metadata or headers

## Stage 7: Generate Answer

Feed retrieved context to the local LLM:

```python
context = "\n\n".join(results["documents"][0])
prompt = f"""Answer the question based ONLY on the following context.
If the context doesn't contain the answer, say "I don't have enough information."

Context:
{context}

Question: {query}
Answer:"""

response = requests.post("http://localhost:11434/api/generate",
    json={"model": "gemma2:9b", "prompt": prompt, "stream": False})
```

## Query Optimization Tips

1. **Hybrid search:** Combine vector similarity with keyword search (BM25) for better recall
2. **Query expansion:** Rephrase the user question as 2-3 variants and merge results
3. **Metadata filtering:** Narrow by source file, date, or category before vector search
4. **Max Marginal Relevance (MMR):** Diversify results to avoid returning near-duplicate chunks

## Anti-Patterns

- **Chunks too large (>2000 tokens)** — retrieval returns irrelevant padding; answers get diluted
- **No overlap between chunks** — context at chunk boundaries is lost; use 10-20% overlap
- **Mixing embedding models** — index with model A, query with model B = meaningless similarity scores
- **No citation/source tracking** — users need to verify answers; always return source metadata
- **Indexing without cleaning** — HTML tags, boilerplate, headers/footers add noise; clean before embedding
- **Skipping reranking on large collections** — top-5 from vector search alone often misses the best answer
