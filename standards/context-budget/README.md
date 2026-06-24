# context-budget

The executable enforcement of the framework's living-handoff requirement. As a
session's context fills, a hook walks a configurable percentage ladder and momentarily
denies mutating tools at each unsatisfied rung — releasing the instant the agent
refreshes the handoff file. The host runtime's built-in auto-compaction does the
actual compaction; this standard only keeps the handoff fresh so that recovery lands
on a well-maintained record instead of reconstructing state from scratch.

This turns [`framework/doctrine/standards/context-budget.md`](../../doctrine/standards/context-budget.md)
from advisory prose into a runtime constraint.

## Run it

```bash
# Selftest only (proves hook compiles, exercises all four branches):
node framework/standards/context-budget/validate.mjs

# Full harness (runs this alongside every other primitive and standard):
node framework/primitives/_lib/validate.mjs --all
```

## What it enforces (1 hook, 4 event branches)

| Branch | Event | Behavior |
|---|---|---|
| Ladder gate | `PreToolUse` | Denies mutating tools when the current rung's handoff is not yet written/refreshed; read-only tools, the handoff write, and the Skill tool are always allowed |
| Rung credit | `PostToolUse` | When a write lands on the HANDOFF file, records the satisfied rung in a per-session sidecar so the gate knows the handoff is current |
| Budget advisory | `UserPromptSubmit` | Injects a one-line advisory once context exceeds `CTXGUARD_CREATE − 5%`; awareness only, never blocks |
| Compaction seed | `PreCompact` | Feeds the HANDOFF contents into the runtime's auto-compaction `additionalContext` so the compaction summary is seeded with structured session state |

## The ladder

The default ladder (all values are percentages of the configured context window):

| Rung | Trigger |
|---|---|
| 45% | Create handoff (first-write gate) |
| 55% | First refresh |
| 65% | Second refresh |
| 75% | Third refresh |
| 85% | Fourth refresh |
| 95% | Final refresh before window fills |

All rungs are configurable via environment variables (see below). The gate never
hard-stops and never forces a `/compact` call — it denies the current tool call and
releases on the next one once the handoff is refreshed.

## Env knobs

| Variable | Default | Description |
|---|---|---|
| `CTXGUARD_WINDOW` | `1000000` | Total context window in tokens |
| `CTXGUARD_CREATE` | `45` | Percentage at which the first handoff must be created |
| `CTXGUARD_LADDER` | `55,65,75,85,95` | Comma-separated refresh rungs (percentages) |
| `CTXGUARD_DROP` | `10` | Percentage drop that signals a compaction reset (resets the ladder) |

## Install

Copy the hook to `~/.claude/hooks/` and merge `examples/settings.json` into your
`~/.claude/settings.json`:

```bash
cp framework/standards/context-budget/hooks/context-budget-guard.py ~/.claude/hooks/
chmod +x ~/.claude/hooks/context-budget-guard.py
```

The hook requires `python3` (stdlib only — no pip install). Merge the wiring from
`examples/settings.json` into your existing settings file, keeping your existing
hooks and permissions.

### settings.json wiring

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/context-budget-guard.py"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/context-budget-guard.py"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/context-budget-guard.py"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/context-budget-guard.py"
          }
        ]
      }
    ]
  }
}
```

## Relationship to checkpoint / post-compact

These three mechanisms are **complementary, not competing**:

| Mechanism | Shape | When |
|---|---|---|
| `checkpoint` skill | Manual snapshot — git state, decisions, VNA, remaining work | At milestones, branch switches, or on demand |
| **This standard** | Automatic ladder-paced living handoff, refreshed at each rung | Continuously, as context fills |
| `post-compact` skill | Restore — reads the ledger or checkpoint to resume after compaction | After any compaction event |

The living handoff written by this standard is what `post-compact` recovers from when
no explicit checkpoint was saved. The three together form a complete context-safety
loop: checkpoint banks a milestone, the living handoff keeps the record current between
checkpoints, and post-compact restores from whichever is freshest.

## What it deliberately does NOT do

- **No content validation of the handoff.** The gate checks whether the file exists and
  the rung has been credited; it cannot judge whether the content is complete or honest.
  That is the agent's responsibility.
- **No forced compaction.** The hook never calls `/compact` or any compaction API. The
  host runtime's auto-compaction mechanism does the compaction; this hook only keeps
  the handoff fresh so recovery is clean.
- **No hard-stop.** The gate momentarily denies a single tool call and releases on the
  next call once the handoff is refreshed. There is no lock, no session freeze, and no
  escalation path.

## Honest limitation

The `PreCompact` branch injects handoff contents into the compaction's
`additionalContext`. This path has not been exercised in a live compaction cycle in
this framework's test suite (the harness cannot trigger a real compaction). The branch
fails gracefully — if the handoff file does not exist, the branch exits 0 and the
compaction proceeds normally. The handoff file persists on disk regardless.

## Verify

```bash
node framework/standards/context-budget/validate.mjs   # selftest
node framework/primitives/_lib/validate.mjs --all       # full harness
bash framework/runtime/verify-zone-purity.sh            # zero instance coupling
```

> Last reviewed: 2026-06-23
