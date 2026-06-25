# Threat model: the tool-gate PreToolUse hook

Scope: the deterministic HITL gate ([`hook/`](hook/) + [`rules/`](rules/)) that inspects a tool call
before it executes and resolves allow / ask / deny. This is the framework's most privilege-critical
component, so it documents its own posture as the worked example for
[`doctrine/standards/threat-model.md`](../../doctrine/standards/threat-model.md).

## Trust boundary

The hook ingests the **tool-call event** — the command text, the file content of a `Write`/`Edit`, and
arbitrary tool inputs. None of that is trustworthy: the command may have been synthesized by the agent
from attacker-controlled context (a fetched web page, a PR diff, an issue body), and the file content may
be a payload the agent was *asked* to write. The event itself is untrusted data crossing into a
security-decision point.

## Privilege

The hook does not execute the call; its power is **decisional**. It runs in the agent's PreToolUse path
and returns allow / ask / deny. A wrong **allow** lets the underlying call run with the user's full
privilege — shell, network, file write, secret access. The hook's authority is therefore exactly as large
as the most dangerous call it might wave through.

## Blast radius

The worst case is a **false allow**: a dangerous shape the classifier failed to prove (a disk wipe, a
reverse shell, a credential exfiltration, an RCE pipe) executes unattended with the user's rights. A false
**deny** or **ask** is only friction. A second failure mode is an exception *inside* the hook on a
system-touching tool: if it failed open, a gate bug would become a silent permit — so the blast radius of
a hook crash is itself a missed-dangerous-call.

## Mitigation

Layered, and explicit about residual risk:
- **Allowlist floor** clears only read-only, side-effect-free shapes; a mutating variant of an allowlisted
  head falls through to **ask** (never auto-allow).
- **Dangerous-shape classifier** denies proven-destructive shapes; the **credential scan** blocks secrets
  in inputs; the **injected-instruction rule** (`rules/injection.mjs`) flags prompt-injection markers to
  **ask**, so a poisoned document cannot quietly steer the agent.
- **Fail toward the human**: an error while inspecting a `Bash`/`Write`/`Edit` resolves to **ask**, not
  allow — a gate bug must not become a permit.
- **Least-privilege credentials** and the **security-reviewer** judgment layer carry what a regex cannot:
  novel obfuscation (base64, `$IFS`, variable indirection) is handed to the reviewer, never assumed safe.

Residual risk, named: deterministic detection proves only what it can prove. A clean gate result is the
entry ticket to review, not a proof of safety — see the standard's "a complete threat model is not a safe
one."
