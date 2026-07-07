#!/usr/bin/env python3
"""
cost-budget-guard.py — Cumulative Cost/Token Budget Guard

The results-side sibling of context-budget-guard.py. Where the context guard reads the
transcript's LAST assistant `message.usage` (a snapshot of window occupancy) and keeps the
handoff fresh, this guard reads the SUM of every assistant message's usage (a monotonic,
never-resetting cumulative meter) and gates runaway spend. Same file, same field, different
fold: context = last usage; cost = sum of usages.

Two roles (branches on hook_event_name):

  PreToolUse       The HARD tier. When cumulative processed tokens cross the declared ceiling,
                   DENY only the EXPANSION tools (sub-agent dispatch: Task/Agent, plus any
                   configured expensive tools) while the finish-and-verify path (reads, edits,
                   Bash, commit, the handoff) stays fully open. A run that is over budget can
                   still LAND its current unit safely; it just cannot START new expensive work.
                   Never hard-stops the session. It does not "release" (you cannot un-spend) —
                   it holds until a new session or a raised/cleared budget.

  UserPromptSubmit The WARN tier. Once used crosses warn% of the ceiling, inject a one-line
                   advisory (tokens used / ceiling / %, and a $-estimate when a price map is
                   configured). Awareness only — never blocks.

Design contract:
  * Reads JSON from stdin.
  * FAILS OPEN — any error => exit 0 with no decision. A broken budget gate must NEVER block
    real work silently. It denies ONLY on a positively-measured used >= a positively-declared
    ceiling; absent either signal it is inert.
  * The cumulative meter is O(new bytes), not O(transcript): it keeps a running per-model
    category sum + a byte-offset watermark in a session sidecar and re-reads only the delta
    window each call (the watermark pattern apex-agent-telemetry.py proves). The final,
    still-growing message is never committed — the watermark rewinds to its start — so a
    multi-line streaming message is counted once at its FINAL value (dedup by message.id,
    last-wins), exactly the key the span emitter dedups on. Corrupt/missing sidecar or a
    shrunk/rotated transcript => one full rescan, then rewrite.
  * ENFORCEMENT is on total processed tokens (input + cache_read + cache_creation + output),
    the honest "tokens the model chewed through". Only the $-estimate needs the category
    split (cache_read is billed at ~10% of input, so a single-bucket $ would be an
    order-of-magnitude lie) — and the transcript preserves that split per message.

Budget resolution ladder (first hit wins; none => unbounded => inert):
  1. session sidecar cost-budget.json  "budget_tokens"  (an orchestrator/7.7 writes this per node)
  2. env COSTGUARD_SESSION_TOKENS
  3. none => no ceiling => fail-open/silent

Env overrides:
  COSTGUARD_SESSION_TOKENS   hard ceiling, total processed tokens (default 0 = unbounded)
  COSTGUARD_WARN_PCT         warn advisory threshold, percent of ceiling (default 70)
  COSTGUARD_DISPATCH_TOOLS   csv of tools denied at the hard tier (default "Task,Agent")
  COSTGUARD_PRICE_MAP        path to instance JSON price map for the $-estimate (optional)

No API key. Subscription-only: $ is an ESTIMATE at published list prices ("what would this have
cost"), never an enforcement trigger — tokens are enforced, $ is only reported.
"""

import json
import os
import sys


# ---- config -----------------------------------------------------------------


def _int_env(name, default):
    try:
        return int(float(os.environ.get(name, "")))
    except (ValueError, TypeError):
        return default


HARD_ENV = _int_env("COSTGUARD_SESSION_TOKENS", 0)
WARN_PCT = _int_env("COSTGUARD_WARN_PCT", 70)
PRICE_MAP_PATH = os.environ.get("COSTGUARD_PRICE_MAP", "")


def _dispatch_tools():
    raw = os.environ.get("COSTGUARD_DISPATCH_TOOLS", "Task,Agent")
    tools = {t.strip() for t in raw.split(",") if t.strip()}
    return tools or {"Task", "Agent"}


DISPATCH_TOOLS = _dispatch_tools()

CATS = ("input", "cache_read", "cache_creation", "output")
_USAGE_KEYS = {
    "input": "input_tokens",
    "cache_read": "cache_read_input_tokens",
    "cache_creation": "cache_creation_input_tokens",
    "output": "output_tokens",
}


# ---- helpers ----------------------------------------------------------------


def _home():
    return os.path.expanduser("~")


def _session_dir(session_id):
    return os.path.join(_home(), ".claude", "session-env", str(session_id))


