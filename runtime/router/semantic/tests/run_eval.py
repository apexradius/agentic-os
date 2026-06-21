"""Run the held-out eval set, emit confusion matrix + per-route precision/recall.

Usage:
    .venv/bin/python tests/run_eval.py
"""
from __future__ import annotations

import sys
from collections import defaultdict
from pathlib import Path

import yaml

# Make the router importable without installing the package
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src.router import classify

EVAL_FILE = Path(__file__).resolve().parent / "eval_set.yaml"


def main() -> int:
    with open(EVAL_FILE) as f:
        cases = yaml.safe_load(f)["cases"]

    routes = ["chitchat", "tool_op", "engineering"]
    cm = defaultdict(lambda: defaultdict(int))  # cm[expected][predicted] = count
    failures = []

    for c in cases:
        prompt = c["prompt"]
        expected = c["expected"]
        decision = classify(prompt)
        # Fallback (no match) maps to engineering for the dispatcher; treat as engineering for the matrix
        predicted = decision.route
        cm[expected][predicted] += 1
        if predicted != expected:
            failures.append((prompt, expected, predicted, decision.score, decision.fallback_used))

    # Print confusion matrix
    print(f"\n{'Confusion matrix':<24}{'predicted →':<24}")
    print(f"{'expected ↓':<22}", end="")
    for r in routes:
        print(f"{r:<14}", end="")
    print(f"{'total':<8}")
    print("-" * 80)
    for exp in routes:
        print(f"  {exp:<20}", end="")
        row_total = 0
        for pred in routes:
            n = cm[exp][pred]
            print(f"{n:<14}", end="")
            row_total += n
        print(f"{row_total:<8}")

    # Per-route precision / recall
    print(f"\n{'Per-route metrics':<24}")
    print(f"  {'route':<14}{'precision':<14}{'recall':<14}{'f1':<8}")
    print("-" * 50)
    for r in routes:
        tp = cm[r][r]
        fp = sum(cm[other][r] for other in routes if other != r)
        fn = sum(cm[r][other] for other in routes if other != r)
        prec = tp / (tp + fp) if (tp + fp) else 0.0
        rec = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
        print(f"  {r:<14}{prec:<14.3f}{rec:<14.3f}{f1:<8.3f}")

    # Acceptance criteria
    chitchat_fp_rate = sum(cm[other]["chitchat"] for other in routes if other != "chitchat") / len(cases)
    tool_op_tp = cm["tool_op"]["tool_op"]
    tool_op_fp = sum(cm[other]["tool_op"] for other in routes if other != "tool_op")
    tool_op_prec = tool_op_tp / (tool_op_tp + tool_op_fp) if (tool_op_tp + tool_op_fp) else 0.0
    overall_correct = sum(cm[r][r] for r in routes)
    overall_acc = overall_correct / len(cases)

    print(f"\n{'Acceptance criteria':<24}")
    print(f"  chitchat FP rate:    {chitchat_fp_rate:.3f}  (target: 0.000)  {'✓' if chitchat_fp_rate == 0 else '✗'}")
    print(f"  tool_op precision:   {tool_op_prec:.3f}  (target: ≥ 0.900)  {'✓' if tool_op_prec >= 0.9 else '✗'}")
    print(f"  overall accuracy:    {overall_acc:.3f}  (target: ≥ 0.850)  {'✓' if overall_acc >= 0.85 else '✗'}")

    if failures:
        print(f"\n{'Failures':<24}({len(failures)})")
        for prompt, exp, pred, score, fb in failures:
            tag = "(fallback)" if fb else ""
            print(f"  ✗ '{prompt[:60]}' expected={exp} got={pred} score={score:.3f} {tag}")

    print()
    return 0 if (chitchat_fp_rate == 0 and tool_op_prec >= 0.9 and overall_acc >= 0.85) else 1


if __name__ == "__main__":
    sys.exit(main())
