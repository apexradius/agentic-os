#!/usr/bin/env bash
# ci-status-aggregator.sh — read-only roll-up of CI health across a fleet of repos.
#
# WHY: a federated org (many independent repos, no monorepo) has no single pane of
# CI health — a red repo can hide. This script is the "aggregator" half of the
# recommended federation topology: keep per-repo independence, add a roll-up view.
#
# WHAT: for each repo in the fleet manifest, query the GitHub Actions API for the
# latest run on its default branch and classify it. READ-ONLY — only
# `gh run list` / `gh api` GETs; uses zero write scope. Safe to run on a cron
# or self-hosted runner.
#
# USAGE:
#   ci-status-aggregator.sh [MANIFEST_PATH]   # human board + summary to stdout
#   ci-status-aggregator.sh --json            # NDJSON only (one object per repo) to stdout
#   ci-status-aggregator.sh --out FILE        # also write NDJSON to FILE
#   ci-status-aggregator.sh --strict          # exit 1 if any repo's latest run is a failure
#
# MANIFEST: a text file, one repo per line: `<repo-name> [<branch>]`
#   Trailing comments (#) are stripped. Lines starting with # are skipped.
#   Default branch is `main` when not specified.
#
# ENV:
#   CI_FLEET_ORG       GitHub org name (required — no default)
#   CI_FLEET_MANIFEST  path to manifest file (optional — overridden by positional arg)
#
# POSITIONAL ARG (takes precedence over CI_FLEET_MANIFEST env):
#   $1   path to the fleet manifest file
#
# REQUIRES: gh (authenticated, repo+read:org scope), jq.
set -euo pipefail

# ── Manifest resolution ─────────────────────────────────────────────────────
# Priority: positional arg > CI_FLEET_MANIFEST env > error.
MANIFEST_ARG=""
JSON_ONLY=0
STRICT=0
OUT=""

while [ $# -gt 0 ]; do
  case "$1" in
    --json)   JSON_ONLY=1 ;;
    --strict) STRICT=1 ;;
    --out)    OUT="${2:?--out needs a path}"; shift ;;
    -h|--help) sed -n '2,40p' "$0"; exit 0 ;;
    --*)      echo "unknown flag: $1" >&2; exit 2 ;;
    *)        MANIFEST_ARG="$1" ;;
  esac
  shift
done

ORG="${CI_FLEET_ORG:-}"
if [ -z "$ORG" ]; then
  echo "fatal: CI_FLEET_ORG must be set to your GitHub org name" >&2
  exit 3
fi

if [ -n "$MANIFEST_ARG" ]; then
  MANIFEST="$MANIFEST_ARG"
elif [ -n "${CI_FLEET_MANIFEST:-}" ]; then
  MANIFEST="$CI_FLEET_MANIFEST"
else
  echo "fatal: provide manifest path as first argument or set CI_FLEET_MANIFEST" >&2
  exit 3
fi

# Bot/maintenance workflows whose runs are NOT code health — excluded so a failing
# Dependabot update doesn't mask (or falsely redden) a repo's actual CI. Override via env.
EXCLUDE_WORKFLOWS="${CI_FLEET_EXCLUDE_WORKFLOWS:-Dependabot Updates,pages-build-deployment}"

command -v gh >/dev/null || { echo "fatal: gh not found" >&2; exit 3; }
command -v jq >/dev/null || { echo "fatal: jq not found" >&2; exit 3; }
[ -f "$MANIFEST" ] || { echo "fatal: manifest not found: $MANIFEST" >&2; exit 3; }
gh auth status >/dev/null 2>&1 || { echo "fatal: gh not authenticated" >&2; exit 3; }

ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
results='[]'

while IFS= read -r line; do
  line="${line%%#*}"                 # strip trailing comment
  # trim surrounding whitespace
  line="$(printf '%s' "$line" | awk '{$1=$1};1')"
  [ -z "$line" ] && continue
  repo="$(printf '%s' "$line" | awk '{print $1}')"
  branch="$(printf '%s' "$line" | awk '{print ($2==""?"main":$2)}')"

  if runs_json="$(gh run list --repo "$ORG/$repo" --branch "$branch" -L 30 \
        --json conclusion,status,workflowName,url,headSha,createdAt 2>/dev/null)"; then
    # most recent run whose workflow is NOT a bot/maintenance workflow
    picked="$(jq -c --arg ex "$EXCLUDE_WORKFLOWS" '
        ($ex | split(",") | map(ascii_downcase | gsub("^\\s+|\\s+$";""))) as $excl
        | map(select((.workflowName // "" | ascii_downcase) as $w | ($excl | index($w)) | not))
        | .[0] // empty' <<<"$runs_json")"
    if [ -z "$picked" ]; then
      concl="none"; status="none"; wf=""; url=""; sha=""; created=""
    else
      concl="$(jq -r '.conclusion // ""' <<<"$picked")"
      status="$(jq -r '.status // ""'    <<<"$picked")"
      wf="$(jq -r '.workflowName // ""'   <<<"$picked")"
      url="$(jq -r '.url // ""'           <<<"$picked")"
      sha="$(jq -r '.headSha[0:7] // ""'  <<<"$picked")"
      created="$(jq -r '.createdAt // ""' <<<"$picked")"
      # in-flight runs have null conclusion; surface the live status instead
      [ -z "$concl" ] && concl="$status"
    fi
  else
    concl="error"; status="error"; wf=""; url=""; sha=""; created=""
  fi

  obj="$(jq -cn \
    --arg repo "$repo" --arg branch "$branch" --arg concl "$concl" --arg status "$status" \
    --arg wf "$wf" --arg url "$url" --arg sha "$sha" --arg created "$created" --arg ts "$ts" \
    '{repo:$repo, default_branch:$branch, last_conclusion:$concl, status:$status,
      workflow:$wf, run_url:$url, head_sha:$sha, created_at:$created, ts:$ts}')"
  results="$(jq -c --argjson o "$obj" '. + [$o]' <<<"$results")"
done < "$MANIFEST"

# NDJSON emit (always to --out if given; to stdout in --json mode)
if [ -n "$OUT" ]; then jq -c '.[]' <<<"$results" > "$OUT"; fi
if [ "$JSON_ONLY" -eq 1 ]; then
  jq -c '.[]' <<<"$results"
else
  # failures first, then everything else alphabetically
  jq -r '
    def icon:
      if   .last_conclusion=="success"     then "✅"
      elif .last_conclusion=="failure"     then "❌"
      elif .last_conclusion=="cancelled"   then "🚫"
      elif .last_conclusion=="none"        then "·"
      elif .last_conclusion=="error"       then "⚠️ "
      elif (.status=="in_progress" or .status=="queued") then "⏳"
      else "❔" end;
    sort_by([(.last_conclusion!="failure"), (.last_conclusion!="error"), .repo])[]
    | "\(icon)\t\(.repo)\t\(.last_conclusion)\t\(.workflow // "-")"
  ' <<<"$results" | column -t -s $'\t'

  printf '\n'
  jq -r '
    group_by(.last_conclusion) | map({k:.[0].last_conclusion, n:length})
    | "fleet: \([.[].n] | add) repos  |  " + (map("\(.k)=\(.n)") | join("  "))
  ' <<<"$results"
fi

if [ "$STRICT" -eq 1 ] && [ "$(jq '[.[]|select(.last_conclusion=="failure")]|length' <<<"$results")" -gt 0 ]; then
  exit 1
fi
exit 0
