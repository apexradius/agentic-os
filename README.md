# Agentic OS — a portable framework for AI agents

A generic, instance-agnostic operating system for building, coordinating, and running AI
agents. It defines **what each building block is and how to build it**, the **doctrine**
every agent obeys, **how agents coordinate**, the **loop** they run, and **how they are
prompted** — with executable validators and a zone-purity gate that keep the whole thing
honest.

This directory is **self-contained and extraction-ready**: it carries zero coupling to any
particular deployment. To use it, lift the whole directory; layer your own deployment
specifics (hosts, credentials, client names, tuned config) into a separate *instance zone*
that the framework reads through environment variables and config files — never by editing
the framework itself.

**Version:** [`VERSION`](VERSION) (SemVer) · changes in [`CHANGELOG.md`](CHANGELOG.md) · the
contract in [`doctrine/standards/versioning.md`](doctrine/standards/versioning.md). A release is
a public sync; an instance pins the version it synced and re-runs `validate.mjs --all` on update.

## The zone model

The framework draws one hard line:

- **framework/ (this tree)** — generic, portable, no deployment specifics. The mechanism.
- **an instance zone (yours, kept private)** — your hosts, secrets, client names, tuned
  values. The content the mechanism reads at runtime.

A literal that names a host, a client, a credential path, or a deployment route belongs in
the instance zone, not here. That separation is **enforced**, not merely documented (see
`runtime/verify-zone-purity.sh` below).

## Layout

| Directory | What it is |
|---|---|
| [`doctrine/`](doctrine/) | **The law** — the non-negotiable rules and quality standards every agent obeys on every task. |
| [`loop/`](loop/) | **The PIV loop** — Plan → Implement → Verify, with the artifact protocol, context discipline, and verification gates. |
| [`primitives/`](primitives/) | **The building blocks** — agents, skills, hooks, commands, MCP tools, plugins. Each ships a spec, a JSON schema, a creator meta-skill, and a validator. |
| [`prompting/`](prompting/) | **The house style** for agent prompts. |
| [`coordination/`](coordination/) | **How agents coordinate** — file ownership, shared plans, hand-offs. |
| [`roles/`](roles/) | Reusable agent **role** definitions (architect, critic, debugger, …). |
| [`skills/`](skills/) | Generic, reusable **skills** — portable SOPs with zero instance coupling. |
| [`standards/`](standards/) | **Executable enforcement** of doctrine standards (e.g. the design-taste gate). |
| [`runtime/`](runtime/) | **The machinery** — the agent control-plane ledger engine, MCP servers, the routing engine, and the zone-purity gate. |

## Build

The runtime is an npm workspace plus some Python tooling.

```bash
cd runtime
npm install          # installs the workspace (mcp-shared, mcp-servers, router)
npm run build        # builds every workspace that defines a build
```

The Python ledger engine and its tests:

```bash
python3 -m pytest runtime/ledger/tests/ -q
```

## Validate

Every primitive carries a validator; the umbrella runner checks them all:

```bash
node primitives/_lib/validate.mjs --all
```

The **zone-purity gate** proves this tree carries no instance coupling — it greps the whole
tree (markdown included) for deployment literals and fails on anything not declared as an
intentional residual:

```bash
bash runtime/verify-zone-purity.sh
```

A clean checkout reports zero residuals. Any instance-specific literal that lands here is, by
construction, absent from the snapshot and fails the gate.

## License

[MIT](LICENSE).
