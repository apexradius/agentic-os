# reference-integrity

The executable half of [`doctrine/standards/reference-integrity.md`](../../doctrine/standards/reference-integrity.md):
it keeps the framework's connective tissue honest. A dead link in an extracted public tree is a broken
promise; an index that omits a standard hides it. This gate proves neither happens.

A single tree of plain `.mjs`, **zero npm dependencies**, discovered by `validate.mjs --all` like every
other standard.

## What it checks

- **Link integrity** — every relative markdown link/image in the **architectural surface** (doctrine, the
  standards-as-code, primitive specs, coordination, the loop, prompting, top-level READMEs, runtime docs)
  resolves to a real file or directory. External links and pure `#anchors` are out of scope.
- **Index parity** — every doctrine standard (`doctrine/standards/*.md`) and rule (`doctrine/rules/*.md`) is
  listed in its index, and every standards-as-code gate (`standards/*/` with a `validate.mjs`) is listed in the
  standards index. Because the index rows are themselves links, the link scan proves the reverse: no listed
  standard's or rule's file has gone missing.

Out of scope: primitive **bodies** (`skills/`, `roles/`) — their own primitive validators cover them, and
their prose carries intentional placeholders (`](URL)`), templates, and third-party link conventions.
`TEMPLATE.md` and `fixtures/` are excluded for the same reason.

## Verify

```bash
node framework/standards/reference-integrity/validate.mjs   # selftest: link resolution + index parity, then the real scan
node framework/primitives/_lib/validate.mjs --all            # runs the above inside the full harness
```

> Last reviewed: 2026-06-25
