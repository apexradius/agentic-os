# Versioning Standard

The framework is published as **agentic-os** and consumed by instances that sync `framework/` into
their own tree. The moment it has external consumers it owes them a promise: *what will an update do to
the artifacts I already built and the validators I already run green?* A version number is that promise,
made machine-checkable.

For a framework whose product is its **contracts** — the primitive JSON schemas, each standard's
exit-code/CLI behaviour, the coordination ledger schema, the prompting house style — "breaking" is not
about a function signature. It is about whether an instance that synced version X and passed
`validate.mjs --all` could sync the next version and suddenly **fail**, or silently behave differently.
The version encodes exactly that.

## The single source

[`framework/VERSION`](../../VERSION) holds one [SemVer](https://semver.org/spec/v2.0.0.html) line.
Nothing else declares a version; every consumer reads that file. [`framework/CHANGELOG.md`](../../CHANGELOG.md)
records what each version changed, newest first, in [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) form.

## What each bump means

| Bump | Trigger | Examples |
|---|---|---|
| **MAJOR** | A consumer-facing contract breaks | a primitive schema field becomes required, is removed, or is retyped; a standard's exit-code or CLI contract changes; the ledger schema changes incompatibly; a primitive, standard, or role is removed |
| **MINOR** | Purely additive | a new primitive / standard / skill / role / hook; a new *optional* schema field; a new validator |
| **PATCH** | No contract change | a validator bugfix, a doc edit, wording, a fixture |

The test for MAJOR is mechanical: *would an instance that validated green against the previous version
need to change its artifacts or its wiring to validate green against this one?* If yes, it is MAJOR.

## The release boundary

A **release is a public sync** — the archive-replace that pushes `framework/` to the public repository.
Every sync that changes a contract bumps `VERSION` and adds a `CHANGELOG` entry in the same commit; an
additive or fix-only sync still records the bump. Pre-1.0 (`0.y.z`) the contract is still settling: a
MINOR may carry a breaking change, but the `CHANGELOG` must say so under a **Breaking** heading.

## The instance's side

An instance pins the framework version it synced from and re-runs `validate.mjs --all` on every update. A
MAJOR bump is the signal to read the `CHANGELOG`'s Breaking notes *before* syncing — the version is the
early warning, the changelog is the migration. Executable enforcement of the
`VERSION`↔`CHANGELOG` half lives in [`standards/versioning/`](../../standards/versioning/).

> Last reviewed: 2026-06-25
