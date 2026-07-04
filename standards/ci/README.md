# ci

Reusable GitHub Actions workflows and shared lint/scan tool configs for
multi-language repository fleets. One source of truth: update once, every
consumer picks up the change on their next version-pin bump.

This standard defines the **generic source**. Your instance owns the delivery
repo (see "How it is delivered" below) and its fleet manifest.

## What this standard provides

| Subdirectory | Contents |
|---|---|
| `workflows/` | 9 reusable GitHub Actions workflows — one per language/concern |
| `configs/` | Shared tool configs (Biome, gitleaks, ruff, CodeRabbit, Lefthook) |
| `examples/` | Drop-in caller templates for each workflow |
| `scripts/` | `ci-status-aggregator.sh` — read-only CI health roll-up across a repo fleet |

### Workflows

| Workflow | What it does | Language/stack |
|---|---|---|
| `dep-audit.yml` | CVE audit via native tools (npm/pip-audit/cargo-audit) | npm, pnpm, yarn, pip, cargo |
| `fleet-policy.yml` | Validates generated fleet policies (`stage_allow.py --check`) | Python |
| `gitleaks.yml` | Secret scanning (embedded policy, repo-local override supported) | all |
| `python-backend.yml` | Ruff lint/format, mypy, pytest, secrets scan, Semgrep, dep-audit | Python |
| `rust-workspace.yml` | fmt, clippy, test, release build, secrets scan, Semgrep, dep-audit | Rust |
| `semgrep.yml` | OSS Semgrep SAST (no SaaS token) | all |
| `shopify-theme-perf.yml` | Lighthouse CI + axe-core perf/a11y gate for Shopify themes | Liquid/JS |
| `shopify-theme.yml` | Theme Check, Biome asset lint, secrets scan, Semgrep, perf/a11y | Liquid/JS |
| `typescript-pkg.yml` | Biome/ESLint, tsc, build, test, secrets scan, Semgrep, dep-audit | TypeScript/JS |

### Tier model

| Tier | Where it runs | What it catches | Tool |
|---|---|---|---|
| 1 | Pre-commit (Lefthook) | Style, format, obvious lint. Cheap, fast, blocking locally. | Biome / Ruff / cargo fmt / theme-check |
| 1.5 | CI (this standard) | Same as Tier 1 + typecheck + tests + secrets scan + build | these reusable workflows |
| 2 | PR review (CodeRabbit) | Functional logic, concurrency, security, perf — diff-scoped | CodeRabbit (`.coderabbit.yaml`) |
| 3 | PR review (Greptile) | Cross-file impact, downstream breakage in untouched files | Greptile (org-level GitHub app install) |

Tier 1.5 is the CI layer because Tier 1 is local-only and bypassable. Tiers 2
and 3 are SaaS — this standard's config files configure them; the GitHub apps
need a one-time install at the org level.

## How to CONSUME it (from a caller repo)

GitHub resolves reusable workflows at a specific path structure:

```
<org>/<repo>/.github/workflows/<file>@<ref>
```

This means workflows must exist under `.github/workflows/` in a **delivery
repo** — the framework `workflows/` directory is the **source**, not the
resolution path. Your instance publishes these files to a delivery repo, and
callers reference them by tag:

```yaml
jobs:
  ci:
    uses: <your-org>/<ci-delivery-repo>/.github/workflows/shopify-theme.yml@v1.0.0
    secrets: inherit
    with:
      lint-asset-js: true
      secrets-scan: true
```

See `examples/` for drop-in caller templates per language. Copy the matching
file to `.github/workflows/ci.yml` in your repo and tune the `with:` inputs.

### Adopting in a new repo (≈ 5 minutes)

1. Copy the matching `examples/*.yml` → `.github/workflows/ci.yml`.
2. Replace `<your-org>/<ci-delivery-repo>` with your delivery repo and `<tag>` with
   the current pinned tag.
3. Copy `configs/coderabbit.yaml` → `.coderabbit.yaml` at repo root.
4. (Optional) Copy `configs/lefthook/<lang>.yml` → `lefthook.yml` and run
   `lefthook install`.
5. Apply branch protection:

```json
{
  "required_status_checks": { "strict": true, "contexts": ["ci / <job-name>"] },
  "enforce_admins": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

Set via:
```sh
echo "$PROTECTION_JSON" | gh api -X PUT "/repos/<your-org>/<repo>/branches/main/protection" --input -
```

## How it is DELIVERED

The framework owns the generic source. The instance owns a delivery repo that
syncs from this source and publishes under its own GitHub org so callers can
reference workflows by org/repo path.

Delivery flow:

```
framework/standards/ci/workflows/*.yml
       ↓ instance sync (copy to .github/workflows/)
<your-org>/<ci-delivery-repo> (delivery repo)
       ↓ tag + version pin
caller repos
```

The instance keeps its own fleet manifest (e.g. `fleet-repos.txt`) in the
delivery repo — this is **instance configuration** and must NOT live in the
framework. The framework owns the aggregator script
(`scripts/ci-status-aggregator.sh`); the instance sets `CI_FLEET_ORG` and
passes the manifest path.

### Versioning

Tag the delivery repo with semantic versions: `v1.0.0`, `v1.0.1`, `v2.0.0`.
Bump major only on breaking input changes. Callers pin the latest patch
(`@v1.0.1`). Internal iteration happens on `main`; only tag after the changes
are exercised by at least one downstream repo.

## Fleet CI health roll-up

```bash
# Set your org and point at your fleet manifest
export CI_FLEET_ORG=<your-org>
bash scripts/ci-status-aggregator.sh /path/to/fleet-repos.txt

# NDJSON output
bash scripts/ci-status-aggregator.sh /path/to/fleet-repos.txt --json

# Exit 1 if any repo is red
bash scripts/ci-status-aggregator.sh /path/to/fleet-repos.txt --strict
```

The manifest is one repo per line: `<repo-name> [<branch>]`. Trailing `#`
comments are stripped. The script is read-only — only `gh run list` / `gh api`
GETs; safe on a cron.

## Verify

```bash
node framework/standards/ci/validate.mjs        # selftest (zone-purity + shape)
node framework/primitives/_lib/validate.mjs --all  # full harness
bash framework/runtime/verify-zone-purity.sh    # zero instance coupling
```

> Last reviewed: 2026-06-23
