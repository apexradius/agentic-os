# POLICY-ENGINE.md — the policy engine is referenced, never copied

> The aorg/council ledger engine ([`SEAM.md`](SEAM.md)) was extracted into this repo. Its
> **policy engine** was deliberately **not** — it is referenced in place. This file records what
> that engine is, why it stays live, and the only sanctioned channel by which it could ever be
> imported.

## What stays live (not in this repo)

| Artifact | Live location | Role |
|---|---|---|
| `apex-permission` | `packages/aorg/bin/apex-permission` | Permission allowlist matcher (the policy decision point). |
| `apex-elevate` | `packages/aorg/bin/apex-elevate` | Elevation / break-glass path. |
| `apex-injection-guard` | `packages/aorg/bin/apex-injection-guard` | Prompt/content injection scanner. |
| `apex-touchid-gate` | `packages/aorg/bin/…` | TouchID-recorded approval gate. |
| `policy/*.allow.toml` | `packages/aorg/policy/` | The allowlists themselves. |

## Why it is referenced, not copied

1. **Self-protection (anti-injection).** These paths are guarded: an agent — including
   claude-local — cannot raw-write them. Copying them *into* a tree an agent freely writes would
   defeat the guard. The repo must not become a side-door around its own policy engine.
2. **The ledger engine doesn't need them.** `bin/aorg`'s policy surface is its **in-file**
   `load_policy()` + the path/secret/billing pattern tables already present in the copy. It does
   **not** `exec` `apex-permission`/`apex-elevate` at runtime — so the faithful engine copy runs
   without them. The policy engine is a *separable* concern (confirmed in 4·pre).
3. **Single source of authority.** One policy engine, one location, one set of allowlists. A copy
   would be a second authority that drifts — the worst failure mode for a security control.

## The only sanctioned import channel

If a future stage genuinely needs the policy engine *in* the framework (it does not today), the
path is **not** a raw `Write`/`cp` by an agent. It is:

1. Claude authors an **idempotent applier** script (reviewable, re-runnable, no side effects on
   re-run).
2. **Ayo `!`-runs it** in-session — TouchID-recorded, a sanctioned gated channel, not a block.

This is a Stage-≥6 decision and must be logged in `apex/config/RISKS.md` (risk R4) with its own
rollback. Until then: **reference only.**

## See also
- [`SEAM.md`](SEAM.md) — the engine copy + coupling seam.
- `apex/config/RISKS.md` (authored at 4H) — R4 covers any attempt to import a self-protected file.