def _sidecar_path(session_id):
    return os.path.join(_session_dir(session_id), "cost-budget.json")


def emit(obj):
    sys.stdout.write(json.dumps(obj))


def load_sidecar(session_id):
    """{offset:int, committed:{model:{cat:int}}, budget_tokens:int|None}. Best-effort."""
    try:
        with open(_sidecar_path(session_id)) as fh:
            obj = json.load(fh)
        if not isinstance(obj, dict):
            raise ValueError
        committed = obj.get("committed")
        committed = committed if isinstance(committed, dict) else {}
        offset = obj.get("offset")
        offset = offset if isinstance(offset, int) and offset >= 0 else 0
        bt = obj.get("budget_tokens")
        budget = int(bt) if isinstance(bt, int) and bt > 0 else None
        return {"offset": offset, "committed": committed, "budget_tokens": budget}
    except (OSError, ValueError, TypeError):
        return {"offset": 0, "committed": {}, "budget_tokens": None}


def save_sidecar(session_id, offset, committed, budget_tokens):
    try:
        os.makedirs(_session_dir(session_id), exist_ok=True)
        tmp = _sidecar_path(session_id) + ".tmp"
        payload = {"offset": offset, "committed": committed}
        if budget_tokens:
            payload["budget_tokens"] = budget_tokens
        with open(tmp, "w") as fh:
            json.dump(payload, fh)
        os.replace(tmp, _sidecar_path(session_id))
    except OSError:
        pass  # fail open — the sidecar is a cache; a full rescan reconstructs it


def _blank_cats():
    return {c: 0 for c in CATS}


def _add_into(dst_by_model, model, cats):
    row = dst_by_model.get(model)
    if row is None:
        row = _blank_cats()
        dst_by_model[model] = row
    for c in CATS:
        row[c] = int(row.get(c, 0)) + int(cats.get(c, 0))


def _total_tokens(by_model):
    return sum(int(v.get(c, 0)) for v in by_model.values() for c in CATS)


def measure_used(transcript_path, session_id):
    """Cumulative processed-token meter, O(new bytes) via a byte-offset watermark.

    Returns (used_total, used_by_model, persisted?) or (None, None, False) when the budget
    cannot be determined (caller then fails open). used_by_model is the per-model category
    split of the WHOLE session (committed + the still-growing tail), for the $-estimate.
    """
    if not transcript_path or not os.path.isfile(transcript_path):
        return None, None, False

    state = load_sidecar(session_id)
    offset, committed = state["offset"], state["committed"]

    try:
        size = os.path.getsize(transcript_path)
    except OSError:
        return None, None, False
    # Transcript shrank or rotated (or a stale offset past EOF) => the committed sum no longer
    # matches this file: rescan from 0.
    if offset > size:
        offset, committed = 0, {}

    try:
        with open(transcript_path, "rb") as fh:
            fh.seek(offset)
            data = fh.read()
    except OSError:
        return None, None, False

    # Fold the delta window, dedup by message.id (last-wins), tracking each id's model, its
    # category split, and the byte offset of its FIRST line in this window (the rewind target).
    window = {}       # msg_id -> {"model":..., "cats":{...}}
    first_off = {}    # msg_id -> int (byte offset of the id's first line in this window)
    order = []        # msg_ids in first-seen order (to find the tail = last-started)
    pos = offset
    for raw in data.split(b"\n"):
        line_off = pos
        pos += len(raw) + 1
        s = raw.strip()
        if not s:
            continue
        try:
            e = json.loads(s)
        except (ValueError, TypeError):
            continue  # a mid-stream seek can land on a partial line; skip it
        if not isinstance(e, dict):
            continue
        msg = e.get("message")
        if not isinstance(msg, dict) or msg.get("role") != "assistant":
            continue
        usage = msg.get("usage")
        if not isinstance(usage, dict):
            continue
        cats = {}
        for cat, key in _USAGE_KEYS.items():
            v = usage.get(key)
            cats[cat] = v if isinstance(v, int) else 0
        if not any(cats.values()):
            continue
        msg_id = msg.get("id") or e.get("uuid")
        if not msg_id:
            continue
        if msg_id not in first_off:
            first_off[msg_id] = line_off
            order.append(msg_id)
        # last-wins: a later line of the same message carries the FINAL (grown) usage
        window[msg_id] = {"model": msg.get("model"), "cats": cats}

    # used = committed + every id in the window (including the still-growing tail).
    used_by_model = {m: dict(v) for m, v in committed.items()}
    for msg_id in order:
        w = window[msg_id]
        _add_into(used_by_model, w["model"], w["cats"])

    # Advance the watermark to the START of the tail (the last-started id): fold every id EXCEPT
    # the tail into committed (they are complete now), and rewind to re-read the tail next call.
    if order:
        tail_id = order[-1]
        new_committed = {m: dict(v) for m, v in committed.items()}
        for msg_id in order[:-1]:
            w = window[msg_id]
            _add_into(new_committed, w["model"], w["cats"])
        new_offset = first_off[tail_id]
        save_sidecar(session_id, new_offset, new_committed, state["budget_tokens"])

    return _total_tokens(used_by_model), used_by_model, True


