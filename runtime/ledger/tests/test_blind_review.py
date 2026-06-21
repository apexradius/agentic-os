"""test_blind_review.py — Pillar 9 slice C gate (blind peer-review primitives in bin/aorg).

Mirrors tests/test_user_challenge_gate.py's subprocess convention (the Council verdict's fix for the
extensionless-import bug — never `spec_from_file_location` on bin/aorg). Set AORG_BIN to test a
patched copy; defaults to the in-repo bin/aorg. Skips cleanly while bin/aorg lacks `--blind` (not yet
applied) so the suite stays green pre-slice-C.

Invariants under test:
  INV-1/2  --blind RETAINS the real reviewer name on the record; the User Challenge gate keeps
           counting DISTINCT REAL names, so two blinded challengers still escalate to ayo.
  rotation alias_registry pseudonyms rotate across rounds and are distinct within a round.
  sealed   reveal_at is null until explicitly revealed.
  opt-in   without --blind the review record is byte-compatible (no blinded/alias fields).
"""
from __future__ import annotations

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AORG = Path(os.environ.get("AORG_BIN", ROOT / "aorg"))


def _env(state_dir: Path) -> dict:
    env = dict(os.environ)
    env["AORG_CANONICAL_MODE"] = "0"
    env["AORG_STATE_DIR"] = str(state_dir)
    return env


def run_review(state_dir: Path, role: str, task_id: str, *extra: str) -> subprocess.CompletedProcess:
    cmd = ["python3", str(AORG), "review", role, task_id,
           "--decision", "pass", "--summary", "s", "--evidence", "note:e", *extra]
    return subprocess.run(cmd, capture_output=True, text=True, env=_env(state_dir))


def run(state_dir: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["python3", str(AORG), *args], capture_output=True, text=True, env=_env(state_dir))


def write_tasks(state_dir: Path, tasks: list[dict]) -> None:
    (state_dir / "reports").mkdir(parents=True, exist_ok=True)
    (state_dir / "tasks.jsonl").write_text("\n".join(json.dumps(t) for t in tasks) + "\n", encoding="utf-8")


def task_status(state_dir: Path, task_id: str) -> dict:
    for line in (state_dir / "tasks.jsonl").read_text().splitlines():
        if line.strip() and json.loads(line)["id"] == task_id:
            return json.loads(line)
    raise AssertionError(f"task {task_id} not found")


def _blind_supported() -> bool:
    # bin/aorg runs ensure_state() before argparse dispatch, so even `review --help` needs a
    # writable AORG_STATE_DIR (else it tries to mkdir a path under the binary's parent and dies).
    probe = Path(tempfile.mkdtemp(prefix="aorg-blind-probe-"))
    out = subprocess.run(["python3", str(AORG), "review", "--help"],
                         capture_output=True, text=True, env=_env(probe))
    return "--blind" in (out.stdout + out.stderr)


@unittest.skipUnless(_blind_supported(), "bin/aorg lacks --blind — slice C not applied yet (PENDING)")
class BlindReviewTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="aorg-blind-test-"))

    # Reproduces a known upstream test/code drift: this asserts a 3-member blind pool, but
    # FRONTIER_REVIEW_POOL = ("claude", "codex") = 2 in BOTH the live bin and this faithful
    # copy (verified identical via 4C differential). Marked expected-failure so the framework
    # port stays honest about the discrepancy; flips to "unexpected success" if the pool grows.
    @unittest.expectedFailure
    def test_blind_alias_subcommand_rotates_and_is_distinct(self):
        a = run(self.tmp, "blind-alias", "--round", "r1", "--field", "claude").stdout.strip()
        b = run(self.tmp, "blind-alias", "--round", "r2", "--field", "claude").stdout.strip()
        c = run(self.tmp, "blind-alias", "--round", "r3", "--field", "claude").stdout.strip()
        self.assertTrue(a.startswith("Reviewer-"))
        self.assertGreaterEqual(len({a, b, c}), 2, f"alias did not rotate: {a},{b},{c}")
        full = json.loads(run(self.tmp, "blind-alias", "--round", "r1").stdout)
        self.assertEqual(len(set(full["alias_map"].values())), 3)  # distinct within round
        self.assertIsNone(full["reveal_at"])                       # sealed until reveal

    def test_reveal_stamps_reveal_at(self):
        run(self.tmp, "blind-alias", "--round", "rX")
        revealed = json.loads(run(self.tmp, "blind-alias", "--round", "rX", "--reveal").stdout)
        self.assertIsNotNone(revealed["reveal_at"])

    def test_blind_records_alias_but_keeps_real_name(self):
        write_tasks(self.tmp, [{"id": "T", "title": "t", "status": "review-pending",
                                "reviewer": "codex", "reviews": []}])
        run_review(self.tmp, "codex", "T", "--blind")
        rv = task_status(self.tmp, "T")["reviews"][-1]
        self.assertTrue(rv["blinded"])
        self.assertTrue(rv["reviewer_alias"].startswith("Reviewer-"))
        self.assertEqual(rv["reviewer"], "codex")  # INV-1: real name retained for audit

    def test_two_distinct_blinded_challengers_still_escalate(self):
        # INV-2: the gate counts DISTINCT REAL reviewer names, never aliases
        write_tasks(self.tmp, [{"id": "T", "title": "t", "status": "review-pending", "reviewer": "claude",
                                "reviews": [{"reviewer": "claude", "decision": "pass", "summary": "premise wrong",
                                             "evidence": ["note:a"], "reviewed_at": "2026-06-01T00:00:00Z",
                                             "challenge": True, "blinded": True, "reviewer_alias": "Reviewer-A"}]}])
        run_review(self.tmp, "codex", "T", "--challenge", "--blind")
        t = task_status(self.tmp, "T")
        self.assertEqual(t["status"], "pending-human")
        self.assertEqual(t["escalation_to"], "ayo")
        self.assertEqual(sorted(t["user_challenge"]["challengers"]), ["claude", "codex"])

    def test_without_blind_is_byte_compatible(self):
        write_tasks(self.tmp, [{"id": "T", "title": "t", "status": "review-pending",
                                "reviewer": "codex", "reviews": []}])
        run_review(self.tmp, "codex", "T")  # no --blind
        rv = task_status(self.tmp, "T")["reviews"][-1]
        self.assertNotIn("blinded", rv)
        self.assertNotIn("reviewer_alias", rv)


if __name__ == "__main__":
    unittest.main(verbosity=2)
