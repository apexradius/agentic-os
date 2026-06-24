---
name: handoff
description: "Write or refresh the living session HANDOFF — a continuously-updated record of goal, plan, accomplished, in-progress, and pending work, kept current as context fills so auto-compaction recovers cleanly. Use on /handoff, when the context-budget guard says REFRESH-DUE, or before ending/compacting a session."
user-invocable: true
---

# Handoff — the living session record

The handoff is the document the **context-budget guard** hook enforces and that the harness's
**auto-compact** recovers from. Its job: at any moment, someone (you, after a reset, or
the post-compaction summary) can read it and resume the session without reconstructing
state from scratch. Keep it **current**, not pretty.

This is the **deterministic sibling** of `checkpoint`/`session-summary`: same instinct
(bank the state), but it writes one specific file at one specific path that the hook and
auto-compact both rely on. Refresh = **rewrite the whole file** with the latest state
(accomplished grows; current/pending change).

## Where it goes (do not improvise the path)

`~/.claude/session-env/<session_id>/HANDOFF.md`

The context-budget advisory printed each turn (`[context-budget] … path: …`) and any
REFRESH-DUE deny message **both contain the exact absolute path** — use that path
verbatim. If you have no guard line in context (you invoked `/handoff` cold), resolve it:

```bash
# newest session-env dir = current session
d=$(ls -dt ~/.claude/session-env/*/ 2>/dev/null | head -1); echo "${d}HANDOFF.md"
```

## Steps

1. **Resolve the target path** (above). `Write` creates parent dirs, so no mkdir needed.
2. **Capture real git state** (read-only — these are on the guard's allow-list, so they
   pass even while a refresh is due):
   ```bash
   git rev-parse --abbrev-ref HEAD 2>/dev/null   # branch
   git rev-parse --short HEAD 2>/dev/null         # commit
   git status -s 2>/dev/null                       # dirty files
   ```
   If not in a git repo, write `Git baseline: n/a`.
3. **Read the existing HANDOFF** (if present) so *Accomplished* stays cumulative — append
   what's new, don't drop history.
4. **Write the file** with the template below. Fill every section from what you already
   know in context — the narrative needs no extra reading; only the git lines above.
5. **Append the marker line exactly** (the hook reads it; keep the HTML-comment form):
   `<!-- handoff-meta: pct=<current%> rung=<current rung> ts=<ISO8601> -->`
   Use the `%` from the latest `[context-budget]` advisory; if unknown, write `pct=?`.
6. **Verify**: the file exists and is non-empty. Report one line: `handoff refreshed → <path> (rung <n>%)`.

## Template

```markdown
# Session Handoff — <one-line session title>

> Updated: <ISO8601 local> · Context: <pct>% · Session: <session_id>

## Session goal
<what this session is ultimately trying to achieve>

## Plan
<the agreed approach / numbered steps, or link to the plan file>

## Accomplished (cumulative)
- <done item> — <evidence: commit, file, verified output>
- ...

## Currently working on
<the one thing in flight right now, with enough detail to resume mid-step>

## Pending / Next
- [ ] <next concrete action>
- [ ] ...

## Git baseline
- branch: <branch> · commit: <short sha> · dirty: <count + key files, or "clean">

## VNA (Very Next Action)
<the single most specific next step — so even after a full reset you know exactly what to do>

<!-- handoff-meta: pct=<n> rung=<n> ts=<ISO8601> -->
```

## Constraints (what NOT to do)
- Do **not** write anywhere except the resolved `HANDOFF.md` path — the hook and
  auto-compact key on that exact location.
- Do **not** drop the marker comment — without it the guard cannot read the rung.
- Do **not** turn this into a full report — it's a working record, kept terse and current.
- Do **not** put secrets, tokens, or keys in it (it is a plaintext file).
- Refreshing is cheap and frequent by design; don't skip it because "not much changed."
