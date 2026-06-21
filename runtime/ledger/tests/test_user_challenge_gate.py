from __future__ import annotations

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AORG = ROOT / "aorg"


def run_review(state_dir: Path, role: str, task_id: str, *extra: str) -> subprocess.CompletedProcess:
    env = dict(os.environ)
    env["AORG_CANONICAL_MODE"] = "0"   # force local execution, bypass broker
    env["AORG_STATE_DIR"] = str(state_dir)
    cmd = [
        "python3", str(AORG), "review", role, task_id,
        "--decision", "pass", "--summary", "s", "--evidence", "note:e", *extra,
    ]
    return subprocess.run(cmd, capture_output=True, text=True, env=env)


def write_tasks(state_dir: Path, tasks: list[dict]) -> None:
    (state_dir / "reports").mkdir(parents=True, exist_ok=True)
    (state_dir / "tasks.jsonl").write_text(
        "\n".join(json.dumps(t) for t in tasks) + "\n", encoding="utf-8"
    )


def task_status(state_dir: Path, task_id: str) -> dict:
    for line in (state_dir / "tasks.jsonl").read_text().splitlines():
        if line.strip():
            t = json.loads(line)
            if t["id"] == task_id:
                return t
    raise AssertionError(f"task {task_id} not found")


class UserChallengeGateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="aorg-uc-test-"))

    def test_single_challenge_does_not_block(self):
        write_tasks(self.tmp, [
            {"id": "T", "title": "t", "status": "review-pending", "reviewer": "codex", "reviews": []},
        ])
        run_review(self.tmp, "codex", "T", "--challenge")
        t = task_status(self.tmp, "T")
        self.assertEqual(t["status"], "complete")
        self.assertNotIn("user_challenge", t)

    def test_two_distinct_challengers_escalate(self):
        write_tasks(self.tmp, [
            {"id": "T", "title": "t", "status": "review-pending", "reviewer": "claude",
             "reviews": [{"reviewer": "claude", "decision": "pass", "summary": "premise wrong",
                          "evidence": ["note:a"], "reviewed_at": "2026-06-01T00:00:00Z", "challenge": True}]},
        ])
        run_review(self.tmp, "codex", "T", "--challenge")
        t = task_status(self.tmp, "T")
        self.assertEqual(t["status"], "pending-human")
        self.assertEqual(t["escalation_to"], "ayo")
        self.assertIn("user_challenge", t)
        self.assertEqual(sorted(t["user_challenge"]["challengers"]), ["claude", "codex"])
        esc = (self.tmp / "escalations.jsonl").read_text()
        self.assertIn("user_challenge", esc)

    def test_no_challenge_is_backward_compatible(self):
        write_tasks(self.tmp, [
            {"id": "T", "title": "t", "status": "review-pending", "reviewer": "codex", "reviews": []},
        ])
        run_review(self.tmp, "codex", "T")  # no --challenge
        t = task_status(self.tmp, "T")
        self.assertEqual(t["status"], "complete")
        self.assertNotIn("user_challenge", t)

    def test_same_reviewer_twice_is_not_two_challengers(self):
        # two challenge reviews from the SAME reviewer must NOT trip the 2-distinct gate
        write_tasks(self.tmp, [
            {"id": "T", "title": "t", "status": "review-pending", "reviewer": "codex",
             "reviews": [{"reviewer": "codex", "decision": "pass", "summary": "x",
                          "evidence": ["note:a"], "reviewed_at": "2026-06-01T00:00:00Z", "challenge": True}]},
        ])
        run_review(self.tmp, "codex", "T", "--challenge")
        t = task_status(self.tmp, "T")
        self.assertEqual(t["status"], "complete")
        self.assertNotIn("user_challenge", t)


if __name__ == "__main__":
    unittest.main(verbosity=2)
