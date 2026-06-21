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

> Last reviewed: 2026-06-19
