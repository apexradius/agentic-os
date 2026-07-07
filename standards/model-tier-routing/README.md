# model-tier-routing

The executable enforcement that a plan routes work by generic *tier*, never by a hardcoded model
name. When a manifest node declares which model tier and effort level it should run on, those
declarations must use the generic vocabulary — capability tiers, not vendor model names, and
effort levels on a fixed ladder. Model names rot and are instance-specific; keeping them out of
the plan is what this gate guarantees.

The law this enforces lives in [`../../coordination/orchestration.md`](../../coordination/orchestration.md),
the dispatch step. The decision matrix (which tier for which work) is the
[`model-router`](../../skills/model-router/) skill. The concrete tier-to-model resolution is
instance data — this framework standard never names a model.

## Run it

```
node validate.mjs                        # selftest (bare run, used by validate.mjs --all)
node validate.mjs path/to/manifest.json  # check a real manifest's routing against the vocabulary
node validate.mjs example-manifest.json  # the shipped green demonstrator
```

Exit code is non-zero on any off-vocabulary declaration.

## The vocabulary (`routing.json`)

Three generic capability tiers:

`strongest` (deepest reasoning) · `mid` (the execution default) · `fast` (cheapest, bulk/parallel).

A five-level effort ladder:

`low` · `medium` · `high` · `xhigh` · `max`.

`routing.json` also carries the decision guidance (which tier for which work) as data — the
promoted decision matrix. Both are generic and vendor-neutral.

## What this gate does and does not prove (honest bounding)

It proves **membership**: a node's declared `model_tier` is one of the generic tiers and its
declared `effort` is on the ladder. Its real job is anti-rot — it rejects a node that pins a raw
vendor name (`model_tier: "opus"`) or a fully-qualified model ID (`model_tier: "claude-opus-4-8"`),
and an off-ladder effort (`effort: "turbo"`). A plan names a tier; the instance resolves the tier
to a model.

Two boundaries, consistent with sequencing-spine:

- **Undeclared routing is unconstrained.** A node with no `model_tier`/`effort` is not rejected;
  the "declare per node" ideal is skill and coordination-law guidance, not a hard gate.
- **It does not judge whether the tier fits the work.** Whether a hard architecture slice was
  correctly routed to `strongest` — rather than mislabelled `fast` — needs the slice's true
  difficulty, which no static gate can read. That correctness is behavioral, scored by the
  trajectory-eval layer, not here. (`model_tier` is a difficulty axis; it is deliberately *not*
  derived from sequencing-spine's `class`, which is an ordering axis — conflating them would be
  wrong.)

The rule that **the orchestrator runs on the strongest tier** is coordination law, not a check
here: the orchestrator is not a dispatched manifest node, so this gate cannot see it.

## Instance resolution

The concrete `strongest`/`mid`/`fast` → model-ID map, and which effort levels a given model
accepts (some fold `xhigh` down to `high`), are the instance's data, never framework doctrine —
per [`../../loop/artifacts.md`](../../loop/artifacts.md) ("the concrete tier->effort mapping is
the instance's model-selection reference"). A per-agent model pin, where the instance sets one,
outranks the tier default.

## Composition

This standard composes on [`orchestration-manifest`](../orchestration-manifest/) (shape) and sits
beside [`sequencing-spine`](../sequencing-spine/) (ordering). All three read the same manifest and
check disjoint properties; `example-manifest.json` carries `class` + `model_tier` + `effort` and
passes all three gates independently under `validate.mjs --all`.
