"""Semantic Router — classify a prompt to one of {chitchat, tool_op, engineering}.

Single source of truth. CLI wrapper and Claude Code hook both import from here.
The router is built lazily and cached on the module — first call ~1.5s (FastEmbed model load),
subsequent calls sub-millisecond. The CLI prefers a long-lived daemon (router_daemon.py) on
/tmp/apex-router.sock — when reachable, it skips FastEmbed imports entirely (~3ms total).
"""
from __future__ import annotations

import json
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# Heavy imports (yaml + semantic_router + fastembed via SemanticRouter) are deferred to classify().
# Keeping them out of module scope means CLI invocations that hit the daemon socket never pay
# the ~1s import cost.

_CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"
_DEFAULT_ROUTES = _CONFIG_DIR / "routes.yaml"
# Routes are instance content: supply via APEX_ROUTER_ROUTES or drop a config/routes.yaml.
# Absent both, fall back to the shipped generic example so the engine runs out of the box.
ROUTES_YAML = Path(
    os.environ.get("APEX_ROUTER_ROUTES")
    or (_DEFAULT_ROUTES if _DEFAULT_ROUTES.exists() else _CONFIG_DIR / "routes.example.yaml")
)
DEFAULT_FALLBACK = "engineering"  # No-match defaults to full pipeline (safer than free model).

_router: Any | None = None  # SemanticRouter, late-bound
_routes_mtime: float = 0.0


@dataclass(frozen=True)
class Decision:
    route: str
    score: float
    fallback_used: bool
    elapsed_ms: float

    def to_json(self) -> str:
        return json.dumps({
            "route": self.route,
            "score": self.score,
            "fallback_used": self.fallback_used,
            "elapsed_ms": round(self.elapsed_ms, 2),
        })


def _load_routes():
    import yaml  # deferred — only imported on the in-process classify path
    from semantic_router import Route
    with open(ROUTES_YAML) as f:
        cfg = yaml.safe_load(f)
    return [
        Route(
            name=r["name"],
            utterances=r["utterances"],
            score_threshold=r.get("score_threshold"),
        )
        for r in cfg["routes"]
    ]


def _get_router():
    """Lazy build + auto-reload on routes.yaml mtime change."""
    from semantic_router import SemanticRouter  # deferred
    from semantic_router.encoders import FastEmbedEncoder  # deferred
    global _router, _routes_mtime
    current_mtime = ROUTES_YAML.stat().st_mtime
    if _router is None or current_mtime != _routes_mtime:
        _router = SemanticRouter(
            encoder=FastEmbedEncoder(),
            routes=_load_routes(),
            auto_sync="local",
        )
        _routes_mtime = current_mtime
    return _router


def classify(prompt: str) -> Decision:
    if not prompt or not prompt.strip():
        return Decision(route=DEFAULT_FALLBACK, score=0.0, fallback_used=True, elapsed_ms=0.0)

    t0 = time.perf_counter()
    router = _get_router()
    result = router(prompt)
    elapsed = (time.perf_counter() - t0) * 1000

    # SemanticRouter returns a RouteChoice with .name (None if no match) and .similarity_score.
    if result is None or result.name is None:
        return Decision(
            route=DEFAULT_FALLBACK,
            score=getattr(result, "similarity_score", 0.0) or 0.0,
            fallback_used=True,
            elapsed_ms=elapsed,
        )

    return Decision(
        route=result.name,
        score=result.similarity_score or 0.0,
        fallback_used=False,
        elapsed_ms=elapsed,
    )


SOCKET_PATH = "/tmp/apex-router.sock"


def _classify_via_socket(prompt: str, timeout_sec: float = 0.5) -> Decision | None:
    """Try the long-lived daemon. Returns None on any failure (no socket, timeout, etc.)."""
    if not os.path.exists(SOCKET_PATH):
        return None
    import socket as _sock
    s = _sock.socket(_sock.AF_UNIX, _sock.SOCK_STREAM)
    try:
        s.settimeout(timeout_sec)
        s.connect(SOCKET_PATH)
        s.sendall(prompt.encode("utf-8"))
        s.shutdown(_sock.SHUT_WR)  # signal end-of-prompt
        chunks = []
        while True:
            chunk = s.recv(4096)
            if not chunk:
                break
            chunks.append(chunk)
        data = b"".join(chunks).decode("utf-8")
        d = json.loads(data)
        return Decision(
            route=d["route"],
            score=d["score"],
            fallback_used=d["fallback_used"],
            elapsed_ms=d["elapsed_ms"],
        )
    except Exception:
        return None
    finally:
        try:
            s.close()
        except Exception:
            pass


def main() -> int:
    """CLI entry: `python -m router "prompt text"` or stdin if no arg.

    Tries the daemon first (sub-ms when running). Falls back to in-process
    classify() if the daemon isn't reachable. Emits one JSON line to stdout.
    """
    if len(sys.argv) > 1:
        prompt = " ".join(sys.argv[1:])
    else:
        prompt = sys.stdin.read()

    decision = _classify_via_socket(prompt) or classify(prompt)
    print(decision.to_json())
    return 0


if __name__ == "__main__":
    sys.exit(main())
