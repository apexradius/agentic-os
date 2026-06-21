from __future__ import annotations

import importlib.machinery
import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "aorg"


def load_module():
    loader = importlib.machinery.SourceFileLoader("aorg_module_merge", str(SCRIPT))
    spec = importlib.util.spec_from_loader("aorg_module_merge", loader)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


AORG = load_module()


def task(task_id: str, **fields) -> dict:
    record = {"id": task_id, "status": "pending", "created_at": "2026-06-10T00:00:00Z"}
    record.update(fields)
    return record


class TestTaskProgressStamp(unittest.TestCase):
    def test_max_of_lifecycle_stamps(self):
        t = task(
            "a",
            created_at="2026-06-10T01:00:00Z",
            claimed_at="2026-06-10T02:00:00Z",
            completed_at="2026-06-10T03:00:00Z",
        )
        self.assertEqual(AORG.task_progress_stamp(t), "2026-06-10T03:00:00Z")

    def test_verification_runs_count_as_progress(self):
        t = task(
            "a",
            completed_at="2026-06-10T03:00:00Z",
            verification_runs=[{"completed_at": "2026-06-11T09:00:00Z"}],
        )
        self.assertEqual(AORG.task_progress_stamp(t), "2026-06-11T09:00:00Z")

    def test_no_stamps_ranks_lowest(self):
        self.assertEqual(AORG.task_progress_stamp({"id": "a"}), "")
        self.assertEqual(AORG.task_progress_stamp({"id": "a", "created_at": None}), "")

    def test_malformed_runs_ignored(self):
        t = task("a", created_at="2026-06-10T01:00:00Z", verification_runs=["junk", {"completed_at": 5}])
        self.assertEqual(AORG.task_progress_stamp(t), "2026-06-10T01:00:00Z")


class TestMergeTaskRecords(unittest.TestCase):
    def test_identical_ledgers_pass_through(self):
        canonical = [task("a"), task("b")]
        merged, local_only, local_won = AORG.merge_task_records(canonical, list(canonical))
        self.assertEqual(merged, canonical)
        self.assertEqual(local_only, [])
        self.assertEqual(local_won, [])

    def test_local_only_record_is_never_dropped(self):
        # The bb33fd regression: completed task exists only locally.
        canonical = [task("a")]
        rescued = task("bb33fd", status="complete", completed_at="2026-06-11T01:27:10Z")
        merged, local_only, local_won = AORG.merge_task_records(canonical, [task("a"), rescued])
        self.assertIn(rescued, merged)
        self.assertEqual(local_only, ["bb33fd"])
        self.assertEqual(local_won, [])
        self.assertEqual([t["id"] for t in merged], ["a", "bb33fd"])

    def test_union_invariant_no_id_lost_either_side(self):
        canonical = [task("a"), task("c"), task("d")]
        local = [task("a"), task("b"), task("e")]
        merged, _, _ = AORG.merge_task_records(canonical, local)
        self.assertEqual({t["id"] for t in merged}, {"a", "b", "c", "d", "e"})

    def test_conflict_later_local_progress_wins(self):
        canonical_rec = task("a", status="claimed", claimed_at="2026-06-10T01:00:00Z")
        local_rec = task("a", status="complete", claimed_at="2026-06-10T01:00:00Z", completed_at="2026-06-10T02:00:00Z")
        merged, local_only, local_won = AORG.merge_task_records([canonical_rec], [local_rec])
        self.assertEqual(merged, [local_rec])
        self.assertEqual(local_won, ["a"])
        self.assertEqual(local_only, [])

    def test_conflict_later_canonical_progress_wins(self):
        canonical_rec = task("a", status="complete", completed_at="2026-06-10T05:00:00Z")
        local_rec = task("a", status="claimed", claimed_at="2026-06-10T01:00:00Z")
        merged, _, local_won = AORG.merge_task_records([canonical_rec], [local_rec])
        self.assertEqual(merged, [canonical_rec])
        self.assertEqual(local_won, [])

    def test_tie_goes_to_canonical(self):
        canonical_rec = task("a", status="complete", completed_at="2026-06-10T05:00:00Z", summary="canonical")
        local_rec = task("a", status="complete", completed_at="2026-06-10T05:00:00Z", summary="local")
        merged, _, local_won = AORG.merge_task_records([canonical_rec], [local_rec])
        self.assertEqual(merged, [canonical_rec])
        self.assertEqual(local_won, [])

    def test_identical_conflict_records_not_flagged(self):
        rec = task("a", status="complete", completed_at="2026-06-10T05:00:00Z")
        merged, local_only, local_won = AORG.merge_task_records([rec], [dict(rec)])
        self.assertEqual(merged, [rec])
        self.assertEqual(local_only, [])
        self.assertEqual(local_won, [])

    def test_canonical_order_preserved_local_only_appended(self):
        canonical = [task("c1"), task("c2")]
        local = [task("l1"), task("c2"), task("l2")]
        merged, local_only, _ = AORG.merge_task_records(canonical, local)
        self.assertEqual([t["id"] for t in merged], ["c1", "c2", "l1", "l2"])
        self.assertEqual(local_only, ["l1", "l2"])

    def test_duplicate_ids_within_a_side_deduped(self):
        canonical = [task("a", summary="first"), task("a", summary="second")]
        local = [task("b"), task("b")]
        merged, local_only, _ = AORG.merge_task_records(canonical, local)
        self.assertEqual([t["id"] for t in merged], ["a", "b"])
        self.assertEqual(merged[0]["summary"], "first")
        self.assertEqual(local_only, ["b"])

    def test_non_dict_and_idless_records_tolerated(self):
        canonical = [task("a"), {"no_id": True}]
        local = ["garbage", task("b"), {"id": ""}]
        merged, local_only, _ = AORG.merge_task_records(canonical, local)
        self.assertIn({"no_id": True}, merged)
        self.assertEqual(local_only, ["b"])

    def test_empty_local_adopts_canonical(self):
        canonical = [task("a")]
        merged, local_only, local_won = AORG.merge_task_records(canonical, [])
        self.assertEqual(merged, canonical)
        self.assertEqual(local_only, [])
        self.assertEqual(local_won, [])

    def test_empty_canonical_keeps_all_local(self):
        local = [task("a"), task("b")]
        merged, local_only, _ = AORG.merge_task_records([], local)
        self.assertEqual(merged, local)
        self.assertEqual(local_only, ["a", "b"])


