#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any


ROOT = Path(os.environ.get("APEX_AI_ORG_ROOT", str(Path(__file__).resolve().parents[1])))
COUNCIL = Path(__file__).resolve().parent / "council"
CURRENT = ROOT / "state" / "council" / "current"
SOURCE_ROOT = Path(__file__).resolve().parents[1]
SOURCE_COUNCIL = COUNCIL
SERVER_NAME = "apex-council-mcp"
SERVER_VERSION = "0.1.0"
PROTOCOL_VERSION = "2024-11-05"


class ToolError(Exception):
    pass


def tool_defs() -> list[dict[str, Any]]:
    return [
        {
            "name": "council_readiness",
            "description": "Check whether local Apex OS Council lanes and billing guards are ready.",
            "inputSchema": {
                "type": "object",
                "additionalProperties": False,
                "properties": {},
            },
        },
        {
            "name": "council_init",
            "description": "Initialize a file-backed Apex OS Council session from a brief path or brief text.",
            "inputSchema": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "brief_path": {"type": "string", "description": "Existing markdown task brief path."},
                    "brief_text": {"type": "string", "description": "Markdown task brief text to stage in /private/tmp."},
                    "session": {"type": "string", "description": "Optional council session id."},
                    "mode": {
                        "type": "string",
                        "enum": ["plan", "phase-review", "stuck-report"],
                        "default": "plan",
                    },
                    "aorg_task": {"type": "string", "description": "Optional linked aorg task id."},
                    "aorg_role": {"type": "string", "default": "codex"},
                    "items": {"type": "array", "items": {"type": "string"}},
                    "no_archive": {"type": "boolean", "default": False},
                    "no_aorg_claim": {"type": "boolean", "default": False},
                },
            },
        },
        {
            "name": "council_launch",
            "description": "Launch live tmux windows for the Apex OS Council subscription/local lanes.",
            "inputSchema": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "session": {"type": "string", "default": "apex-council"},
                    "with_antigravity": {"type": "boolean", "default": False},
                },
            },
        },
        {
            "name": "council_status",
            "description": "Show current Council session status, item locks, approvals, and blockers.",
            "inputSchema": {
                "type": "object",
                "additionalProperties": False,
                "properties": {},
            },
        },
        {
            "name": "council_record",
            "description": "Record a director decision for a Council item.",
            "inputSchema": {
                "type": "object",
                "additionalProperties": False,
                "required": ["item_id", "director", "decision"],
                "properties": {
                    "item_id": {"type": "string"},
                    "director": {
                        "type": "string",
                        "description": "One configured director, e.g. Claude, Codex Director, or Antigravity.",
                    },
                    "decision": {
                        "type": "string",
                        "enum": ["APPROVED", "CHANGES_REQUESTED", "OBJECTING"],
                    },
                    "note": {"type": "string"},
                    "evidence": {"type": "string"},
                },
            },
        },
        {
            "name": "council_submit",
            "description": "Record a director's SEALED (blind) contribution for a Council item (Pillar 9). "
            "Hidden from deliberation.md until council_reveal_item, so directors deliberate without "
            "anchoring on each other. Opt-in; the open paste-into-deliberation flow is unchanged.",
            "inputSchema": {
                "type": "object",
                "additionalProperties": False,
                "required": ["item_id", "director", "text"],
                "properties": {
                    "item_id": {"type": "string"},
                    "director": {
                        "type": "string",
                        "description": "One configured director, e.g. Claude, Codex Director, or Antigravity.",
                    },
                    "text": {"type": "string", "description": "The director's blind contribution body."},
                },
            },
        },
        {
            "name": "council_reveal_item",
            "description": "Reveal all sealed submissions for a Council item into deliberation.md at once "
            "and stamp revealed_at (Pillar 9). Refuses a partial reveal unless force=true.",
            "inputSchema": {
                "type": "object",
                "additionalProperties": False,
                "required": ["item_id"],
                "properties": {
                    "item_id": {"type": "string"},
                    "force": {"type": "boolean", "default": False},
                },
            },
        },
        {
            "name": "council_handoff",
            "description": "Write the Council-approved handoff once all required item approvals are locked.",
            "inputSchema": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "force": {"type": "boolean", "default": False},
                    "no_aorg_complete": {"type": "boolean", "default": False},
                },
            },
        },
        {
            "name": "council_paths",
            "description": "Return the canonical file paths for the active Council session.",
            "inputSchema": {
                "type": "object",
                "additionalProperties": False,
                "properties": {},
            },
        },
    ]


def text_result(text: str, is_error: bool = False) -> dict[str, Any]:
    result: dict[str, Any] = {"content": [{"type": "text", "text": text}]}
    if is_error:
        result["isError"] = True
    return result


def json_text(value: Any) -> dict[str, Any]:
    return text_result(json.dumps(value, indent=2, sort_keys=True))


def require_string(args: dict[str, Any], key: str) -> str:
    value = args.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ToolError(f"{key} is required")
    return value.strip()


def optional_string(args: dict[str, Any], key: str) -> str | None:
    value = args.get(key)
    if value is None:
        return None
    if not isinstance(value, str):
        raise ToolError(f"{key} must be a string")
    return value.strip() or None


