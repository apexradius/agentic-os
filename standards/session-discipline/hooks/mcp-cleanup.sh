#!/bin/bash
# mcp-cleanup.sh — reap orphan MCP server processes left by dead agent sessions.
#
# Event: Stop (fires on session end). Also safe to run on a periodic timer as a
# safety net. A session that dies without a clean exit can strand its MCP servers
# as init-reparented orphans (ppid=1), or leave duplicate children behind after an
# editor/IDE reload. This hook reaps them.
#
# INSTANCE-AGNOSTIC BY DESIGN: it does nothing until you tell it which processes
# are yours, so it can never kill an unrelated process. With no configuration it is
# a clean no-op. Configure via environment (all optional):
#
#   MCP_CLEANUP_PATTERN     pgrep -f regex for your MCP server processes.
#                           Used by Phase 1 (ppid=1 orphans). e.g. "myorg-.*-mcp"
#   MCP_CLEANUP_NAMES       space-separated exact binary names to de-duplicate.
#                           Used by Phase 2. e.g. "foo-mcp bar-mcp"
#   MCP_CLEANUP_BIN_DIR     directory holding those binaries (default /usr/local/bin).
#   MCP_CLEANUP_NPM_SCOPE   npm scope whose `npm exec @scope/...` wrappers are leaks.
#                           Used by Phase 3. e.g. "myorg"
#   MCP_CLEANUP_REAP_OLD_NODE  if set to "1", Phase 4 also reaps orphan `node`
#                           processes (ppid=1) older than ~1h. OFF by default —
#                           it is aggressive and can hit unrelated node apps.
#
# Always exits 0 (never blocks session teardown). Logs a count via `logger`.

PATTERN="${MCP_CLEANUP_PATTERN:-}"
NAMES="${MCP_CLEANUP_NAMES:-}"
BIN_DIR="${MCP_CLEANUP_BIN_DIR:-/usr/local/bin}"
NPM_SCOPE="${MCP_CLEANUP_NPM_SCOPE:-}"

KILLED=0

# --- Phase 3 (run first): stray `npm exec @scope/*` wrappers -----------------
# These wrappers hold MCP children as live descendants (ppid != 1), hiding the
# real servers from the orphan sweep below. Kill the wrappers first.
if [ -n "$NPM_SCOPE" ]; then
  for pid in $(pgrep -f "npm exec @${NPM_SCOPE}/" 2>/dev/null); do
    kill "$pid" 2>/dev/null && KILLED=$((KILLED + 1))
  done
fi

# --- Phase 2: de-duplicate configured binaries (keep newest per binary) ------
# IDE/editor reloads can spawn a new MCP child without killing the old one. The
# old duplicate still has a live parent, so the orphan sweep misses it. Keep the
# newest per binary, kill the rest. Skip duplicates < 60s old (respawn race).
for bin in $NAMES; do
  pids=$(pgrep -f "${BIN_DIR}/${bin}\$" 2>/dev/null)
  [ -z "$pids" ] && continue
  count=$(echo "$pids" | wc -w | tr -d ' ')
  [ "$count" -le 1 ] && continue
  newest=$(ps -o pid=,lstart= -p $pids 2>/dev/null | awk '{pid=$1; $1=""; print $0 "|" pid}' | sort | tail -1 | awk -F'|' '{print $2}')
  for pid in $pids; do
    [ "$pid" = "$newest" ] && continue
    etime=$(ps -o etime= -p "$pid" 2>/dev/null | tr -d ' ')
    echo "$etime" | grep -qE '^[0-9]{1,2}$' && continue   # < 60s — skip respawn race
    kill "$pid" 2>/dev/null && KILLED=$((KILLED + 1))
  done
done

# --- Phase 1: orphan MCP servers (ppid=1) matching the pattern ---------------
# TERM first; KILL stubborn survivors after a short grace period.
if [ -n "$PATTERN" ]; then
  for pid in $(pgrep -f "$PATTERN" 2>/dev/null); do
    ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
    [ "$ppid" = "1" ] && { kill "$pid" 2>/dev/null && KILLED=$((KILLED + 1)); }
  done
  if [ "$KILLED" -gt 0 ]; then
    sleep 2
    for pid in $(pgrep -f "$PATTERN" 2>/dev/null); do
      ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
      [ "$ppid" = "1" ] && kill -9 "$pid" 2>/dev/null
    done
  fi
fi

# --- Phase 4 (opt-in): old orphan `node` processes (ppid=1, > ~1h) ------------
if [ "${MCP_CLEANUP_REAP_OLD_NODE:-}" = "1" ]; then
  for pid in $(pgrep -x node 2>/dev/null); do
    ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
    [ "$ppid" = "1" ] || continue
    etime=$(ps -o etime= -p "$pid" 2>/dev/null | tr -d ' ')
    # days-old (contains '-') or HH:MM:SS (>= 1h) → stale
    if echo "$etime" | grep -q '-' || echo "$etime" | grep -qE '^[0-9]+:[0-9]+:[0-9]+$'; then
      kill "$pid" 2>/dev/null && KILLED=$((KILLED + 1))
    fi
  done
fi

[ "$KILLED" -gt 0 ] && logger -t mcp-cleanup "reaped $KILLED orphan/duplicate MCP process(es)" 2>/dev/null

exit 0
