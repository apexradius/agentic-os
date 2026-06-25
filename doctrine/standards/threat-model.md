# Threat-Model Standard (build-time)

Classic application security models a remote attacker hitting your endpoint: validate the input, authn
the caller, and the boundary holds. An agent **inverts** that. The hostile payload arrives *inside the
data the agent is helpfully processing* — a web page it fetched, a PR diff it reviewed, a file it was
asked to edit, the result of a tool it called — and the agent acts on that data with the user's full
privilege. The question to answer *before* a primitive ships is therefore not "is the input validated"
but: **what happens when this untrusted content contains instructions, and this primitive has the
privilege to act on them?** That is the build-time threat model — and it is reasoning, done at authoring
time, not a scan done after the fact.

## When a threat model is required

- **Required** for any primitive that either **ingests untrusted content** (web, fetched files, tool
  output, PR/issue text, the instance's own end users) **or wields privilege** (shell, network, file
  write, secret access, outbound communication).
- **High-risk** primitives — hooks, MCP servers, anything that can run a shell, reach the network, read a
  secret, or send outbound — ship a `THREAT-MODEL.md` sidecar.
- **Low-risk** — pure-read, pure-doc, no privilege, no untrusted input — need only a one-line attestation
  ("no untrusted input, no privilege"). The point is to make the *absence* of risk a deliberate claim,
  not an unexamined assumption.

## The four questions

Every threat-model note answers these, in order — each is a heading the
[checker](../../standards/threat-model/) requires:

1. **Trust boundary** — what untrusted data crosses into this primitive, and from where?
2. **Privilege** — what can it do once running? (the capabilities an attacker would inherit by steering it)
3. **Blast radius** — the worst realistic outcome if that untrusted data turns hostile?
4. **Mitigation** — which control catches it: the [tool-gate](tool-gate.md) (allow/ask/deny, including the
   injected-instruction rule), [data-handling](data-handling.md) redaction, human confirmation, or
   least-privilege credentials. If the honest answer is "none," that gap **is** the finding.

## How it relates to the runtime gates

The [tool-gate](tool-gate.md) is the runtime enforcement (what *executes*); [data-handling](data-handling.md)
is the output control (what gets *written*); the [security-reviewer](../../roles/security-reviewer.md) role
is the judgment layer. The threat model is the **design-time** reasoning that decides what those gates must
catch — you cannot tune a gate against a threat you never named. The deterministic checker
([`framework/standards/threat-model/`](../../standards/threat-model/)) proves a threat model is structurally
**complete** — all four questions answered with substance. It does not, and cannot, judge whether the
reasoning is *right*; that is the reviewer's job. Format here, judgment there.

## What it deliberately does not do

- It is not a substitute for the runtime tool-gate or for least-privilege credentials. Naming a threat does
  not contain it — the threat model decides what to *build*; the runtime decides what to *allow*.
- A complete threat model is not a safe one. Completeness is the entry ticket to review, not a proof of
  safety.

> Last reviewed: 2026-06-25
