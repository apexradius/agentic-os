# Primitive: Memory

> A memory record is one durable fact the agent will re-read across sessions — a fact about the
> world, an operating lesson, an operator preference, in-flight state, or a pointer to an external
> resource. This spec is the contract that keeps those facts honest: the right layer, a freshness
> date, no secrets, one fact per record.
> Schema: [`memory.schema.json`](memory.schema.json). Validator: [`validate.mjs`](validate.mjs).
> Creator: [`creator.md`](creator.md).

This primitive formalizes the layered-memory model that [`framework/loop/context.md`](../../loop/context.md)
states as prose ("Layered memory — the persistence stack"). Doctrine's rule is *spec + schema +
creator + validator for any new primitive; prose isn't enough* — so the tier taxonomy and the
freshness rule become a machine-checkable record contract here, and context.md keeps the narrative.

## What this primitive governs (and what it does not)

It governs the atomic **memory record**: one fact, one file — YAML **frontmatter** (recall metadata)
plus a markdown **body** (the fact, and *why* it matters). It does **not** govern:

- **Aggregate digest files** (an instance's `memory.md` / `lessons.md` / `user-model.md`) — those are
  prose rollups of the standing / lesson / user-model layers, kept honest over time by the
  [`knowledge-freshness`](../../standards/knowledge-freshness/) standard (status banners, freshness
  contract, retired-term scans). This primitive's `verified` date *feeds* that standard; it does not
  re-implement it.
- **Skills** — procedural memory ("how to do X") is the [`skills`](../skills/) primitive.
- **The recall runtime** — how memory is embedded, ranked, injected, or served is out of scope. This
  primitive says what a memory *is*; it does not build how memory is fetched.

## The shape of a memory record

One file per fact. The self-identifying in-repo convention is `<slug>.memory.md` (so the validator
never mistakes an aggregate `memory.md` for a record); an external record store may name files
`<slug>.md`. The `name` frontmatter field equals the filename slug.

```markdown
---
name: three-apps-not-a-crm            # kebab-case; == the filename slug
description: We ship exactly 3 apps; the billing DB's legacy name is not a product category.
tier: standing                        # standing | lesson | user-model | session | reference
verified: 2026-07-05                  # ISO date last confirmed against reality (long-lived tiers)
links: [product-taxonomy]             # related record slugs — the [[name]] graph
---

The three apps are A, B, and C. A legacy database name is not evidence of a fourth product —
never infer a product category from a schema name.
```

The two fields that carry the most weight: `tier` (which layer this fact lives in — pick exactly
one) and `description` (the **recall signal** — what a future agent scans to decide the record is
relevant, never a body recap). Both are bounded by [`memory.schema.json`](memory.schema.json).

## The tier model — one fact, one layer

The `tier` enum is the persistence stack minus skills (its own primitive). A fact belongs to exactly
one layer; that choice also implies its lifespan and where it lives.

| `tier` | Holds | Lifespan | `verified` |
|---|---|---|---|
| `standing` | Facts about the world the agent operates in — systems, topology, models, contracts | Long-lived | required |
| `lesson` | A distilled "we learned X the hard way" operating correction | Long-lived | required |
| `user-model` | How the *operator* wants work done — preferences, standing corrections, style | Long-lived | required |
| `reference` | A pointer to an external resource — URL, dashboard, ticket | Long-lived | required |
| `session` | What was in flight when a session ended — the very next action, uncommitted state | Short-lived | omitted |

Two rules keep the stack from rotting (from context.md, now enforced):

- **Right layer, not every layer.** A durable truth stranded in a `session` record is lost at the
  next prune; a transient state written as `standing` is a lie within a week. When a `session` record
  turns out to hold something durable, **graduate it** to the right long-lived tier and let the
  session record stay disposable.
- **Freshness over faith.** Long-lived records carry `verified` — the date the fact was last
  confirmed. A stale date means *re-verify before acting*, not "distrust." When live reality
  contradicts a record, reality wins and you fix the record in the same pass.

## Validation: an OPEN schema (deliberately)

Like skills — and unlike the closed control-plane vocabularies (agents, commands) — the memory
schema is **open** (`additionalProperties: true`). The live record corpus predates this primitive
and carries keys such as `originSessionId`; a closed whitelist would punish real records for
existing first. We type-check the **known** keys strictly and let novel keys pass. Two layers:

1. **Frontmatter** → `ajv` against `memory.schema.json`: `name` (kebab, ≤64), `description` (≤1024,
   no angle brackets), `tier` (one of the five) required; `verified` (ISO), `scope`, `links` type-checked.
2. **Body + cross-field** → code (`validate.mjs`): non-empty body; `verified` **required** for the
   four long-lived tiers and meaningless on `session` (warned); a **no-secrets** scan; `name` ==
   filename slug (warned); a legacy `metadata.type` → canonical `tier` nudge that names the mapping.

A `framework/`-zone record must additionally be coupling-free (same zone guard as skills/agents) —
a memory record is instance state, so a coupled record under `framework/` is misplaced. An inline
`--selftest` keeps `node _lib/validate.mjs --all` non-vacuous on a fresh clone.

## Constraints (what NOT to do)

- **Never store a secret in a memory record.** No tokens, keys, passwords, or private-key material —
  ever. The validator scans for the obvious shapes; the rule is absolute regardless. Secrets live in
  the instance's secret store, never in a durable, re-read, possibly-synced file.
- **Never save what git already records.** Code-change summaries, bug-fix write-ups, and "what I did
  this session" belong in commit history, not memory. Memory is *standing facts about the world and
  the operator*, not a session diary.
- **Never split one fact across layers.** A fact lives in exactly one `tier`. If it seems to belong
  to two, it's two facts — write two records and `link` them.
- **Never let a long-lived record go undated.** No `verified` on a `standing`/`lesson`/`user-model`/
  `reference` record means the freshness contract can't hold — the validator fails it.
- **Never write a body-recap `description`.** It's the recall signal ("this record is about X; it
  matters because Y"), not a summary of the body.

## Verify (executable acceptance)

```
node framework/primitives/memory/validate.mjs --selftest                 # inline RED/GREEN fixtures
node framework/primitives/memory/validate.mjs path/to/records/*.md       # real records (explicit paths)
node framework/primitives/memory/validate.mjs                            # in-repo *.memory.md set + selftest
```

Green = the record set conforms. The **creator's failing baseline** (per the primitive set's
convention, the creator carries no separate eval file — the baseline is documented here and in
[`creator.md`](creator.md)):

> **Baseline (no creator SOP):** asked to "remember that X," the agent appends a free-form line to
> some file — no frontmatter, no `tier`, no `verified` date, maybe the wrong layer or an embedded
> session detail. Nothing a validator can check.
> **Pass (with the SOP):** a well-formed record — the correct `tier`, a `verified` date, a kebab
> `name` equal to the slug, a recall-signal `description`, a body plus `links`, no secret — that
> passes `validate.mjs`.
