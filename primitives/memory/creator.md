# Creator: how to add or change a memory record

> The SOP for writing one durable fact into memory, or fixing one. Read [`spec.md`](spec.md) first.
> The last step is an executable gate. Before writing, check whether a record already covers the
> fact — update that one rather than adding a near-duplicate.

## Decide the tier (pick exactly one)

A fact lives in a single layer. Choose by what the fact *is* and how long it stays true:

- Is it a **fact about the world** — a system, topology, model, version, or contract? → `standing`.
- Is it a **lesson** — "we learned X the hard way," an operating correction? → `lesson`.
- Is it about **the operator** — how they want work done, a preference, a standing correction? → `user-model`.
- Is it a **pointer to an external resource** — a URL, dashboard, or ticket? → `reference`.
- Is it **in-flight state** — the very next action, uncommitted work, what was open at session end? → `session`.

If it seems to fit two, it's two facts: write two records and `link` them. If it's a code change,
a bug fix, or "what I did this session," it does **not** belong in memory — that's git history.

Then decide **scope**: shared knowledge zone (`central` — standing / lesson / user-model) or the
per-instance / per-project store (`local` — project-specific facts, references). The instance maps
tier → zone; `scope` only records intent.

## Author the record

1. **One file per fact.** Name it `<slug>.memory.md` in-repo (or `<slug>.md` in an external record
   store). The `name` frontmatter field must equal the slug.
2. **Frontmatter.** `name` (kebab-case), `description`, and `tier` are required. Write the
   `description` as a **recall signal** — "this record is about X; it matters because Y" — the line a
   future agent scans to decide the record is relevant, never a body recap. Add `verified` (today's
   ISO date) for any long-lived tier; omit it on `session`. Add `links` to related record slugs.
3. **Body.** State the fact plainly, then the *why* it's load-bearing. For `lesson` and `user-model`
   records, follow with the reasoning and how to apply it — the correction is only useful with its
   cause. Keep it tight; one fact, not an essay.
4. **No secrets, ever.** No tokens, keys, passwords, or private-key material — regardless of tier.
   Secrets live in the instance secret store, never in a durable re-read file.
5. **Freshness.** A long-lived record's `verified` date is a promise you confirmed the fact today.
   When you later find reality has moved, fix the record *and* re-date it in the same pass.

## Verify (the gate)

```bash
node framework/primitives/memory/validate.mjs path/to/<slug>.memory.md
node framework/primitives/memory/validate.mjs --selftest
```

A green `validate` is done. There is no emitted copy — a record is one file; an instance mirrors its
record store to where each runtime reads (its sync script), the same copy-not-projection model as skills.

## The failing baseline (why this SOP earns its place)

Consistent with the primitive set, this creator ships **no separate eval file** — the baseline is the
one in [`spec.md`](spec.md) → Verify:

> **Without the SOP:** asked to "remember that X," the agent appends a free-form line somewhere — no
> frontmatter, no `tier`, no `verified` date, maybe the wrong layer or an embedded session detail.
> Structurally unvalidatable, stale within a week, and a future agent can't tell what it's for.
> **With the SOP:** a well-formed record — correct `tier`, a `verified` date, `name` == slug, a
> recall-signal `description`, body + `links`, no secret — that passes `validate.mjs`.

## Reference

The prior art is the live record corpus (an external per-file auto-memory store) and the layered
model in [`../../loop/context.md`](../../loop/context.md#layered-memory--the-persistence-stack). This
primitive's `tier` enum supersedes the corpus's legacy `metadata.type` vocabulary; the validator
nudges old records toward it.
