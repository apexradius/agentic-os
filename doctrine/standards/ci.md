# CI Standard

The law for how every repository in a multi-repo org handles continuous
integration, secret scanning, static analysis, and pre-commit enforcement.
The enforcement tooling and reusable workflows are in
[`../../standards/ci/`](../../standards/ci/).

## The problem this solves

Copy-pasting a `ci.yml` into each repo guarantees drift within a quarter.
At N repos, you have N diverging CI configurations with N sets of ignored
lint rules, N gitleaks policies, and N different thresholds for what counts
as a failure. One bad config produces false greens. One stricter config produces
friction. Neither situation is intentional.

A reusable workflow library eliminates this class of problem: update once in
the source, every consumer picks up the change when they bump the version pin.
The no-copy-paste constraint turns a maintenance burden into a version-control
problem — one the ecosystem already knows how to solve.

## The law: no one-off CI

**Every repo adopts the reusable CI workflows on day one.** This is the org
default, not an option. The only repos that should deviate are those whose
existing CI is provably more sophisticated than what the standard provides
(e.g. a repo with Sigstore attestations, deterministic builds, or a daemon
integrity gate) — and even then, that repo's one-off CI is a ceiling to grow
the standard toward, not a license to ignore the standard elsewhere.

A repo that rolls its own `ci.yml` from scratch instead of calling a reusable
workflow is accumulating maintenance debt that compounds with every engineer
who joins and every dependency that needs upgrading.

## The law: branch protection from day one

CI is only as strong as the branch protection that makes it blocking. Every
`main` branch must have:

- `required_status_checks.strict: true` — PR must be up-to-date with main.
- The relevant job names listed under `contexts` — so a red CI actually blocks
  the merge.
- `enforce_admins: true` — administrators are not exempt.
- `allow_force_pushes: false` — history is immutable.

Set this programmatically at repo creation. Don't defer it to "after we
stabilize" — that is when the first bad merge happens.

## Why a delivery repo is required

GitHub resolves reusable workflows at:

```
<org>/<repo>/.github/workflows/<file>@<ref>
```

This means the workflow files must live under `.github/workflows/` in a
published repository — you cannot reference a workflow from an arbitrary path
in an arbitrary repo. The framework's `standards/ci/workflows/` directory is
the **generic source**; it cannot be the resolution target directly.

The instance's **delivery repo** is the published copy. Its `.github/workflows/`
directory is populated from the framework source and tagged with semantic
versions. Callers reference the delivery repo by org/repo/tag.

This is the same relationship the framework has with its public counterpart
(`agentic-os`): framework owns the generic source; the instance owns the
delivery. The framework source is never directly consumed by production callers.

## The delivery model

```
framework/standards/ci/workflows/*.yml
         ↓ instance sync (copy to delivery repo .github/workflows/)
<your-org>/<ci-delivery-repo> (delivery repo, semantic-versioned tags)
         ↓ version pin in caller repos
every consuming repo (.github/workflows/ci.yml calls uses: <your-org>/<ci-delivery-repo>/...)
```

The instance owns:
- The delivery repo and its versioning cadence.
- The fleet manifest (`fleet-repos.txt` or equivalent) — which repos are in
  the fleet, and what their default branches are. This is instance state and
  must never live in the framework.
- Per-repo secrets (`SHOPIFY_FLAG_STORE`, etc.) — instance configuration.

The framework owns:
- The generic workflow source (scrubbed of all instance literals).
- The shared tool configs (Biome, gitleaks baseline, ruff, CodeRabbit,
  Lefthook templates).
- The fleet aggregator script (`ci-status-aggregator.sh`) — reads a manifest
  path from `$1` or `$CI_FLEET_MANIFEST`; `CI_FLEET_ORG` is required env.

## The tier model

| Tier | Where | What | Tool |
|---|---|---|---|
| 1 | Pre-commit (Lefthook) | Style, format, obvious lint. Fast, blocking locally. | Biome / Ruff / cargo fmt / theme-check |
| 1.5 | CI (this standard) | Typecheck + tests + build + secrets scan + SAST | reusable workflows |
| 2 | PR review (CodeRabbit) | Functional bugs, concurrency, security — diff-scoped | CodeRabbit |
| 3 | PR review (Greptile) | Cross-file impact in untouched files | Greptile |

Tier 1 is local and bypassable; Tier 1.5 is the structural gate. Tiers 2–3
are SaaS and zero-config once the GitHub app is installed at the org level.
The standard configures Tier 2 via `configs/coderabbit.yaml`.

## What the standard does NOT own

The standard governs mechanism. The instance governs configuration:

- Which repos are in the fleet (the manifest).
- What secrets each repo needs (e.g. Shopify store credentials, API tokens).
- The versioning cadence of the delivery repo.
- Per-repo overrides (a repo-local `.gitleaks.toml` takes precedence over the
  embedded policy; a repo-local `biome.json` takes precedence over the shared
  config).
- Any IP allowlists, internal hostname patterns, or org-specific regex in
  gitleaks — those belong in the instance's delivery repo, not in the
  framework's embedded policy.

> Last reviewed: 2026-06-23
