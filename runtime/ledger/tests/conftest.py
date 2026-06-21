"""conftest.py — isolation + live-plane tripwire for the framework aorg engine tests.

These tests exercise a COPY of the live aorg engine (framework/runtime/ledger/aorg). They
must NEVER touch the live broker socket, the live ledger, or the VPS/tailnet. Two guards:

  1. Isolation env, set at conftest import (before any test module loads the engine):
     AORG_CANONICAL_MODE=0 (local execution, no canonical proxy), AORG_VPS_MIRROR=0
     (no mirror), AORG_BROKER_DISABLE=1 (no broker transport). Belt-and-suspenders — the
     subprocess tests also set AORG_CANONICAL_MODE=0 per call.
  2. Live-plane tripwire (risk R1): fingerprint the live socket + live tasks.jsonl + broker
     PID at session start; assert byte-for-byte unchanged at session end. Any drift fails
     the run loudly — proof the isolated tests stayed isolated.
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest

# ── 1. Force isolation BEFORE any test module imports the engine ──────────────
os.environ.setdefault("AORG_BIN", str(Path(__file__).resolve().parents[1] / "aorg"))
os.environ.setdefault(
    "AORG_ROLES_FILE", str(Path(__file__).resolve().parent / "fixtures" / "roles.json")
)
os.environ.setdefault("AORG_CANONICAL_MODE", "0")
os.environ["AORG_VPS_MIRROR"] = "0"
os.environ["AORG_BROKER_DISABLE"] = "1"

# ── 2. Live-plane tripwire targets ────────────────────────────────────────────
# The live ledger path is instance-specific — supplied via AORG_TRIPWIRE_TASKS so this
# conftest stays Apex-free (zone-pure). When unset, the tripwire still guards the broker
# socket + pid (generic tmp paths), which are the highest-risk live assets.
_LIVE_TASKS = os.environ.get("AORG_TRIPWIRE_TASKS")
_LIVE_STATE = Path(_LIVE_TASKS) if _LIVE_TASKS else None
_LIVE_SOCK = Path(f"/private/tmp/aorg-broker-{os.getuid()}.sock")
_LIVE_PID = Path(f"/private/tmp/aorg-broker-{os.getuid()}.pid")


def _fingerprint() -> dict:
    fp: dict = {}
    for p in (_LIVE_STATE, _LIVE_SOCK):
        if p is None:
            continue
        try:
            st = p.stat()
            fp[str(p)] = (st.st_mtime_ns, st.st_size)
        except FileNotFoundError:
            fp[str(p)] = None
    try:
        fp["broker_pid"] = _LIVE_PID.read_text().strip()
    except FileNotFoundError:
        fp["broker_pid"] = None
    return fp


@pytest.fixture(scope="session", autouse=True)
def _live_plane_tripwire():
    before = _fingerprint()
    yield
    after = _fingerprint()
    assert before == after, (
        "LIVE-PLANE TRIPWIRE FIRED — engine tests mutated the live socket/ledger/pid:\n"
        f"  before={before}\n  after={after}"
    )
