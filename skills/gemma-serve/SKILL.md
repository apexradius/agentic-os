---
name: gemma-serve
description: "Deploy and manage local LLM serving — Ollama, vLLM, llama.cpp. Model selection by task, hardware requirements, API integration. Use when running local models, /gemma-serve."
user-invocable: true
disable-model-invocation: true
argument-hint: "[action] [model-name]"
---

# Gemma Serve

## Step 1: Choose Deployment Backend

| Backend | Best For | Setup Complexity | GPU Required |
|---------|----------|-----------------|--------------|
| **Ollama** | Quick local dev, single-user | Low (brew install) | No (CPU ok, GPU faster) |
| **vLLM** | Production serving, high throughput | Medium (pip + CUDA) | Yes |
| **llama.cpp** | Maximum control, minimal deps | Medium (cmake build) | No (GGUF quantized) |

**Default recommendation:** Ollama for local development, vLLM for production serving.

## Step 2: Select Model by Task

| Task | Model Size | Recommended | RAM Required |
|------|-----------|-------------|-------------|
| Chat / Q&A | Small (2-3B) | `gemma2:2b`, `llama3.2:3b` | 4 GB |
| Code generation | Medium (7-9B) | `gemma2:9b`, `codellama:7b`, `deepseek-coder:6.7b` | 8 GB |
| Reasoning / analysis | Large (27B+) | `gemma2:27b`, `llama3.1:70b` (Q4) | 20-48 GB |
| Embeddings | Embedding-specific | `nomic-embed-text`, `mxbai-embed-large` | 2 GB |

**Decision criteria:** Match model size to available RAM. Leave 2-4 GB headroom for OS and applications. Quantized models (Q4_K_M) use roughly half the RAM of full precision.

## Step 3: Deploy with Ollama (Primary Path)

```bash
# Install
brew install ollama

# Start server (runs on localhost:11434)
ollama serve &

# Pull model
ollama pull gemma2:9b

# Verify
curl -s http://localhost:11434/api/tags | jq '.models[].name'
```

### Actions
- **start:** `ollama serve` (check if already running: `curl -s http://localhost:11434/api/tags`)
- **stop:** `pkill ollama` or stop the background process
- **pull:** `ollama pull [model-name]`
- **status:** `ollama list` (downloaded) + `ollama ps` (currently loaded)
- **remove:** `ollama rm [model-name]`

## Step 4: Integration Patterns

### REST API (Single Request)
```bash
curl http://localhost:11434/api/generate \
  -d '{"model":"gemma2:9b","prompt":"Your prompt","stream":false}'
```

### Streaming Response
```bash
curl http://localhost:11434/api/generate \
  -d '{"model":"gemma2:9b","prompt":"Your prompt","stream":true}'
```

### Chat Format (Multi-Turn)
```bash
curl http://localhost:11434/api/chat \
  -d '{"model":"gemma2:9b","messages":[{"role":"user","content":"Hello"}],"stream":false}'
```

### Batch Processing (Python)
```python
import requests
prompts = ["prompt1", "prompt2", "prompt3"]
results = []
for p in prompts:
    r = requests.post("http://localhost:11434/api/generate",
        json={"model": "gemma2:9b", "prompt": p, "stream": False})
    results.append(r.json()["response"])
```

### OpenAI-Compatible Endpoint
Ollama serves an OpenAI-compatible API at `http://localhost:11434/v1/` — use with any OpenAI SDK by changing the base URL.

## Step 5: Production Hardening (vLLM)

For production serving with high concurrency:

```bash
pip install vllm
python -m vllm.entrypoints.openai.api_server \
  --model google/gemma-2-9b-it \
  --port 8000 \
  --max-model-len 8192
```

Benefits: continuous batching, PagedAttention, OpenAI-compatible API, multi-GPU support.

## Anti-Patterns

- **Running a 27B model on 16 GB RAM** — constant swapping destroys performance; use a smaller model or quantized version
- **Leaving models loaded when not in use** — `ollama ps` and unload idle models to free RAM
- **Using generate API for multi-turn chat** — use the chat API to maintain conversation context
- **No health check** — always verify the server is responding before sending real requests
- **Ignoring quantization options** — Q4_K_M offers the best size-to-quality tradeoff for most tasks
