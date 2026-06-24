#!/usr/bin/env python3
"""council_dissent_metric.py — anti-sycophancy gate (pure read, no mutation).

Computes the dissent rate of aorg cross-reviews, segmented by whether the review was BLINDED.
This is the executable proof the blind-review step actually changes reviewer behavior — without
it, blinding is a feel-good code path with no measured effect.

A "dissent" = a review whose decision is anything other than `pass`, OR which set `challenge`.
Segmentation key = review.get("blinded") truthiness (the field the ledger's --blind path adds).

State resolution: AORG_STATE_DIR env override, else ~/.local/state/aorg (the relocated aorg state
home). Missing/empty ledger is handled gracefully (n=0, rates null) — never raises.

Emits one JSON object: {blinded_dissent_rate, unblinded_dissent_rate, n_blind, n_open,
                        n_reviews, n_tasks_with_reviews, state_dir}
Exit 0 always on a readable (or absent) ledger.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

DEFAULT_STATE = Path.home() / ".local" / "state" / "aorg"


def state_dir() -> Path:
    return Path(os.environ.get("AORG_STATE_DIR", DEFAULT_STATE)).expanduser()


def is_dissent(review: dict) -> bool:
    decision = str(review.get("decision", "")).lower()
    return decision not in ("pass", "approved", "") or bool(review.get("challenge"))


def is_blinded(review: dict) -> bool:
    return bool(review.get("blinded"))


def iter_reviews(tasks_path: Path):
    if not tasks_path.is_file():
        return
    with tasks_path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                task = json.loads(line)
            except json.JSONDecodeError:
                continue
            reviews = task.get("reviews") or []
            if reviews:
                yield reviews


def rate(dissent: int, total: int):
    return round(dissent / total, 4) if total else None


def main() -> int:
    tasks_path = state_dir() / "tasks.jsonl"
    n_blind = d_blind = n_open = d_open = n_reviews = n_tasks = 0
    for reviews in iter_reviews(tasks_path):
        n_tasks += 1
        for rv in reviews:
            n_reviews += 1
            if is_blinded(rv):
                n_blind += 1
                d_blind += is_dissent(rv)
            else:
                n_open += 1
                d_open += is_dissent(rv)
    out = {
        "blinded_dissent_rate": rate(d_blind, n_blind),
        "unblinded_dissent_rate": rate(d_open, n_open),
        "n_blind": n_blind,
        "n_open": n_open,
        "n_reviews": n_reviews,
        "n_tasks_with_reviews": n_tasks,
        "state_dir": str(state_dir()),
    }
    json.dump(out, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
