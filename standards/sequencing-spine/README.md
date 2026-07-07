# sequencing-spine

The executable enforcement of the ordering heuristics a planner's manifest must satisfy. A
manifest is already proven to be an acyclic DAG with owners and validation commands by the
[`orchestration-manifest`](../orchestration-manifest/) gate. This gate adds the layer above
that: when a node declares a `class`, the ordering of the declared classes must obey a data
rule table of delivery prerequisites — sync before you edit, a lockfile and test signal before
you upgrade a dependency, de-bloat before you publish.

The law this enforces lives in [`../../coordination/orchestration.md`](../../coordination/orchestration.md),
step 5 ("Sequence the spine").

## Run it

```
node validate.mjs                       # selftest (bare run, used by validate.mjs --all)
node validate.mjs path/to/manifest.json # check a real manifest against the rule table
node validate.mjs example-manifest.json # the shipped green demonstrator
```

Exit code is non-zero on any ordering violation. Run it beside the manifest gate to check both
layers of the same file:

```
node ../orchestration-manifest/validate.mjs example-manifest.json   # shape
node validate.mjs example-manifest.json                             # ordering
```

## The class vocabulary

A node's `class` is one of a small, generic software-delivery vocabulary. It is optional; a node
with no `class` is unconstrained.

`sync` · `edit` · `cascade` · `gate-add` · `pin` · `baseline` · `lockfile` · `dep-upgrade` ·
`test-signal` · `de-bloat` · `publish`

## The rule table (`rules.json`)

Each rule is `before → after`: a node of the `after` class must have at least one node of the
`before` class as a transitive dependency.

| before | after | why |
|---|---|---|
| `sync` | `edit` | edits on a stale base create merge debt |
| `cascade` | `gate-add` | a decision must reach every artifact before the gate that checks them is armed, or the gate fires on known-stale state |
| `cascade` | `publish` | publish the fully-propagated shape, not a half-cascaded one |
| `pin` | `baseline` | a baseline recorded against an unpinned or dead version is worthless |
| `lockfile` | `dep-upgrade` | lock the resolved graph before bumping majors, so the bump is reviewable and revertable |
| `test-signal` | `dep-upgrade` | establish test signal before an upgrade so breakage is detectable |
| `de-bloat` | `publish` | publish the cleaned shape once; do not publish and then prune |

The table is data, not code — an adopter extends the spine by adding a row to `rules.json`, not
by editing the checker.

## What this gate does and does not prove (honest bounding)

It proves **declared-class ordering**, nothing more. It never infers a node's class — a node
labelled `test-signal` that actually upgrades a dependency is the planner's mislabel, and no
static gate can catch it. That label-honesty judgment has no dedicated behavioral judge dimension
today; if one is ever needed it surfaces in the trajectory-eval layer, not here.

Two deliberate fail-open boundaries:

- **Undeclared nodes are unconstrained.** No class, no constraint. This keeps the gate from
  inventing classifications it cannot justify.
- **A prerequisite class with zero declared nodes leaves its rules unconstrained.** The manifest
  cannot see repo state, and the prerequisite may already stand outside the plan — a repository
  whose CI is already green needs no `test-signal` node before a `dep-upgrade`. Prerequisite
  *existence* is planning judgment; this gate checks ordering *shape* only. And the quantifier is
  "at least one" B-ancestor, not "every": two parallel lanes each carrying their own `test-signal
  → dep-upgrade` chain are correct, and the gate passes them.

Three ordering rules were considered and **dropped** because they cannot be stated crisply as a
class pair — forcing them would make the gate lie:

- *"secrets and the pipeline are calendar-independent P0 lanes"* — a priority/lane assignment, not
  a pairwise ordering between two node classes.
- *"frontier builds go last — everything else shrinks the surface they integrate with"* — an
  "after everything" catch-all, with no crisp predecessor class.
- *"don't invest test signal in code slated for deletion"* — this **looks** pairwise (`de-bloat →
  test-signal`) but is secretly scoped: it means de-bloat *of X* before test signal *on X*, a
  per-target relation that class granularity cannot express. A general `de-bloat → test-signal`
  rule would flag every plan that wires CI before a later cleanup pass — including this program's
  own spine. Dropped rather than forced.

## Composition

This standard composes on the [`orchestration-manifest`](../orchestration-manifest/) gate; it does
not fork it. The manifest gate proves shape (owners, dependencies, no cycles); this gate proves
ordering. Both run independently under `validate.mjs --all`, and a node's optional `class` field
is tolerated by the manifest gate. The checker does not import the manifest validator — it reads
`nodes` and `depends_on` directly and computes reachability itself.
