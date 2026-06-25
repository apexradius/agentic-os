# Reference-Integrity Standard

A framework's value is largely its **connective tissue**: this doc points at that spec, this standard
enforces that rule, this index lists every gate. That tissue rots silently. A file is renamed, a doc moves,
a standard is added — and a link that used to resolve now points at nothing, or an index quietly omits the
thing it's supposed to map. In a private tree that's an annoyance. In an **extracted public framework** it's
a broken promise: a reader follows the link and hits a 404, and the framework looks unmaintained.

Prose cannot be trusted to stay honest about its own cross-references under editing pressure — especially
when two sessions edit the tree at once. This standard makes the references machine-checkable.

## The bar

1. **Every internal link resolves.** Every relative markdown link or image in the framework's architectural
   docs points at a file or directory that exists. External links (`http(s):`, `mailto:`) and pure `#anchors`
   are out of scope — the gate proves the *tree's own* links, not the live web.
2. **Every standard and rule is on its map.** Every doctrine standard (`doctrine/standards/*.md`) and rule
   (`doctrine/rules/*.md`) is listed in its index, and every standards-as-code gate (`standards/*/` with a
   `validate.mjs`) is listed in the standards index. No standard or rule exists that the map doesn't show; and
   because the index rows are themselves links, the link check proves the reverse — no map entry points at a
   doc that was deleted.

## Scope

The **architectural surface** — doctrine, the standards-as-code, primitive specs, coordination, the loop,
prompting, the top-level READMEs, and the runtime docs. Primitive **bodies** (`skills/`, `roles/`) are
deliberately out of scope: they are validated by their own primitive validators, and their prose carries
intentional placeholders (`](URL)`), templates, and third-party link conventions that are not the
framework's promises to keep. Fixtures and `TEMPLATE.md` files are excluded for the same reason — they
demonstrate links, they don't make them.

## How it relates to mirror-parity

[Mirror-parity](../README.md) keeps two co-owned manuals' *outlines* in sync. Reference-integrity keeps the
*links between docs* honest. Different drift, different gate. Together they ensure the framework's map both
matches its mirror and points only at things that exist. Executable enforcement lives in
[`standards/reference-integrity/`](../../standards/reference-integrity/).

> Last reviewed: 2026-06-25