def optional_bool(args: dict[str, Any], key: str) -> bool:
    value = args.get(key)
    if value is None:
        return False
    if not isinstance(value, bool):
        raise ToolError(f"{key} must be a boolean")
    return value


def run_council(args: list[str], timeout: int = 60) -> dict[str, Any]:
    if not COUNCIL.exists():
        raise ToolError(f"council CLI not found: {COUNCIL}")
    env = os.environ.copy()
    env["APEX_AI_ORG_ROOT"] = str(ROOT)
    proc = subprocess.run(
        [str(COUNCIL), *args],
        cwd=str(ROOT),
        env=env,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    output = "\n".join(part for part in [proc.stdout.strip(), proc.stderr.strip()] if part)
    return {
        "ok": proc.returncode == 0,
        "returncode": proc.returncode,
        "command": [str(COUNCIL), *args],
        "output": output,
    }


def run_source_council(args: list[str], root: Path, timeout: int = 60) -> dict[str, Any]:
    env = os.environ.copy()
    env["APEX_AI_ORG_ROOT"] = str(root)
    env["APEX_COUNCIL_DIRECTORS"] = "Claude"
    proc = subprocess.run(
        [str(SOURCE_COUNCIL), *args],
        cwd=str(SOURCE_ROOT),
        env=env,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    output = "\n".join(part for part in [proc.stdout.strip(), proc.stderr.strip()] if part)
    return {
        "ok": proc.returncode == 0,
        "returncode": proc.returncode,
        "command": [str(SOURCE_COUNCIL), *args],
        "output": output,
    }


def staged_brief_path(brief_text: str) -> str:
    safe_text = brief_text.strip()
    if not safe_text:
        raise ToolError("brief_text must not be empty")
    path = Path(tempfile.gettempdir()) / f"apex-council-mcp-{int(time.time())}.md"
    path.write_text(safe_text + "\n", encoding="utf-8")
    return str(path)


def call_tool(name: str, args: dict[str, Any] | None) -> dict[str, Any]:
    payload = args or {}
    if not isinstance(payload, dict):
        raise ToolError("tool arguments must be an object")

    if name == "council_readiness":
        result = run_council(["readiness"], timeout=45)
        return text_result(result["output"], is_error=not result["ok"])

    if name == "council_init":
        brief_path = optional_string(payload, "brief_path")
        brief_text = optional_string(payload, "brief_text")
        if bool(brief_path) == bool(brief_text):
            raise ToolError("provide exactly one of brief_path or brief_text")
        path = brief_path or staged_brief_path(brief_text or "")
        mode = optional_string(payload, "mode") or "plan"
        if mode not in {"plan", "phase-review", "stuck-report"}:
            raise ToolError("mode must be plan, phase-review, or stuck-report")
        command = ["init", path, "--mode", mode]
        session = optional_string(payload, "session")
        aorg_task = optional_string(payload, "aorg_task")
        aorg_role = optional_string(payload, "aorg_role") or "codex"
        if session:
            command.extend(["--session", session])
        if aorg_task:
            command.extend(["--aorg-task", aorg_task])
        if aorg_role:
            command.extend(["--aorg-role", aorg_role])
        for item in payload.get("items") or []:
            if not isinstance(item, str) or not item.strip():
                raise ToolError("items must be non-empty strings")
            command.extend(["--item", item.strip()])
        if optional_bool(payload, "no_archive"):
            command.append("--no-archive")
        if optional_bool(payload, "no_aorg_claim"):
            command.append("--no-aorg-claim")
        result = run_council(command)
        return text_result(result["output"], is_error=not result["ok"])

    if name == "council_launch":
        session = optional_string(payload, "session") or "apex-council"
        command = ["launch", "--session", session]
        if optional_bool(payload, "with_antigravity"):
            command.append("--with-antigravity")
        result = run_council(command, timeout=30)
        return text_result(result["output"], is_error=not result["ok"])

    if name == "council_status":
        result = run_council(["status"], timeout=30)
        return text_result(result["output"], is_error=not result["ok"])

    if name == "council_record":
        command = [
            "record",
            require_string(payload, "item_id"),
            require_string(payload, "director"),
            require_string(payload, "decision"),
        ]
        note = optional_string(payload, "note")
        evidence = optional_string(payload, "evidence")
        if note:
            command.extend(["--note", note])
        if evidence:
            command.extend(["--evidence", evidence])
        result = run_council(command, timeout=30)
        return text_result(result["output"], is_error=not result["ok"])

    if name == "council_submit":
        command = [
            "submit",
            require_string(payload, "director"),
            require_string(payload, "item_id"),
            "--text",
            require_string(payload, "text"),
        ]
        result = run_council(command, timeout=30)
        return text_result(result["output"], is_error=not result["ok"])

    if name == "council_reveal_item":
        command = ["reveal-item", require_string(payload, "item_id")]
        if optional_bool(payload, "force"):
            command.append("--force")
        result = run_council(command, timeout=30)
        return text_result(result["output"], is_error=not result["ok"])

    if name == "council_handoff":
        command = ["handoff"]
        if optional_bool(payload, "force"):
            command.append("--force")
        if optional_bool(payload, "no_aorg_complete"):
            command.append("--no-aorg-complete")
        result = run_council(command, timeout=60)
        return text_result(result["output"], is_error=not result["ok"])

    if name == "council_paths":
        return json_text(
            {
                "root": str(ROOT),
                "council_cli": str(COUNCIL),
                "current": str(CURRENT),
                "state": str(CURRENT / "state.json"),
                "deliberation": str(CURRENT / "deliberation.md"),
                "state_of_debate": str(CURRENT / "state-of-debate.md"),
                "handoff": str(CURRENT / "handoff.md"),
                "prompts": str(CURRENT / "prompts"),
                "reports": str(CURRENT / "reports"),
                "reviews": str(CURRENT / "reviews"),
                "stuck_reports": str(CURRENT / "stuck-reports"),
                "checkpoints": str(CURRENT / "checkpoints"),
            }
        )

    raise ToolError(f"unknown tool: {name}")


def handle_request(message: dict[str, Any]) -> dict[str, Any] | None:
    request_id = message.get("id")
    method = message.get("method")

    if method == "notifications/initialized":
        return None

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {"tools": {}},
                "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
            },
        }

    if method == "ping":
        return {"jsonrpc": "2.0", "id": request_id, "result": {}}

    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": request_id, "result": {"tools": tool_defs()}}

    if method == "tools/call":
        params = message.get("params") or {}
        if not isinstance(params, dict):
            result = text_result("params must be an object", is_error=True)
        else:
            try:
                result = call_tool(str(params.get("name") or ""), params.get("arguments") or {})
            except ToolError as exc:
                result = text_result(str(exc), is_error=True)
            except subprocess.TimeoutExpired as exc:
                result = text_result(f"council command timed out after {exc.timeout}s", is_error=True)
            except Exception as exc:
                result = text_result(f"unexpected MCP tool error: {exc}", is_error=True)
        return {"jsonrpc": "2.0", "id": request_id, "result": result}

    if method in {"resources/list", "prompts/list"}:
        key = "resources" if method == "resources/list" else "prompts"
        return {"jsonrpc": "2.0", "id": request_id, "result": {key: []}}

    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "error": {"code": -32601, "message": f"method not found: {method}"},
    }