class TestReviewPassInvariantReconciliation(unittest.TestCase):
    def test_completed_pass_review_repairs_parent_after_merge(self):
        parent = task(
            "impl",
            status="review-pending",
            blocked_reason="completion_review_required:claude",
            completed_at="2026-06-11T06:11:49Z",
        )
        review = task(
            "review",
            mode="completion-review",
            status="complete",
            reviews_task="impl",
            review_passed=True,
            reviewed_at="2026-06-11T07:03:00Z",
            completed_at="2026-06-11T07:03:00Z",
            reviews=[
                {
                    "reviewer": "claude",
                    "decision": "pass",
                    "summary": "meets acceptance",
                    "reviewed_at": "2026-06-11T07:03:00Z",
                }
            ],
        )

        repaired = AORG.reconcile_review_pass_invariants([parent, review])

        self.assertEqual(repaired, ["impl"])
        self.assertEqual(parent["status"], "complete")
        self.assertIs(parent["review_passed"], True)
        self.assertEqual(parent["reviewed_at"], "2026-06-11T07:03:00Z")
        self.assertIsNone(parent["blocked_reason"])
        self.assertEqual(parent["reviews"], review["reviews"])

    def test_completed_pass_review_repair_is_idempotent(self):
        parent = task(
            "impl",
            status="complete",
            review_passed=True,
            reviewed_at="2026-06-11T07:03:00Z",
            blocked_reason=None,
            reviews=[
                {
                    "reviewer": "claude",
                    "decision": "pass",
                    "summary": "meets acceptance",
                    "reviewed_at": "2026-06-11T07:03:00Z",
                }
            ],
        )
        review = task(
            "review",
            mode="completion-review",
            status="complete",
            reviews_task="impl",
            review_passed=True,
            reviewed_at="2026-06-11T07:03:00Z",
            reviews=list(parent["reviews"]),
        )

        repaired = AORG.reconcile_review_pass_invariants([parent, review])

        self.assertEqual(repaired, [])
        self.assertEqual(len(parent["reviews"]), 1)

    def test_nonpassing_review_does_not_repair_parent(self):
        parent = task("impl", status="review-pending")
        review = task(
            "review",
            mode="completion-review",
            status="complete",
            reviews_task="impl",
            review_passed=False,
            reviewed_at="2026-06-11T07:03:00Z",
        )

        repaired = AORG.reconcile_review_pass_invariants([parent, review])

        self.assertEqual(repaired, [])
        self.assertEqual(parent["status"], "review-pending")


if __name__ == "__main__":
    unittest.main()
