# versioning

The executable half of [`doctrine/standards/versioning.md`](../../doctrine/standards/versioning.md): proves
[`framework/VERSION`](../../VERSION) is a single valid SemVer line and that
[`framework/CHANGELOG.md`](../../CHANGELOG.md)'s latest *released* entry matches it — so the version a
consumer pins and the changelog they read can never drift apart.

A single tree of plain `.mjs` with **zero npm dependencies**, discovered by `validate.mjs --all` like every
other standard (creating this `validate.mjs` is the entire registration).

## What it checks

- `VERSION` exists at the framework root and is one valid SemVer line.
- `CHANGELOG.md` exists, follows Keep a Changelog, and carries an `[Unreleased]` section.
- The changelog's **latest released entry equals `VERSION`** — the load-bearing anti-drift check: you
  cannot bump the version without recording what changed, and you cannot ship a changelog that disagrees
  with the version a consumer would pin.

## Verify

```bash
node framework/standards/versioning/validate.mjs    # selftest: semver validity + VERSION↔CHANGELOG agreement
node framework/primitives/_lib/validate.mjs --all    # runs the above inside the full harness
```

> Last reviewed: 2026-06-25
