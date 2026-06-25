# tool-gate

The deterministic, no-LLM **Human-in-the-Loop tool gate**. It inspects a tool call *before* it
executes and decides **allow / ask / deny** against the machine-checkable subset of
[`framework/doctrine/standards/tool-gate.md`](../../doctrine/standards/tool-gate.md). The
judgment half — novel obfuscation, intent, "is this safe in *this* context" — is the
[`security-reviewer`](../../roles/security-reviewer.md) role. Gate first (cheap, certain),
reviewer second (judgment).

Why it exists: an agent that can run a shell can also wipe a disk, open a reverse shell, or
exfiltrate a key. Relying on the model's refusal training alone is not enough — an independent
analysis of a popular self-hosted agent measured a **~17% native defense rate**, rising to
**19–92%** once a HITL gate intercepted tool calls (arXiv 2603.10387). This is Apex's
gated-channel instinct made portable and executable.

## Run it

```bash
# Scan tool calls from a JSONL fixture (one tool call per line):
node framework/standards/tool-gate/gate.mjs path/to/calls.jsonl

# Scan a single call from stdin (the shape a PreToolUse hook receives):
echo '{"tool":"Bash","input":{"command":"rm -rf /"}}' | node …/gate.mjs -

# Flags: --json (machine output)
```

Exit code is `0` when no call is **denied**, `1` if any call has a blocking finding.

## As a runtime hook (the real use)

`hook/tool-gate-hook.mjs` is a `PreToolUse` hook. Register it per
[`framework/primitives/hooks/spec.md`](../../primitives/hooks/spec.md) — e.g. in
`.claude/settings.json`:

```json
{ "hooks": { "PreToolUse": [ {
  "matcher": "Bash|Write|Edit",
  "hooks": [ { "type": "command",
    "command": "node ${CLAUDE_PROJECT_DIR}/framework/standards/tool-gate/hook/tool-gate-hook.mjs",
    "timeout": 10 } ] } ] } }
```

It maps the gate's decision to the runtime's permission decision (`deny` blocks, `ask` prompts
the human, `allow` pre-clears) and **fails open** on its own error — a gate bug must never wedge
the agent.

## What it checks (9 rules)

Each rule cites the `tool-gate.md` clause it enforces. Severity is **blocking** (a
proven-dangerous shape → deny) or **note** (a heuristic worth a human glance → ask).

| Category | Rules |
|---|---|
| **Destructive** | `recursive-force-delete` · `disk-overwrite` · `fork-bomb` |
| **Exfiltration** | `pipe-to-shell` (fetch-and-execute) · `reverse-shell` · `credential-network-exfil` |
| **Secrets** | `hardcoded-secret` (private keys, cloud/API tokens — mirrors the shared gitleaks policy) |
| **Injection** | `obfuscated-exec`ⁿ · `injected-instructions`ⁿ |

ⁿ note (asks, never denies on its own). The registry is [`rules/index.mjs`](rules/index.mjs);
the selftest asserts every rule has a RED + GREEN fixture, so the set can't grow uncovered.

## Decision model

`deny` (blocking) — refuse / require explicit approval. `allow` — the command is on the
read-only **allowlist** (`ls`, `cat`, `git status|diff|log`, `grep`/`rg`, the validators…) and
nothing fired. `ask` — everything else: a note fired, or the call is simply not pre-cleared.
**Default-deny on uncertainty, never default-allow.**

## What it deliberately does NOT do

- It is **not a sandbox** and not a substitute for least-privilege credentials. It shrinks the
  blast radius of a bad call; it does not contain a process that already started.
- It does **not** parse a full shell grammar — it matches dangerous *shapes*. Novel obfuscation
  is the `security-reviewer`'s job, not a regex's. The `obfuscated-exec` / `injected-instructions`
  notes point the reviewer at a suspect; they are not verdicts.
- It holds **no Apex hostnames or paths** — zone-pure generic. The instance supplies allowlist
  extensions through config.

## Why dependency-free

Like `design-gate`, this is a single tree of plain `.mjs` with **zero npm dependencies**, so
the one-command harness (`validate.mjs --all`) runs its selftest with bare `node` on a fresh
clone — no install step. Hackable and instantly portable; that is the ethos.

## Verify

```bash
node framework/standards/tool-gate/validate.mjs   # selftest: per-rule RED/GREEN + decision wiring + fixtures
node framework/primitives/_lib/validate.mjs --all  # runs the above inside the full harness
```

The selftest proves, per rule, that a RED call is flagged and a GREEN call is not, that
severity maps to the right decision, then runs the on-disk [`fixtures/`](fixtures/) end-to-end:
`green/*` clean, `red/*` denied, `ask/*` flagged-but-not-denied.

> Last reviewed: 2026-06-25
