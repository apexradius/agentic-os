# Quickstart — adopting Agentic OS

This walks you from a fresh clone to a validated framework wired into your own project, in
five steps. It assumes only a shell, Node 18+, and (for the runtime engines) Python 3.

> New to the zone model? The one rule that governs everything: **this tree is generic and
> portable; your hosts, secrets, and client names live in a separate private *instance zone*
> the framework reads at runtime — never by editing the framework.** See [`README.md`](README.md).

## 1. Get it

This whole directory is extraction-ready. Lift it into your project as a vendored tree (a
subdirectory, a submodule, or a synced copy — your choice):

```bash
git clone <the agentic-os repository URL>
# or vendor the framework/ tree of a superproject directly into your repo
```

## 2. Prove it runs — zero install

The validators and the zone-purity gate are **zero-dependency by contract** (the
[standard-shape](standards/standard-shape/) gate enforces it). Before wiring anything, prove a
clean checkout is green:

```bash
node primitives/_lib/validate.mjs --all   # every primitive + every standards-as-code gate
bash runtime/verify-zone-purity.sh        # proves the tree carries zero instance coupling
```

A clean checkout reports `ALL VALID (…)` and zero residuals. If either fails on an untouched
clone, stop — something is wrong with the copy, not your wiring.

## 3. Read the map (10 minutes)

| You want to… | Read |
|---|---|
| Know the law every agent obeys | [`doctrine/`](doctrine/) — rules (binary) + standards (the bar) |
| Build a block (agent, skill, hook, command, MCP tool, plugin) | [`primitives/`](primitives/) — each has a spec + schema + creator + validator |
| Understand the work loop | [`loop/`](loop/) — Plan → Implement → Verify, with artifact gates |
| See how work is gated deterministically | [`standards/`](standards/) — executable enforcement |
| Run the control plane | [`runtime/`](runtime/) — ledger + council engines, scheduler, observability |
| Coordinate multiple agents | [`coordination/`](coordination/) — ownership, shared plans, hand-offs |

## 4. Wire one thing

Don't adopt everything at once. Pick the smallest useful slice:

- **Point an agent at the doctrine.** Load [`doctrine/`](doctrine/) into your agent's system
  context. That alone gives it the rules and quality bar.
- **Author one primitive.** Read the primitive's `spec.md` and `creator.md`, write your
  instance into your *instance zone*, and run that primitive's validator. Example: a new agent
  → [`primitives/agents/`](primitives/agents/) (the same validator also checks
  [`roles/`](roles/)).
- **Turn on one gate.** Copy the relevant config from [`standards/`](standards/) into your
  repo and run its validator in your pipeline.

## 5. Keep it honest in CI

The framework validates itself on every push via
[`.github/workflows/framework-validate.yml`](.github/workflows/framework-validate.yml) — the
same two commands from step 2. Adopt that workflow (or fold the two commands into your existing
pipeline) so your synced copy can never silently drift out of conformance. Pin the version you
synced (see [`VERSION`](VERSION)) and re-run `validate.mjs --all` whenever you update.

## Extending the framework

- **A new primitive instance** → that primitive's `creator.md`.
- **A new enforcement gate** → [`standards/_creator.md`](standards/_creator.md) (the SOP for
  authoring a standards-as-code gate that conforms to the shape contract).

> Last reviewed: 2026-06-25
