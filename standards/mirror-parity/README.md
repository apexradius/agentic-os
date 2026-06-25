# mirror-parity

A deterministic check that **co-owned manual pairs keep the same skeleton**. The framework runs
two runtimes off mirrored manuals — Claude reads `CLAUDE.md`, Codex reads `AGENTS.md` — and the
contract is that the two stay *diff-able*: same
sections, same order, different voice. Prose says "keep them in sync"; this gate proves it. It
enforces the single-source rule in [`doctrine/README.md`](../../doctrine/README.md) ("one thing
is true; everything else is a mirror") at the one place the framework keeps a hand-maintained
mirror instead of a generated one.

## Run it

```bash
# Check one pair directly:
node framework/standards/mirror-parity/gate.mjs CLAUDE.md AGENTS.md

# Check a declared set of pairs (paths relative to the config file):
node framework/standards/mirror-parity/gate.mjs --config .mirror-parity.json

# --json for machine output.
```

Exit code is `0` when every pair mirrors (or is N/A), `1` on any divergence. It runs
automatically inside `validate.mjs --all`.

## What it checks

The **heading outline** — heading level + text, at or below a minimum level (default `2`, so
the H1 title is excluded because a manual legitimately names its own runtime). Two files mirror
when their outlines are identical, position for position. It catches every way a mirror drifts:

| Divergence | Reported as |
|---|---|
| Section added to one side | `only-in-a` / `only-in-b` |
| Heading renamed in one side | `mismatch` |
| Sections reordered | `mismatch` (per displaced position) |
| Same text, changed depth | `mismatch` |
| One file of a pair deleted | `missing-a` / `missing-b` (a half-mirror) |

## Pairs: zero-config default + optional declaration

The default pair is `CLAUDE.md ⇄ AGENTS.md` at the project root — a **framework** convention, not
an instance fact, so the standard stays zone-pure and ships on extraction. An instance that keeps
other mirrors declares them in a `.mirror-parity.json` at the project root:

```json
{ "minLevel": 2, "pairs": [{ "a": "CLAUDE.md", "b": "AGENTS.md" }] }
```

If neither file of a pair exists (a fresh framework-only clone), that pair is **N/A**, not a
failure — so the selftest proves the mechanism without depending on any instance file.

## What it deliberately does NOT do

Honesty is the point — it checks structure, which is provable, and leaves meaning to humans:

- **No body-content comparison.** The whole reason two manuals exist is that the bodies differ
  (Claude's voice vs Codex's). Only the skeleton is asserted; whether the mirrored prose actually
  *says* the same thing is a reviewer's call.
- **No fuzzy heading matching.** A renamed heading is a real divergence — rename it in both to
  stay diff-able. The gate won't guess that "Your role" and "My role" are "close enough."
- **Fenced code is skipped**, so a `#` comment inside a ``` block is never mistaken for a section.

The mechanism is `gate.mjs`; the selftest (`validate.mjs`) asserts a GREEN mirror plus a RED
fixture for each divergence kind, so the check can't rot into a no-op.

> Last reviewed: 2026-06-22
