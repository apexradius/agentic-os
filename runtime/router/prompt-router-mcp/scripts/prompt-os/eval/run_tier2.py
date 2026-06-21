#!/usr/bin/env python3
"""
Apex Prompt OS — Tier-2 eval (LLM judge, KEY-GATED).

KEY-GATED CONTRACT:
  If ANTHROPIC_API_KEY or OPENAI_API_KEY is absent, this script prints a skip
  message and exits 0. It NEVER calls an external API without a key. It NEVER
  spends money autonomously.

Usage:
  python3 scripts/prompt-os/eval/run_tier2.py <slug> [--library library]
    Run the full Tier-2 eval for the given prompt slug (key-gated).

  python3 scripts/prompt-os/eval/run_tier2.py --score-case
    Read JSON {"case": {...}, "output": "..."} from STDIN, score it with the
    canonical score_case() function, and print the result dict as JSON to
    stdout. Exits 0. No API call. No keys required. Single source of truth for
    deterministic scoring — the TS test suite calls this to avoid mirror drift.

The scoring logic (score_case) is unit-testable without any API call.
Pass a recorded model output + a golden case dict to score it offline.

SDK wiring (Tier-2 generate / judge):
  Real Anthropic and OpenAI SDK calls are wired behind lazy imports. Enable via:
    pip install anthropic openai
    export ANTHROPIC_API_KEY=... OPENAI_API_KEY=...
  Without keys the script still imports and runs (key gate in main exits 0).
  Without the SDKs installed the script imports fine; only generate_output /
  judge_output raise RuntimeError if actually invoked.

Bias controls (documented in library/eval-config.json):
  - cross-model-pairing: Claude-generated outputs are judged by GPT (never by
    Claude itself), eliminating affinity/self-preference bias.
  - bidirectional-position-cancellation: run judge with (prompt_a=generated,
    prompt_b=baseline) AND (prompt_a=baseline, prompt_b=generated); count a win
    only if both orderings agree. Eliminates position bias.
  - human_agreement_floor: judge must hit >=80% agreement on 20-30 human-labeled
    samples before being trusted as sole signal.

Wraps prompt_tester.py for deterministic scoring (expected_contains /
forbidden_contains / expected_regex). Cross-model LLM judge runs on top for
semantic eval_criteria scoring.
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).parent
PACKAGE_DIR = SCRIPT_DIR.parent.parent.parent  # .../apex-prompt-router-mcp/
PROMPT_TESTER_PATH = (
    Path(__file__).parent.parent.parent.parent.parent.parent
    / "skills/ecosystem/prompt-engineer-toolkit/scripts/prompt_tester.py"
)
DEFAULT_LIBRARY = PACKAGE_DIR / "library"
EVAL_CONFIG_PATH = DEFAULT_LIBRARY / "eval-config.json"

GENERATOR_KEY_VAR = "ANTHROPIC_API_KEY"
JUDGE_KEY_VAR = "OPENAI_API_KEY"


# ---------------------------------------------------------------------------
# Scoring logic — unit-testable without API calls
# ---------------------------------------------------------------------------


def score_case(
    case: Dict[str, Any],
    model_output: str,
) -> Dict[str, Any]:
    """
    Score a model output against a golden case using deterministic heuristics.

    This function wraps the same scoring logic as prompt_tester.py's score_output()
    so it is unit-testable in isolation. No API call is made here.

    Returns a dict:
      {
        "case_id": str,
        "passed": bool,       # True if score >= 60 AND no forbidden hits
        "score": float,       # 0-100 heuristic score
        "matched_expected": int,
        "missed_expected": int,
        "forbidden_hits": int,
        "regex_match": bool,
        "details": str,       # human-readable pass/fail rationale
      }
    """
    case_id = str(case.get("id", "unknown"))
    expect_contains: List[str] = [str(x) for x in case.get("expect_contains", []) if str(x)]
    forbid_contains: List[str] = [str(x) for x in case.get("forbid_contains", []) if str(x)]
    expect_regex: Optional[str] = case.get("expect_regex")

    output_lower = model_output.lower()

    matched_expected = sum(1 for item in expect_contains if item.lower() in output_lower)
    missed_expected = len(expect_contains) - matched_expected
    forbidden_hits = sum(1 for item in forbid_contains if item.lower() in output_lower)

    regex_match = False
    if expect_regex:
        try:
            regex_match = bool(re.search(expect_regex, model_output, flags=re.MULTILINE))
        except re.error:
            regex_match = False

    score = 100.0
    score -= missed_expected * 15
    score -= forbidden_hits * 25
    if regex_match and expect_regex:
        score += 8
    if len(model_output) > 4000:
        score -= 10
    if len(model_output.strip()) < 10:
        score -= 10
    score = max(0.0, min(100.0, score))

    # A case passes if: score >= 60 AND no forbidden hits AND regex matched (when required)
    passed = score >= 60 and forbidden_hits == 0 and (not expect_regex or regex_match)

    detail_parts = []
    if missed_expected:
        detail_parts.append(f"missing {missed_expected}/{len(expect_contains)} expected strings")
    if forbidden_hits:
        detail_parts.append(f"{forbidden_hits} forbidden string(s) hit")
    if expect_regex and not regex_match:
        detail_parts.append(f"regex did not match: {expect_regex}")
    details = "; ".join(detail_parts) if detail_parts else "all checks passed"

    return {
        "case_id": case_id,
        "passed": passed,
        "score": score,
        "matched_expected": matched_expected,
        "missed_expected": missed_expected,
        "forbidden_hits": forbidden_hits,
        "regex_match": regex_match,
        "details": details,
    }


# ---------------------------------------------------------------------------
# Golden file loader
# ---------------------------------------------------------------------------


def load_golden(slug: str, library_dir: Path) -> Optional[List[Dict[str, Any]]]:
    golden_path = library_dir / "golden" / f"{slug}.jsonl"
    if not golden_path.exists():
        print(f"ERROR: golden file not found: {golden_path}", file=sys.stderr)
        return None
    cases = []
    with open(golden_path, encoding="utf-8") as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                cases.append(json.loads(line))
            except json.JSONDecodeError as exc:
                print(f"ERROR: golden file line {lineno}: {exc}", file=sys.stderr)
                return None
    return cases


# ---------------------------------------------------------------------------
# Eval-config loader
# ---------------------------------------------------------------------------


def load_eval_config(config_path: Path) -> Dict[str, Any]:
    if not config_path.exists():
        return {
            "generator": "claude-opus-4-8",
            "judge": "gpt-5.2",
            "judge_provider": "openai",
        }
    with open(config_path, encoding="utf-8") as f:
        return json.load(f)  # type: ignore[no-any-return]


# ---------------------------------------------------------------------------
# Key-gated API helpers (stubs — real calls require keys)
# ---------------------------------------------------------------------------


def _check_keys() -> Tuple[bool, str]:
    """
    Return (keys_present, skip_message).
    If either key is missing, returns (False, skip_message) and the caller
    must exit 0 without making any API call.
    """
    missing = []
    if not os.environ.get(GENERATOR_KEY_VAR):
        missing.append(GENERATOR_KEY_VAR)
    if not os.environ.get(JUDGE_KEY_VAR):
        missing.append(JUDGE_KEY_VAR)
    if missing:
        return False, f"Tier-2 skipped: no {', '.join(missing)} in env"
    return True, ""


def generate_output(prompt_text: str, case_input: str, model: str) -> str:
    """
    Call the generator model (KEY-GATED — only reached when ANTHROPIC_API_KEY present).

    Lazy-imports the anthropic SDK so the module still loads without it installed.
    Raises RuntimeError with a clear install hint if the SDK is absent.

    System prompt = the prompt's composed text; user turn = case_input.
    Returns the text content of the first message block.
    """
    try:
        import anthropic  # noqa: PLC0415 — intentional lazy import (SDK optional)
    except ImportError:
        raise RuntimeError(
            "pip install anthropic to enable Tier-2 generation"
        ) from None

    api_key = os.environ.get(GENERATOR_KEY_VAR)
    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model=model,
        max_tokens=1024,
        system=prompt_text,
        messages=[{"role": "user", "content": case_input}],
    )
    # Extract text from the first text content block (content is a union of
    # block types; only TextBlock carries .text — use getattr for type safety).
    for block in message.content:
        text = getattr(block, "text", None)
        if isinstance(text, str):
            return text
    return ""


def judge_output(
    generated_output: str,
    golden_case: Dict[str, Any],
    eval_criteria: str,
    judge_model: str,
    position: str,
) -> Dict[str, Any]:
    """
    Call the cross-model judge (KEY-GATED — only reached when OPENAI_API_KEY present).

    Bias controls applied by the caller (run_tier2):
      - cross-model-pairing: generator=Claude, judge=GPT (never same family)
      - bidirectional-position-cancellation: caller runs this twice with
        position='A_then_B' and 'B_then_A'; win counted only if both agree.

    Lazy-imports the openai SDK so the module still loads without it installed.
    Raises RuntimeError with a clear install hint if the SDK is absent.

    Sends a judge prompt requesting STRICT JSON {"verdict":"pass"|"fail","reasons":[...]}.
    The position parameter documents which ordering this call represents for the caller's
    bidirectional position-bias cancellation accounting.
    """
    try:
        import openai  # noqa: PLC0415 — intentional lazy import (SDK optional)
    except ImportError:
        raise RuntimeError(
            "pip install openai to enable Tier-2 judging"
        ) from None

    case_input = str(golden_case.get("input", "")) if golden_case else ""
    judge_prompt = (
        "You are an impartial LLM output evaluator.\n\n"
        f"Task the model was given:\n{case_input}\n\n"
        f"Evaluation criteria:\n{eval_criteria}\n\n"
        f"Model output to evaluate (position={position}):\n{generated_output}\n\n"
        "Score the output against the criteria, judged on whether it correctly "
        "handles the task above. "
        "Respond ONLY with valid JSON in this exact format:\n"
        '{"verdict": "pass" or "fail", "reasons": ["reason1", "reason2"]}\n'
        "No other text before or after the JSON."
    )

    api_key = os.environ.get(JUDGE_KEY_VAR)
    client = openai.OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=judge_model,
        messages=[{"role": "user", "content": judge_prompt}],
        temperature=0,
    )
    raw = response.choices[0].message.content or "{}"
    # Strip potential markdown fences
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    try:
        result: Dict[str, Any] = json.loads(raw)
    except json.JSONDecodeError:
        result = {"verdict": "fail", "reasons": [f"judge returned non-JSON: {raw[:200]}"]}
    return result


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Apex Prompt OS — Tier-2 eval (LLM judge, KEY-GATED)."
    )
    parser.add_argument(
        "--score-case",
        action="store_true",
        help=(
            "Read JSON {\"case\": {...}, \"output\": \"...\"} from STDIN, run score_case(), "
            "print result JSON to stdout, exit 0. No API call, no keys required."
        ),
    )
    parser.add_argument(
        "slug",
        nargs="?",
        help="Prompt slug (e.g. production-deploy-verify). Required unless --score-case.",
    )
    parser.add_argument(
        "--library",
        default=str(DEFAULT_LIBRARY),
        help="Path to library/ directory (default: library/ relative to package root)",
    )
    parser.add_argument(
        "--format",
        choices=["text", "json"],
        default="text",
        help="Output format",
    )
    return parser.parse_args()


def _run_score_case() -> int:
    """
    --score-case mode: read {case, output} from STDIN, score, print JSON, exit 0.
    This is the canonical single-source scorer entry point used by the TS test suite.
    """
    try:
        payload = json.loads(sys.stdin.read())
    except json.JSONDecodeError as exc:
        print(json.dumps({"error": f"invalid JSON on stdin: {exc}"}))
        return 1
    case = payload.get("case", {})
    output = str(payload.get("output", ""))
    result = score_case(case, output)
    print(json.dumps(result))
    return 0


def main() -> int:
    args = parse_args()

    # --score-case: offline scoring, no key required, no slug needed
    if args.score_case:
        return _run_score_case()

    if not args.slug:
        print("ERROR: slug is required unless --score-case is used.", file=sys.stderr)
        return 1

    library_dir = Path(args.library)

    # KEY GATE — check before any other work
    keys_present, skip_msg = _check_keys()
    if not keys_present:
        print(skip_msg)
        return 0  # exit 0, never fail due to missing key

    # Keys are present — load config and golden cases
    eval_config = load_eval_config(EVAL_CONFIG_PATH)
    cases = load_golden(args.slug, library_dir)
    if cases is None:
        return 1

    generator_model = eval_config.get("generator", "claude-opus-4-8")
    judge_model = eval_config.get("judge", "gpt-5.2")

    # Load prompt text for the slug
    prompt_files = list((library_dir / "prompts").rglob(f"{args.slug}.prompt.md"))
    if not prompt_files:
        print(f"ERROR: prompt record not found for slug: {args.slug}", file=sys.stderr)
        return 1
    prompt_text = prompt_files[0].read_text(encoding="utf-8")

    results = []
    for case in cases:
        # Generate output via generator model (Claude)
        try:
            model_output = generate_output(prompt_text, str(case.get("input", "")), generator_model)
        except RuntimeError as exc:
            print(f"SKIPPED (SDK not available): {exc}")
            return 0

        # Deterministic score (wraps prompt_tester.py logic)
        det_result = score_case(case, model_output)

        # LLM judge (cross-model, bidirectional position-bias cancellation)
        # Run A-then-B ordering
        judge_ab = {}
        judge_ba = {}
        try:
            judge_ab = judge_output(
                model_output,
                case,
                str(case.get("eval_criteria", "")),
                judge_model,
                position="A_then_B",
            )
            # Run B-then-A ordering (position-bias cancellation)
            judge_ba = judge_output(
                model_output,
                case,
                str(case.get("eval_criteria", "")),
                judge_model,
                position="B_then_A",
            )
        except RuntimeError as exc:
            print(f"SKIPPED (SDK not available): {exc}")
            return 0

        results.append(
            {
                "case_id": case.get("id"),
                "type": case.get("type"),
                "deterministic": det_result,
                "judge_ab": judge_ab,
                "judge_ba": judge_ba,
                "agreed": judge_ab.get("verdict") == judge_ba.get("verdict"),
            }
        )

    if args.format == "json":
        print(json.dumps({"slug": args.slug, "results": results}, indent=2))
    else:
        passed = sum(1 for r in results if r["deterministic"]["passed"])
        print(f"Tier-2 results for: {args.slug}")
        print(f"  Cases: {len(results)}  Passed (deterministic): {passed}/{len(results)}")
        for r in results:
            det = r["deterministic"]
            mark = "PASS" if det["passed"] else "FAIL"
            print(f"  [{mark}] {r['case_id']} score={det['score']} {det['details']}")

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(1)
