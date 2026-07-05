# Knowledge-Freshness Standard

Historical records are useful right up to the moment they are mistaken for live operating truth.
That failure is expensive: an old front door still says "start here," a migration log still sounds
canonical, a checkpoint still reads like today's plan, and an agent starts from stale state with
full confidence. The fix is structural: current authority is explicitly declared, historical
artifacts self-identify near the top, and every link from current truth to history is cued as
history at the point of use.

This standard keeps the distinction machine-checkable.

## The bar

1. **Startup authority is explicit.** The files a model may treat as current startup truth are
   named directly by the instance. "Consultable" is not the same as "startup authority."
2. **Current reference is distinct from startup authority.** Reference docs may stay current and
   useful without presenting themselves as the first-turn source of truth.
3. **Historical artifacts self-identify near the top.** Migration logs, checkpoints, audits,
   reconciliation docs, retired plans, provenance records, and similar artifacts must declare
   that status in the first screenful, before a reader can mistake them for current truth.
4. **Historical artifacts cannot borrow authority language naked.** Phrases like "start here,"
   "current truth," "single source of truth," or "canonical truth" are forbidden in a historical
   doc unless the same header clearly marks it historical or superseded.
5. **Startup authority cannot present itself as historical.** The files an agent reads first may
   discuss history, but they cannot open by calling themselves historical, superseded, or a
   checkpoint.
6. **Links from current truth to history are labeled as history.** If a startup-authority file
   points at a historical artifact, the surrounding text says so: historical, provenance,
   superseded, migration record, audit, or equivalent cue language.
7. **Exceptions expire.** If a file cannot yet satisfy the bar, the exception names the path, the
   reason, the owner, and an expiry date. No permanent carve-outs.
8. **Generated sidecars are still classified.** Non-Markdown artifacts may skip text scanning by
   default, but they are still classified so they cannot silently drift into the wrong trust tier.

## Scope

This is an **instance-owned classification standard**. The framework supplies the generic
validator; each instance supplies one or more manifests describing its startup authority, current
reference set, historical artifacts, ephemeral/session artifacts, and temporary exceptions.
Executable enforcement lives in
[`standards/knowledge-freshness/`](../../standards/knowledge-freshness/).

> Last reviewed: 2026-07-04
