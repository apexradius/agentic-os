# router/semantic — the semantic classifier

A FastEmbed semantic router that classifies a prompt into one of `{chitchat, tool_op, engineering}`
so a dispatcher can pick the right pipeline (cheap model for chitchat, context-light path for tool
ops, full pipeline for engineering). First classify ~1.5s (model load), then sub-millisecond; an
optional long-lived daemon keeps the model hot.

| File | Role |
|---|---|
| `src/router.py` | Single source of truth — `classify(prompt) -> Decision`. CLI and hooks import from here. |
| `src/router_daemon.py` | Long-lived daemon over a Unix socket (`/tmp/apex-router.sock`) — skips the cold-start import cost. |
| `src/gemini_client.py` | Fast chitchat path — a direct model call, bypassing a full agent session. |
| `tests/run_eval.py` + `tests/eval_set.yaml` | Accuracy eval harness over a labelled utterance set. |
| `config/routes.example.yaml` | Generic, runnable route definitions (copy → `routes.yaml`, or override the path). |

## Configuration (env)

| Var | Meaning | Default |
|---|---|---|
| `APEX_ROUTER_ROUTES` | Path to the routes YAML (the instance's tuned utterances + thresholds). | `config/routes.yaml`, else the shipped `config/routes.example.yaml` |

The Apex tuned routes and the `apex` launcher CLI are **instance content** under
`apex/config/orchestration/` — they are not shipped here.

## Setup / run

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python -m src.router "build a FastAPI endpoint for signup"   # → {"route": "engineering", ...}
python -m src.router_daemon                                  # optional: keep the model hot
python tests/run_eval.py                                     # accuracy eval
```
