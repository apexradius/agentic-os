# knowledge-freshness

The executable half of [`doctrine/standards/knowledge-freshness.md`](../../doctrine/standards/knowledge-freshness.md):
it keeps historical records from reading like current operating truth. The framework stays generic;
an instance declares its own startup authority and history boundaries in one or more
`knowledge-freshness.manifest.json` files.

A single tree of plain `.mjs`, **zero npm dependencies**, discovered by `validate.mjs --all` like
every other standard.

## What it checks

- **Manifest discovery + classification completeness** — every discovered
  `knowledge-freshness.manifest.json` has the required top-level shape; every listed file exists;
  every scanned file is classified as `startup_authority`, `current_reference`,
  `historical_artifact`, `ephemeral`, or a time-boxed `exception`.
- **Historical status banners** — every text-scannable historical artifact declares its status in
  the first `N` lines (`Historical record`, `Superseded`, `Checkpoint`, `Migration log`,
  `Provenance`, `Audit`, or equivalent explicit wording).
- **Authority-language protection** — a historical artifact using phrases such as `start here`,
  `current truth`, `single source of truth`, or `canonical truth` fails unless that same header
  clearly marks it historical or superseded.
- **Startup-authority discipline** — startup files may not present themselves as historical, and
  any markdown link from startup authority to a historical artifact must use nearby cue language
  such as `historical`, `provenance`, `superseded`, `migration record`, or `audit`.
- **Freshness invariants** — instance-critical files can declare extra invariants in the manifest
  rules, such as `memory.md` carrying a freshness contract near the top and `tasks.md` keeping its
  live `Active` section above the historical build ledger.
- **Retired-term prose scan** — files classified `startup_authority` or `current_reference` may not
  assert a retired thing as still live. An instance lists `retired_terms` (each with its
  `retired_on` date) in the manifest; a term found in a live-classified file **without** a nearby
  retirement cue (`retired_term_cues`, or a built-in generic default) fails as
  `retired-term-live-assertion`. History is allowed three ways: the file is classified historical
  (never scanned), the mention sits next to a retirement cue (read as a note, not a claim), or the
  live region ends — the scan stops at the historical build-ledger heading. When a live file must
  keep an un-cued mention, a dated, owned `retired_term_exemptions` entry (per file, per term, or
  `*`) opts it out until `expires_on`; an expired exemption fails as `retired-term-exemption-expired`.

Non-Markdown artifacts such as `.png`, `.json`, and `.artifact.html` are still classified but skip
text scanning unless an instance explicitly opts them in.

Gitignored files are excluded from the scan surface (via a single `git check-ignore` batch): the
gate governs committed knowledge source only (doctrine: "Commit source, gitignore artifacts"), so
machine-generated artifacts like `apex/knowledge/drift-reports/` need no manifest entry, and local
validate sees the same surface as CI on a clean checkout. Off a git repo the filter degrades to
scanning everything.

## Verify

```bash
node framework/standards/knowledge-freshness/validate.mjs
node framework/primitives/_lib/validate.mjs --all
```

> Last reviewed: 2026-07-05
