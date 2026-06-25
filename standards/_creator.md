# Creator — authoring a new standards-as-code gate

The meta-skill for adding a gate to this directory. Primitives each ship a `creator.md`; this is
its sibling for the **standards-as-code** layer, so a new gate is authored to the contract in one
pass instead of reverse-engineered from the twelve that came before. The contract this produces is
enforced by the [`standard-shape`](standard-shape/) gate — write a gate that violates it and the
harness fails your gate by name.

## When you need one

A new gate is warranted when a **doctrine standard** (prose law under
[`../doctrine/standards/`](../doctrine/standards/)) expresses something a machine can check
deterministically — a link that must resolve, an artifact that must exist, a literal that must not
appear. If the thing requires judgment (is this the *right* abstraction?), it stays with a role, not
a gate. Format is enforced here; substance stays with review.

## The contract (what `standard-shape` will check)

| Requirement | Why |
|---|---|
| First line is `#!/usr/bin/env node` | runs bare and under the harness alike |
| Imports only `node:` builtins or relative paths — **zero npm dependencies** | runs on a fresh extraction with no `npm install` — the portability promise |
| Prints `<name>: X/Y selftest checks passed` and exits non-zero on any failure | the line + exit code the umbrella runner rolls up |
| Ships a sibling `README.md` | the human entry point |

Name-matched doctrine law is **not** required — a gate's prose may live in a differently-named or
shared doctrine file.

## Steps

1. **Write (or reuse) the doctrine law.** State the bar in prose under `../doctrine/standards/`.
   Reuse an existing law if the gate enforces one that already exists.
2. **Ground the real artifacts first.** Before asserting a pattern, read the things you'll scan.
   Patterns assumed from memory false-flag — every gate in this tree that scans real files was
   grounded against them first.
3. **Scaffold `standards/<name>/validate.mjs`** from the skeleton below.
4. **Write pure helpers + a RED/GREEN selftest.** Export the decision functions; prove on a temp or
   inline fixture that the checker *catches* the violation it guards (the RED case), not just that it
   passes clean input.
5. **Scan the real surface.** After the selftest, run the helpers over the actual tree and surface
   the first offender by name.
6. **Write the sibling `README.md`** (what it checks, what it deliberately doesn't, how to verify).
7. **Index it.** Add a row to [`README.md`](README.md) (the standards index) and, if you added a
   doctrine file, to [`../doctrine/standards/README.md`](../doctrine/standards/README.md). The
   [`reference-integrity`](reference-integrity/) gate fails if a gate or law is missing from its index.
8. **Record it** in [`../CHANGELOG.md`](../CHANGELOG.md) under `[Unreleased]`, and bump
   [`../VERSION`](../VERSION) in lockstep when the release is cut.
9. **Verify:** your gate green on its own, then `node primitives/_lib/validate.mjs --all` ALL VALID
   (which now includes [`standard-shape`](standard-shape/) checking your gate's shape) and
   `bash ../runtime/verify-zone-purity.sh` clean.

## Skeleton

```js
#!/usr/bin/env node
// validate.mjs — the <name> standard. Enforces doctrine/standards/<law>.md: <one line>.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", ".."); // framework/
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: !!cond, detail }); return !!cond; };

// ── pure helpers (exported for testability) ──────────────────────────────────────
export function decide(/* input */) { /* return a verdict from data, no I/O */ }

// ── selftest: RED/GREEN on a fixture ─────────────────────────────────────────────
ok("decide: flags the violation", /* decide(badFixture) is caught */ true);
ok("decide: passes clean input", /* decide(goodFixture) is clean */ true);

// ── scan: the real surface ───────────────────────────────────────────────────────
// read the actual tree, run decide(), surface the first offender by name.

for (const f of ["validate.mjs", "README.md"]) ok(`file present: ${f}`, existsSync(join(__dirname, f)));

const failed = checks.filter((c) => !c.pass);
for (const c of checks) if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`<name>: ${checks.length - failed.length}/${checks.length} selftest checks passed`);
process.exit(failed.length ? 1 : 0);
```

## Anti-patterns

- **An npm dependency.** Breaks the zero-install promise; `standard-shape` fails you. Use `node:`
  builtins only.
- **No RED case.** A selftest that only proves clean input passes hasn't proven the gate *works*.
- **Asserting an ungrounded pattern.** A scan written from a guess about file shape false-flags real
  artifacts — see [`primitive-integrity`](primitive-integrity/) (the schema is `<name>.schema.json`,
  not `schema.json`) for why step 2 exists.
- **Requiring name-matched doctrine law.** Several gates point at a differently-named or shared law;
  don't gate on the filename.

> Last reviewed: 2026-06-25