def resolve_budget(session_id):
    """Ladder: sidecar budget_tokens > env COSTGUARD_SESSION_TOKENS > none (unbounded)."""
    sc = load_sidecar(session_id)
    if sc["budget_tokens"]:
        return sc["budget_tokens"]
    if HARD_ENV > 0:
        return HARD_ENV
    return 0


def _load_price_map():
    if not PRICE_MAP_PATH:
        return None
    try:
        with open(os.path.expanduser(PRICE_MAP_PATH)) as fh:
            pm = json.load(fh)
        return pm if isinstance(pm, dict) else None
    except (OSError, ValueError, TypeError):
        return None


def cost_usd(by_model, price_map):
    """Per-category, per-model $ estimate. Rates are $ per 1,000,000 tokens.
    price_map: {model:{cat:rate}} with an optional "default" fallback model. Returns None if no
    usable rate is found (never a fabricated number)."""
    if not by_model or not isinstance(price_map, dict):
        return None
    total = 0.0
    matched = False
    for model, cats in by_model.items():
        rates = price_map.get(model) or price_map.get("default")
        if not isinstance(rates, dict):
            continue
        matched = True
        for c in CATS:
            try:
                total += (int(cats.get(c, 0)) / 1_000_000.0) * float(rates.get(c, 0) or 0)
            except (ValueError, TypeError):
                continue
    return round(total, 4) if matched else None


# ---- event handlers ---------------------------------------------------------


def handle_pretooluse(data):
    session_id = data.get("session_id")
    if not session_id:
        return 0
    hard = resolve_budget(session_id)
    if hard <= 0:
        return 0  # no ceiling => unbounded => inert
    used, _by_model, ok = measure_used(data.get("transcript_path"), session_id)
    if not ok or used is None:
        return 0  # cannot measure => fail open
    if used < hard:
        return 0  # under ceiling => allow (Tier 0/1 never deny)

    # Over ceiling: deny ONLY expansion (dispatch) tools; the finish-and-verify path stays open.
    tool_name = data.get("tool_name", "") or ""
    if tool_name not in DISPATCH_TOOLS:
        return 0  # allow reads/edits/Bash/commit/handoff — never strand a mutation in flight

    reason = (
        "Cost budget exceeded: {used:,} of {hard:,} processed tokens used. Finish and hand off "
        "the current unit — do NOT dispatch new agents or start new expensive work. Read/edit/"
        "verify/commit tools remain allowed so the run can land safely; this holds until the "
        "session ends or the budget is raised."
    ).format(used=used, hard=hard)
    emit({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    })
    return 0


def handle_userpromptsubmit(data):
    session_id = data.get("session_id")
    if not session_id:
        return 0
    hard = resolve_budget(session_id)
    if hard <= 0:
        return 0
    used, by_model, ok = measure_used(data.get("transcript_path"), session_id)
    if not ok or used is None:
        return 0
    pct = used / float(hard) * 100.0
    if pct < WARN_PCT:
        return 0  # quiet below the warn band

    dollars = cost_usd(by_model, _load_price_map())
    money = " · ~${:,.2f} at list price".format(dollars) if dollars is not None else ""
    line = (
        "[cost-budget] {used:,} / {hard:,} processed tokens ({pct:.0f}% of budget){money} · "
        "over budget denies new sub-agent dispatch; finish-and-verify stays open."
    ).format(used=used, hard=hard, pct=pct, money=money)
    emit({
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": line,
        }
    })
    return 0


HANDLERS = {
    "PreToolUse": handle_pretooluse,
    "UserPromptSubmit": handle_userpromptsubmit,
}


def main():
    try:
        data = json.loads(sys.stdin.read() or "{}")
    except (ValueError, TypeError):
        return 0
    if not isinstance(data, dict):
        return 0
    event = data.get("hook_event_name") or data.get("hookEventName") or ""
    handler = HANDLERS.get(event)
    if handler is None:
        return 0
    try:
        return handler(data)
    except Exception:
        return 0  # fail open on any handler error


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)
