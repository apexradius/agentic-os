#!/usr/bin/env bash
# verify-zone-purity.sh — the zone-purity tripwire (risk R3) for the whole framework/ tree.
#
# framework/ must carry ZERO Apex coupling. The one sanctioned exception is the
# aorg/council ledger engine: a *faithful copy* of an Apex-coupled stdlib monolith
# that cannot be cleanly bisected (see ledger/SEAM.md). Its env-mediated defaults are
# neutralized; any irreducible residual is enumerated in .zone-residual.allow as a
# content snapshot, with each line justified by a SEAM row. SEAM.md documents the
# generic mechanism (placeholders); the adopter's instance zone holds the real-value
# record (the Apex instance: apex/config/aorg/EXTERNALIZATION-RECORD.md).
#
# This gate greps the WHOLE framework/ tree (not just runtime/ — earlier the narrow
# scope let real coupling hide in mcp-servers/, router/, primitives/ validators, and
# even the ledger engine itself) and fails on ANY coupling literal that is NOT already
# in the whitelist. New Apex coupling therefore can never enter framework/ unnoticed:
# a fresh literal is, by construction, absent from the snapshot.
# Run from anywhere: framework/runtime/verify-zone-purity.sh
set -uo pipefail
cd "$(dirname "$0")"               # framework/runtime/ (ALLOW + self-exclude stay stable here)
SCAN_ROOT="$(cd .. && pwd)"        # framework/ — scan the WHOLE tree, not just runtime/

# Coupling literals. Case-insensitive (grep -i below), so brand variants collapse:
# `apexradius` also catches apexradius.io; `tradeops` catches tradeops.site/TradeOps;
# `kovara`/`oaf` catch Kovara/OAF/oafconstruction. Groups:
#   brands/clients : apexradius, apex radius (spaced), kovara, perucas, oaf
#   monorepo       : apex-radius-platform, 02_Ecosystem
#   infra IPs      : 148.113 (OVH), 100.68 (tailnet)
#   deploy paths   : /srv/apex, /srv/state/apex, /opt/apex
#   agent vault    : \.gemini/ (path form ONLY — does NOT match .geminiApiKey / Gemini API refs)
#   secrets/users  : vardra, /home/adam, /Users/apex/ApexRadius
#   operator name  : ayo, ayokunle (the owner-name leak class — \bayo\b is word-bounded so
#                    it does NOT match 'layout'/'crayon'; ayokunle is matched as a substring)
# NOT gated: the APEX_<NAME> env-var NAMESPACE (41 files / 188 refs). Those are a config
# namespace, not infra disclosure — they carry no host/IP/secret VALUE (the values they point
# at ARE gated above). Renaming cascades to apex/config + live env + plists for ~zero purity
# gain (decision 2026-06-20). Keep the namespace; gate the values.
# Also NOT gated: the MCP SERVER NAMES `apex-omnibus`/`apex-social-mcp` (identity in clientInfo/
# serverInfo + the `mcp__apex-omnibus-mcp__*` tool-call prefix ecosystem-wide) — same namespace
# class as APEX_; renaming them is a massive cascade. Their infra PATHS (`/opt/apex-omnibus`,
# `/srv/state/apex-omnibus`) ARE gated, via `/opt/apex` + `/srv/state/apex`.
PAT='ayokunle|\bayo\b|apexradius|apex-radius-platform|apex radius|02_Ecosystem|tradeops|kovara|perucas|oaf|148\.113|100\.68|/srv/apex|/srv/state/apex|/opt/apex|\.gemini/|vardra|/home/adam|/Users/apex|/Volumes/ApexMain'
ALLOW=".zone-residual.allow"

if [ ! -f "$ALLOW" ]; then
  echo "FAIL: missing whitelist $ALLOW (regenerate from ledger/SEAM.md procedure)" >&2
  exit 2
fi

# Current coupling literals across the framework/ tree — *.md INCLUDED. Every framework
# doc is PAT-clean as of the SEAM scrub (SEAM.md genericized, the real-value record moved
# to the adopter zone), so docs are gated too now: a future Apex literal landing in any
# .md is absent from the snapshot and FAILS the gate by construction. Exclude only build
# artifacts and the snapshot itself:
# package-lock.json / *.tsbuildinfo are npm/tsc-generated artifacts whose base64 hashes
# randomly contain short patterns like "oaf" — excluded like node_modules/dist.
# *.bak* are transient applier backups (a *.bak copy of a self-protected engine file
# re-introduces the very literals the applier removed); rollback is git checkout, and the
# appliers write backups OUTSIDE framework/ — this exclude is defense-in-depth.
# LICENSE is excluded because its copyright line names the publishing org by design —
# deliberate legal attribution, not coupling (the org is already public via the repo path).
current="$(grep -rhiE "$PAT" "$SCAN_ROOT" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.venv \
  --exclude-dir=build --exclude-dir=__pycache__ --exclude-dir=.git \
  --exclude='package-lock.json' --exclude='*.tsbuildinfo' --exclude='*.bak*' \
  --exclude='LICENSE' \
  --exclude="$ALLOW" --exclude="$(basename "$0")" 2>/dev/null \
  | sed -E 's/^[[:space:]]+//' | sort -u)"

# Lines present now but absent from the whitelist == new, undocumented coupling.
new="$(comm -23 <(printf '%s\n' "$current") <(sort -u "$ALLOW") | sed '/^$/d')"

if [ -n "$new" ]; then
  echo "FAIL: undocumented Apex coupling in framework/ (not in $ALLOW):" >&2
  printf '  %s\n' "$new" >&2
  echo "If this is intentional residual, neutralize it or add it to $ALLOW + SEAM.md." >&2
  exit 1
fi

count="$(printf '%s\n' "$current" | sed '/^$/d' | wc -l | tr -d ' ')"
echo "OK: framework/ zone-pure — $count whitelisted residual line(s), zero undocumented coupling."
exit 0
