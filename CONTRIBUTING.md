# Contributing to Agentic OS

Thanks for your interest in improving the framework. This guide covers what belongs here, the
two checks every change must pass, and how to add a new building block.

Read [`README.md`](README.md) first — it explains what each directory is. This document is the
*how to change it* companion.

## The one rule that governs everything: the zone line

The framework is **generic and extraction-ready**. It carries **zero coupling** to any
particular deployment — no hostnames, IP addresses, usernames, client or product names,
credential paths, or deployment routes.

Anything deployment-specific belongs in a separate **instance zone** that the framework reads
through environment variables and config files — never by editing the framework itself. The
"neutralize the default, keep the override" pattern is the norm: ship a neutral/empty default,
let an adopter restore real values via env.

This is **enforced, not just asked**. A literal that names a host, a client, or a secret path
will fail the gate (below) and cannot be merged.

✅ `host = os.environ.get("AGENT_SSH_TARGET")  # empty default`
❌ `host = "root@10.0.0.5"`

## Two checks every change must pass

Run both before opening a PR. CI runs the same two.

```bash
# 1. Zone-purity gate — proves no deployment coupling leaked in (markdown included).
bash runtime/verify-zone-purity.sh        # must print: zero undocumented coupling

# 2. Primitive validators — proves every building block still conforms to its schema.
node primitives/_lib/validate.mjs --all
```

If you touched the Python ledger engine under `runtime/ledger/`, also run its tests:

```bash
python3 -m pytest runtime/ledger/tests/ -q
```

If you touched a runtime workspace (`runtime/mcp-servers`, `runtime/router`, …):

```bash
cd runtime && npm install && npm run build
```

## Adding or changing a primitive

A *primitive* is a building block — an agent, skill, hook, command, MCP tool, or plugin. Each
lives under [`primitives/`](primitives/) and ships a **four-part contract**:

| Part | What | Where |
|---|---|---|
| **spec** | The prose definition — what it is, its anatomy, its anti-patterns. | `primitives/<kind>/spec.md` |
| **schema** | A JSON Schema the artifact must validate against. | `primitives/<kind>/*.schema.json` |
| **creator** | A meta-skill that authors a new instance correctly. | `primitives/<kind>/creator.md` |
| **validator** | The executable check that enforces the schema. | run via `validate.mjs` |

To add a new instance of a primitive: read that primitive's `spec.md`, follow its `creator.md`,
then run `node primitives/_lib/validate.mjs --all` until it passes. Prose alone is not a
primitive — a new *kind* of building block needs all four parts before it is accepted.

Agent prompts follow the house style in [`prompting/`](prompting/).

## The working loop (PIV)

Substantive changes follow **Plan → Implement → Verify** ([`loop/`](loop/)). Scale the
ceremony to the blast radius:

- **Trivial** (< 3 files) — implement, then verify.
- **Standard** (3–10 files) — write down the wiring and a checklist first.
- **Complex** (10+) / high-risk — add a research pass and a risk note first.

"Done" means **an executable check passed and you watched it pass** — not "it should work".

## Doctrine, in one breath

The full contract is in [`doctrine/`](doctrine/). The short form:

1. **Every file teaches or works.** Justify added complexity.
2. **Doctrine is law, knowledge is state, code is machinery** — never mixed in one file.
3. **Spec + schema + creator + validator** for any new primitive.
4. **Single source per artifact.** No symlinks; no duplicated truth.
5. **Commit source, gitignore artifacts.** Never commit a secret — use env or a secrets manager.

## Pull requests

- **One logical change per PR.** Atomic changes are easy to review and easy to revert.
- **Title:** imperative and scoped, e.g. `gate: enforce zone-purity on markdown` or
  `primitives/skills: add validator for trigger routing`.
- **Describe** what changed and why, and paste the output of the two checks above.
- **No unrelated edits** riding along — keep the diff to the stated change.

## Reporting issues

Open an issue with: what you expected, what happened, the exact command, and the output. For a
gate failure, include the offending line the gate printed — that is usually the whole story.

## License

By contributing, you agree your contributions are licensed under the [MIT License](LICENSE).
