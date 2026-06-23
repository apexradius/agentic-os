# session-discipline

The executable enforcement of the framework's PIV planning requirement. Before any file
edit, the agent must externalize a planning block to `~/.claude/sessions/SESSION.md`
containing `ASSUMPTIONS` (3+), `UNKNOWNS` (1+), and `VERIFICATION_PLAN` — enforced as
a hard `PreToolUse` gate (the 422 pattern). A `read-only-gate` enforces a discovery mode
during exploration. Session state is created on `SessionStart` and archived on `Stop`.

This turns [`framework/loop/planning.md`](../../loop/planning.md) from advisory prose
into a runtime constraint.

## Run it

```bash
# Selftest only (proves hooks are correct, uses an isolated tmp HOME):
node framework/standards/session-discipline/validate.mjs

# Full harness (runs this alongside every other primitive and standard):
node framework/primitives/_lib/validate.mjs --all
```

## What it enforces (4 hooks)

| Hook | Event | Matcher | Behavior |
|---|---|---|---|
| `session-start.sh` | `SessionStart` | (none) | Creates `SESSION.md`, writes `.current-session` pointer, injects enforcement notice |
| `planning-gate.sh` | `PreToolUse` | `Edit\|Write` | Exits 2 if SESSION.md lacks ASSUMPTIONS (3+), UNKNOWNS (1+), VERIFICATION_PLAN (1+) |
| `read-only-gate.sh` | `PreToolUse` | `Bash\|Edit\|Write` | When `.discovery-mode` flag exists: blocks writes (except to sessions dir) and non-read-only Bash |
| `session-close.sh` | `Stop` | (none) | Archives populated session to `sessions/archive/`, removes pointer, clears discovery flags |

## Install

Copy the hooks to `~/.claude/hooks/` and merge `examples/settings.json` into your
`~/.claude/settings.json`. The hooks use `python3` (stdlib only) for JSON output and
session-content parsing — no npm install required.

```bash
cp framework/standards/session-discipline/hooks/*.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/session-start.sh ~/.claude/hooks/planning-gate.sh \
         ~/.claude/hooks/read-only-gate.sh ~/.claude/hooks/session-close.sh
```

Merge the hook wiring from `examples/settings.json` into your existing settings file,
keeping your existing `permissions.deny` list and any other hooks.

## What it deliberately does NOT do

Honesty is the point — these hooks enforce structure and leave content to the agent:

- **No content validation of assumptions.** The gate counts `- ` list items; it cannot
  judge whether the assumptions are specific enough. The planning standard (the
  Unknowns Requirement) is what governs quality.
- **No inter-session persistence.** Sessions are plain Markdown files, not a database.
  Cross-session knowledge belongs in the instance's memory layer.
- **No automatic discovery-mode activation.** The agent or user sets the flag explicitly
  by writing `~/.claude/.discovery-mode`; the hook only enforces it once set.

## Verify

```bash
node framework/standards/session-discipline/validate.mjs   # selftest, isolated tmp HOME
node framework/primitives/_lib/validate.mjs --all           # full harness
bash framework/runtime/verify-zone-purity.sh                # zero instance coupling
```

> Last reviewed: 2026-06-22