def serve() -> int:
    for line in sys.stdin:
        raw = line.strip()
        if not raw:
            continue
        try:
            message = json.loads(raw)
            if not isinstance(message, dict):
                raise ValueError("message must be an object")
            response = handle_request(message)
        except Exception as exc:
            response = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32700, "message": f"invalid request: {exc}"},
            }
        if response is not None:
            sys.stdout.write(json.dumps(response, separators=(",", ":")) + "\n")
            sys.stdout.flush()
    return 0


def self_test() -> int:
    names = {tool["name"] for tool in tool_defs()}
    required = {
        "council_readiness",
        "council_init",
        "council_launch",
        "council_status",
        "council_record",
        "council_submit",
        "council_reveal_item",
        "council_handoff",
    }
    missing = required - names
    if missing:
        raise AssertionError(f"missing tools: {sorted(missing)}")
    init_response = handle_request({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}})
    assert init_response and init_response["result"]["serverInfo"]["name"] == SERVER_NAME
    tools_response = handle_request({"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
    assert tools_response and len(tools_response["result"]["tools"]) >= len(required)
    ping_response = handle_request({"jsonrpc": "2.0", "id": 3, "method": "ping", "params": {}})
    assert ping_response == {"jsonrpc": "2.0", "id": 3, "result": {}}
    paths = call_tool("council_paths", {})
    assert "state/council/current" in paths["content"][0]["text"]
    council_self_test = run_council(["--self-test"], timeout=60)
    if not council_self_test["ok"]:
        raise AssertionError(council_self_test["output"])
    with tempfile.TemporaryDirectory(prefix="apex-council-mcp-flags-") as td:
        temp_root = Path(td) / "ai-org"
        brief = Path(td) / "brief.md"
        brief.write_text("# MCP flag coverage\n\n- [ ] Verify aorg bridge flags\n", encoding="utf-8")
        init_with_aorg = run_source_council(
            [
                "init",
                str(brief),
                "--session",
                "mcp-flag-test",
                "--aorg-task",
                "aorg-test-mcp-flags",
                "--aorg-role",
                "codex",
                "--no-aorg-claim",
                "--no-archive",
            ],
            temp_root,
        )
        if not init_with_aorg["ok"]:
            raise AssertionError(init_with_aorg["output"])
        handoff_without_aorg = run_source_council(["handoff", "--force", "--no-aorg-complete"], temp_root)
        if not handoff_without_aorg["ok"]:
            raise AssertionError(handoff_without_aorg["output"])
    readiness = run_council(["readiness"], timeout=45)
    if not readiness["ok"]:
        raise AssertionError(readiness["output"])
    print("apex_council_mcp_self_test=pass")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Apex Council MCP server")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    return serve()


if __name__ == "__main__":
    sys.exit(main())
