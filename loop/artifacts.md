# Artifacts

Plans that live only in conversation degrade with context. Artifacts are the durable record:
written to disk, they survive compaction, and a reviewer can check the work against them.

## The four artifacts (gated by size — see [README](README.md))

- **`RESEARCH.md`** — read-only discovery. Maps the files, interfaces, and dependencies the
  change touches. No edits proposed here; just the territory.
- **`WIRING.md`** — the blueprint. Defines the connections: source → logic → output. What
  calls what, what data flows where.
- **`IMPLEMENTATION.md`** — the living checklist. Done/pending markers per step, updated as
  work proceeds, so an interrupted session resumes from the file.
- **`RISKS.md`** *(high-risk only)* — failure modes, blast radius, and the rollback plan,
  written **before** touching production.

Each artifact also declares its **constraints** — what the change must NOT do. Negative
engineering prevents scope creep.

## Per-slice execution recommendation

Every slice in `WIRING.md` / `IMPLEMENTATION.md` — each step an executor will pick up — names the
**model tier and effort level** it should run on (e.g. `Sonnet · high`, `Opus · xhigh`). The default
session model plans on the top tier and executes on the mid tier; a slice that needs the top tier
for the *build itself* must say so, or it won't get it. A slice left as "best judgment" is **not
decision-complete** (see [planning.md](planning.md)). The concrete tier→effort mapping is the
instance's model-selection reference, not framework doctrine.

## The artifact-path standard

All run-artifacts — plans, drafts, notepads, research, role-scoped output — live under one
gitignored root: **`.agent/`** (repo-relative). One root, so artifacts never scatter and are
trivially ignored by git. (An instance whose runtime expects a different root reconciles this
at cutover; the framework default is `.agent/`.)

| Path | Holds |
|---|---|
| `.agent/plans/<name>.md` | Work plans (Plan-phase output) |
| `.agent/plans/open-questions.md` | Forks deferred to the user |
| `.agent/drafts/` | In-progress drafts |
| `.agent/notepads/<plan>/` | Execution learnings appended during Implement |
| `.agent/<task>/` | The four artifacts above, for a single complex task |
| `.agent/<role>/` | Role-scoped output (reports, figures, scans) |

Plans under `.agent/plans/` are **read-only to executors** — an executor appends to its
notepad, never edits the plan it was handed.

A plan's life ends at **close-out**: once the work it describes is verified done, its outcome is
folded into the knowledge base and any remainder into the task ledger, and the plan file is
**deleted** (see [verification.md](verification.md)). Plans are ephemeral; their durable residue —
knowledge and open tasks — is not. A finished plan left on disk is stale state, not a record.

> Last reviewed: 2026-06-22
