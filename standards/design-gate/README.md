# design-gate

The deterministic, no-LLM half of the framework's two-layer taste DNA. It scans CSS, HTML,
and (tolerantly) JSX/TSX surfaces against the **machine-checkable subset** of
[`framework/doctrine/standards/design.md`](../../doctrine/standards/design.md) and exits
non-zero on any blocking anti-pattern. The judgment half — imagery quality, register intent,
required-states completeness, "does this feel generic" — is the
[`design-critic`](../../roles/design-critic.md) role. Gate first (cheap, certain), critic
second (judgment).

## Run it

```bash
# Point it at an instance's UI source — files or directories:
node framework/standards/design-gate/gate.mjs path/to/src

# Register-aware rules (radius, …) need to know which register the surface is:
node …/gate.mjs --register operational  path/to/dashboard
node …/gate.mjs --register marketing    path/to/landing

# Flags: --json (machine output)  --strict (notes also fail the build)
```

Exit code is `0` when there are no blocking findings, `1` otherwise (or on any finding under
`--strict`). Register-specific rules are **skipped with a notice** when `--register` is
absent, so the gate never guesses the register.

## What it checks (24 rules)

Each rule cites the `design.md` line it enforces. Severity is **blocking** (a real violation
of the standard) or **note** (a heuristic worth a human glance — deterministic detection is
fuzzy, so it never fails the build by itself).

| Concern | Rules |
|---|---|
| **Color** | `gradient-text` · `untokenized-color` · `contrast-aa` (WCAG 4.5:1, computed) · `gradient-domination`ⁿ · `one-hue-palette`ⁿ · `beige-brown-monotone`ⁿ · `color-only-status`ⁿ |
| **Type** | `body-text-min-size` (≥16px) · `viewport-font-scaling` |
| **Motion** | `motion-properties` (opacity/transform only) · `reduced-motion-required` |
| **Layout** | `radius-marketing-zero`ᵐ · `radius-operational-max`ᵒ · `nested-card` · `side-stripe-card` · `pill-everything`ⁿ · `off-8px-grid`ⁿ · `glassmorphism-default`ⁿ · `decorative-orbs`ⁿ · `gradient-hero`ⁿ · `untokenized-shadow`ⁿ |
| **A11y** | `focus-removed` · `touch-target-min` (≥24px) · `icon-only-needs-label` |

ⁿ note · ᵐ marketing-register only · ᵒ operational-register only · the rest are blocking and
register-independent. The registry is [`rules/index.mjs`](rules/index.mjs); the selftest
asserts every rule has a RED + GREEN fixture, so the set can't grow uncovered.

## What it deliberately does NOT do

Honesty is the point — the gate flags only what it can prove and hands the rest to the critic:

- **No fg/bg pairing across rules.** `contrast-aa` checks pairs co-located in one rule (or
  resolvable through `var(--token)`); contrast that depends on inherited or DOM-cascaded
  backgrounds is a `design-critic` call.
- **Imagery, register intent, "generic-AI feel", required-states completeness** are judgment,
  not regex — `decorative-orbs` / `gradient-hero` / `glassmorphism` are *notes* that point the
  critic at a suspect, not verdicts.
- **JSX boundary, stated plainly.** `className`, `style={{…}}`, and `styled`/`css` template
  literals are extracted and scanned; arbitrary JS expressions and runtime-computed styles are
  not. CSS and HTML are the first-class targets.
- **SCSS nesting isn't resolved** (flat declarations are still seen).

## Why dependency-free

The gate is a single tree of plain `.mjs` with **zero npm dependencies** — a hand-written CSS
tokenizer, a lightweight markup scanner, and pure-function WCAG contrast + HSL hue analysis in
[`lib/`](lib/). That is a deliberate constraint, not a shortcut: the framework's one-command
harness (`validate.mjs --all`) runs this gate's selftest with bare `node` on a fresh clone —
no install step, nothing in `node_modules`. A real CSS-AST dependency would have made the CI
gate un-runnable without a build. Dependency-free keeps it hackable and instantly portable,
which is the whole ethos.

## Verify

```bash
node framework/standards/design-gate/validate.mjs   # selftest: per-rule RED/GREEN + fixtures
node framework/primitives/_lib/validate.mjs --all    # runs the above inside the full harness
```

The selftest proves, per rule, that a RED snippet is flagged and a GREEN snippet is not, then
runs the on-disk [`fixtures/`](fixtures/) end-to-end: `fixtures/green/*` must pass clean,
`fixtures/red/*` must fail with cited findings.

> Last reviewed: 2026-06-19
