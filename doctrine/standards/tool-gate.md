# Standard: Tool-Gate (safer-by-default tool execution)

> An agent that can run a shell can also delete a disk, open a reverse shell, or exfiltrate
> a credential. The danger is not what the agent *says* — it is what the agent *does*. This
> standard is the law for a **Human-in-the-Loop (HITL) tool gate**: the deterministic layer
> that inspects a tool call *before* it executes and decides allow / ask / deny.
>
> Prose law (this file). Executable enforcement: [`framework/standards/tool-gate/`](../../standards/tool-gate/).
> Judgment layer: the [`security-reviewer`](../../roles/security-reviewer.md) role.

## Why this exists

Open code agents that rely on the backend model's refusal training alone are not safe: an
independent security analysis of one popular self-hosted agent (OpenClaw, arXiv 2603.10387)
measured a **~17% native defense rate** against adversarial tool use, rising to **19–92%**
only once a HITL gate intercepted tool calls before execution. Model refusal guards *speech*;
a tool gate guards *action*. Most teams already have this instinct as ad-hoc policy gates —
permission allowlists, "author an idempotent applier, a human approves and runs it" patterns.
This standard makes that instinct **portable and executable**: a zero-dependency checker that
ships with the framework, that any instance points at its own tool stream.

## The contract

A conforming tool gate MUST, for every tool call it sees, do all five:

1. **Allowlist known-safe operations.** Read-only, side-effect-free commands (`ls`, `cat`,
   `pwd`, `git status|diff|log`, `grep`/`rg`, the validators) resolve to **allow** without
   prompting. The allowlist is the floor, not the ceiling — anything not on it is not
   automatically unsafe, it is merely *not pre-cleared*.
2. **Classify risk by pattern.** Match the call against the known dangerous shapes —
   destructive filesystem/disk ops, remote-code-execution pipes, reverse shells, credential
   exfiltration, hardcoded secrets, obfuscated execution, injected instructions. A match is a
   **finding** with a severity.
3. **Require approval before executing anything unsafe.** A call that is neither allowlisted
   nor cleanly classified does not silently run — it resolves to **ask** (a human decides).
   Default-deny on uncertainty, never default-allow.
4. **Scan tool inputs for credentials.** Private-key blocks, cloud access keys, live API
   tokens in a command or in written file content are a **blocking** finding — secrets belong
   in the environment or a secret manager, never in a tool call.
5. **Scan content for injected instructions.** File/content payloads carrying prompt-injection
   markers ("ignore previous instructions", hidden `<!-- AI: … -->` directives) are flagged so
   a poisoned document cannot turn the agent into its author's hands.

## Severity → decision

| Severity | Meaning | Gate decision | Exit |
|---|---|---|---|
| `blocking` | A proven-dangerous shape (disk wipe, reverse shell, key exfil, RCE pipe) | **deny** | non-zero |
| `note` | A heuristic worth a human glance (injection markers, obfuscation) | **ask** | zero |
| (none) + allowlisted | Known read-only op | **allow** | zero |
| (none) + not allowlisted | Unrecognized but no danger found | **ask** | zero |

Deterministic detection is the cheap, certain first layer; it flags only what it can prove and
hands the rest — intent, novel attack shapes, "is this *really* safe in context" — to the
`security-reviewer` judgment layer. Gate first, reviewer second.

## Failure posture

The gate is a **floor, not a guarantee** — its allow/ask/deny only narrows the gap that the
`security-reviewer` and least-privilege credentials are still responsible for. Two consequences
the runtime hook MUST honor:

- **The allowlist is a read-only floor, and only that.** A head is pre-cleared only in its plain
  form; the same head in a mutating form (`find … -delete`/`-exec`, `sed -i`, `awk 'system(…)'`,
  any write redirect) is *not* allowlisted and falls through to **ask**. When in doubt, ask.
- **Fail toward the human on a system-touching tool.** If the gate itself errors while inspecting
  a `Bash`/`Write`/`Edit` call, the hook resolves to **ask**, not allow — a gate bug must not
  become a silent permit. It may fail *open* only when there is nothing to gate (an unparseable
  event) or for tools that cannot touch the system.

## What it deliberately does NOT do

- It is **not** a sandbox and not a substitute for least-privilege credentials. It reduces the
  blast radius of a bad call; it does not contain a process that already started.
- It does **not** parse a full shell grammar. It matches dangerous *shapes* in the command
  text. Novel obfuscation (base64, `$IFS`, variable indirection) is the judgment layer's job,
  not a regex's — never mistake a clean gate result for a proof of safety.
- It holds **no allowlist of Apex hostnames or paths** — the checker is zone-pure generic; the
  instance supplies its own allowlist extensions through config.

> Last reviewed: 2026-06-25
