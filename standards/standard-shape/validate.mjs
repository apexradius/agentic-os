#!/usr/bin/env node
// validate.mjs — the standard-shape standard, run bare or by `validate.mjs --all`. Enforces
// doctrine/standards/standard-shape.md: every standards-as-code gate (`standards/<name>/validate.mjs`)
// obeys the contract the harness relies on — node shebang, ZERO npm dependencies (imports only node:
// builtins or relative paths), a parseable `<name>: X/Y selftest checks passed` tail with a non-zero exit
// on failure, and a sibling README.md. The dependency check is the load-bearing one: a gate that imports
// an npm package passes for the author but breaks the moment a consumer runs it on a bare extraction with
// no install. This gate scans every sibling gate (including itself) and flags an offender by name.
//
// Note on self-scanning: the RED fixtures below are single-line string literals using `\n` escapes, so no
// *physical* line of this source begins with a non-node import — the line-anchored import scan never
// mistakes a fixture for a real dependency leak in this file.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", ".."); // framework/
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: !!cond, detail }); return !!cond; };

// ── pure helpers ─────────────────────────────────────────────────────────────────
/** True iff the source's first line is the node shebang. */
export function hasShebang(src) {
  return String(src).startsWith("#!/usr/bin/env node");
}
/** Module specifiers of real (line-anchored, single-line) import statements that are neither node:
 *  builtins nor relative paths — i.e. npm dependencies, which break a zero-install extraction. House
 *  style keeps imports single-line; a multi-line import is out of the line-anchored scan's reach. */
export function npmDeps(src) {
  const specs = []; const re = /^\s*import\b[^\n]*?["']([^"']+)["']/gm; let m;
  while ((m = re.exec(String(src)))) specs.push(m[1]);
  return specs.filter((s) => !/^(node:|\.|\/)/.test(s));
}
/** True iff the source prints the rollup-parseable selftest tail AND exits non-zero on failure. */
export function hasSelftestTail(src) {
  return /selftest checks passed/.test(String(src)) && /process\.exit\(/.test(String(src));
}

// ── selftest: shape helpers, RED/GREEN on inline fixtures ────────────────────────
const GOOD = '#!/usr/bin/env node\nimport { x } from "node:fs"\nimport "./local.mjs"\nconsole.log("g: 1/1 selftest checks passed")\nprocess.exit(0)\n';
const DEP = '#!/usr/bin/env node\nimport _ from "lodash"\nimport { z } from "node:os"\n';
ok("hasShebang: true for the node shebang", hasShebang(GOOD));
ok("hasShebang: false without it", !hasShebang('import x from "node:fs"\n'));
ok("npmDeps: node: and relative imports are clean", npmDeps(GOOD).length === 0);
ok("npmDeps: flags an npm specifier by name", npmDeps(DEP).join(",") === "lodash");
ok("hasSelftestTail: true when tail line + exit are present", hasSelftestTail(GOOD));
ok("hasSelftestTail: false when the tail line is missing", !hasSelftestTail('#!/usr/bin/env node\nprocess.exit(0)\n'));

// ── scan: every standards-as-code gate obeys the contract ────────────────────────
const stdDir = join(ROOT, "standards");
const gates = readdirSync(stdDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(stdDir, e.name, "validate.mjs")))
  .map((e) => e.name);
ok("scan: discovery found the standards-as-code gates", gates.length >= 6, `found ${gates.length}`);

const badShebang = [], badDeps = [], badTail = [], noReadme = [];
for (const g of gates) {
  const src = readFileSync(join(stdDir, g, "validate.mjs"), "utf8");
  if (!hasShebang(src)) badShebang.push(g);
  const deps = npmDeps(src); if (deps.length) badDeps.push(`${g}: ${deps.join(",")}`);
  if (!hasSelftestTail(src)) badTail.push(g);
  if (!existsSync(join(stdDir, g, "README.md"))) noReadme.push(g);
}
ok("shape: every gate opens with the node shebang", badShebang.length === 0, badShebang.join(", "));
ok("shape: every gate imports only node: builtins or relative paths (zero npm deps)", badDeps.length === 0, badDeps.join(" | "));
ok("shape: every gate prints the parseable selftest tail and exits non-zero on failure", badTail.length === 0, badTail.join(", "));
ok("shape: every gate ships a sibling README.md", noReadme.length === 0, noReadme.join(", "));

for (const f of ["validate.mjs", "README.md"]) ok(`file present: ${f}`, existsSync(join(__dirname, f)));

const failed = checks.filter((c) => !c.pass);
for (const c of checks) if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`standard-shape: ${checks.length - failed.length}/${checks.length} selftest checks passed`);
process.exit(failed.length ? 1 : 0);
