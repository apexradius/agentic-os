#!/usr/bin/env python3
"""Validate a command hook's syntax and fail-open JSON I/O contract."""
from __future__ import annotations

import argparse
import ast
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import uuid


def command_for(path: Path) -> list[str]:
    if path.suffix == ".py":
        return [sys.executable, str(path)]
    if path.suffix in {".js", ".mjs", ".cjs"}:
        node = shutil.which("node")
        if not node:
            raise RuntimeError("node is unavailable")
        return [node, str(path)]
    if path.suffix in {".sh", ".bash"}:
        bash = shutil.which("bash")
        if not bash:
            raise RuntimeError("bash is unavailable")
        return [bash, str(path)]
    if os.access(path, os.X_OK):
        return [str(path)]
    raise RuntimeError(f"cannot infer an interpreter for {path.name}")


def syntax_errors(path: Path) -> list[str]:
    try:
        if path.suffix == ".py":
            ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            return []
        command = command_for(path)
        if path.suffix in {".js", ".mjs", ".cjs"}:
            command = [command[0], "--check", str(path)]
        elif path.suffix in {".sh", ".bash"}:
            command = [command[0], "-n", str(path)]
        else:
            return []
        result = subprocess.run(command, text=True, capture_output=True, timeout=5, check=False)
        return [] if result.returncode == 0 else [(result.stderr or result.stdout).strip()]
    except (OSError, RuntimeError, SyntaxError, subprocess.TimeoutExpired) as exc:
        return [str(exc)]


def parse_stdout(stdout: str) -> str | None:
    if not stdout.strip():
        return None
    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError as exc:
        return f"stdout is not one JSON value: {exc}"
    if not isinstance(payload, dict):
        return "stdout JSON must be an object"
    return None


def run_probe(path: Path, raw_input: str, temp_root: Path, timeout: float) -> list[str]:
    env = os.environ.copy()
    env["HOME"] = str(temp_root / "home")
    env["TMPDIR"] = str(temp_root / "tmp")
    env["APEX_CODEX_ANCHOR_STATE_DIR"] = str(temp_root / "anchor-state")
    env["APEX_CODEX_BYPASS_FILE"] = str(temp_root / "guard-bypass.json")
    env["APEX_CODEX_CANARY_DIR"] = str(temp_root / "canaries")
    env["APEX_CODEX_CONFIDENCE_FLAG_DIR"] = str(temp_root / "confidence-flags")
    env["APEX_CODEX_HANDOFF_DIR"] = str(temp_root / "handoffs" / "codex")
    env["APEX_CODEX_HANDOFF_ROOT"] = str(temp_root / "handoffs")
    env["APEX_CODEX_RESUME_FLAG"] = str(temp_root / "resume-pending")
    env["CODEX_PROJECT_DIR"] = str(temp_root)
    Path(env["HOME"]).mkdir(parents=True, exist_ok=True)
    Path(env["TMPDIR"]).mkdir(parents=True, exist_ok=True)
    try:
        result = subprocess.run(
            command_for(path),
            input=raw_input,
            text=True,
            capture_output=True,
            timeout=timeout,
            cwd=temp_root,
            env=env,
            check=False,
        )
    except (OSError, RuntimeError, subprocess.TimeoutExpired) as exc:
        return [f"probe failed: {exc}"]

    errors: list[str] = []
    if result.returncode != 0:
        errors.append(f"neutral or malformed probe exited {result.returncode}; expected fail-open exit 0")
    output_error = parse_stdout(result.stdout)
    if output_error:
        errors.append(output_error)
    return errors


def validate(path: Path, timeout: float) -> list[str]:
    if not path.is_file():
        return ["script does not exist"]
    errors = syntax_errors(path)
    if errors:
        return errors

    with tempfile.TemporaryDirectory(prefix="hook-runtime-") as raw_temp:
        temp_root = Path(raw_temp)
        session_id = f"hook-validator-{uuid.uuid4().hex}"
        event = json.dumps({
            "session_id": session_id,
            "cwd": str(temp_root),
            "tool_name": "Noop",
            "tool_input": {},
            "tool_response": {},
            "prompt": "",
        })
        errors.extend(run_probe(path, event, temp_root, timeout))
        malformed_errors = run_probe(path, "{not-json", temp_root, timeout)
        if malformed_errors:
            errors.extend(f"malformed-input {error}" for error in malformed_errors)
    return errors


def run_selftest() -> bool:
    fixtures = {
        "good.py": (
            "import json,sys\n"
            "try: json.load(sys.stdin)\nexcept Exception: raise SystemExit(0)\n"
            "print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse'}}))\n"
        ),
        "silent.sh": "#!/bin/bash\ncat >/dev/null\nexit 0\n",
        "bad.py": "print('not json')\n",
    }
    with tempfile.TemporaryDirectory(prefix="hook-runtime-selftest-") as raw_temp:
        root = Path(raw_temp)
        for name, content in fixtures.items():
            (root / name).write_text(content, encoding="utf-8")
        cases = [
            ("good JSON hook", root / "good.py", True),
            ("silent fail-open hook", root / "silent.sh", True),
            ("invalid stdout", root / "bad.py", False),
        ]
        passed = 0
        for name, path, expected in cases:
            good = not validate(path, 2)
            matched = good is expected
            passed += int(matched)
            print(f"  {'ok  ' if matched else 'FAIL'} {name}")
        print(f"\nhook runtime selftest: {passed}/{len(cases)} passed")
        return passed == len(cases)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("scripts", nargs="*", type=Path)
    parser.add_argument("--timeout", type=float, default=5.0)
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args()

    if args.selftest:
        return 0 if run_selftest() else 1
    if not args.scripts:
        parser.error("provide at least one hook script or --selftest")

    failed = 0
    for path in args.scripts:
        errors = validate(path.resolve(), args.timeout)
        if errors:
            failed += 1
            print(f"  FAIL {path}")
            for error in errors:
                print(f"       - {error}")
        else:
            print(f"  ok   {path}")
    print(f"\nhook runtime: {len(args.scripts) - failed}/{len(args.scripts)} valid")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
