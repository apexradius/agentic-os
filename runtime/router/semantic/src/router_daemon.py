"""Long-lived router daemon — load FastEmbed once, serve classifications via Unix socket.

Eliminates the ~1.8s cold-start cost on ambiguous prompts (the case where the hook's
regex pre-filter doesn't match and falls through to ML classification).

Wire:
  - A process manager (launchd/systemd) keeps this running
  - Clients (CLI, router-hint hook) connect to /tmp/apex-router.sock
  - Protocol: client writes raw prompt bytes; daemon writes back one JSON line; close

Usage (manual / testing):
    .venv/bin/python -m src.router_daemon
"""
from __future__ import annotations

import os
import signal
import socket
import sys
from pathlib import Path

# Make the package importable when invoked as `-m src.router_daemon`
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src.router import classify

SOCKET_PATH = "/tmp/apex-router.sock"


def _cleanup(*_):
    try:
        os.unlink(SOCKET_PATH)
    except FileNotFoundError:
        pass


def main() -> int:
    _cleanup()

    # Warm up: force FastEmbed model load before accepting connections
    print("[apex-router-daemon] warming up FastEmbed...", file=sys.stderr, flush=True)
    classify("hi")
    print(f"[apex-router-daemon] ready, listening on {SOCKET_PATH}", file=sys.stderr, flush=True)

    server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    server.bind(SOCKET_PATH)
    os.chmod(SOCKET_PATH, 0o600)
    server.listen(8)

    def graceful(*_):
        _cleanup()
        sys.exit(0)

    signal.signal(signal.SIGTERM, graceful)
    signal.signal(signal.SIGINT, graceful)

    while True:
        try:
            conn, _ = server.accept()
        except OSError:
            continue
        try:
            conn.settimeout(2.0)
            data = conn.recv(8192).decode("utf-8", errors="replace").strip()
            if data:
                decision = classify(data)
                conn.sendall(decision.to_json().encode("utf-8"))
        except Exception as e:
            print(f"[apex-router-daemon] handler error: {e}", file=sys.stderr, flush=True)
        finally:
            try:
                conn.close()
            except Exception:
                pass


if __name__ == "__main__":
    sys.exit(main())
