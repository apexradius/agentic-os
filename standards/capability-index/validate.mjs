#!/usr/bin/env node
// validate.mjs — the capability-index standard, run bare or by `validate.mjs --all`. Enforces
// doctrine/standards/capability-index.md: the committed CAPABILITIES.md catalog is a faithful,
// drift-free render of the live capability tree (skills + agents + MCP servers/tools). A catalog
// that can silently drift from reality is worse than none — readers trust it. So this gate
// regenerates the catalog in memory and byte-compares it against the committed file, the same
// anti-drift contract emit.mjs --check enforces for agent interfaces. The pure frontmatter/tool
// readers carry their own RED/GREEN selftest so the gate can't rot.

import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { readScalars, frontmatterBlock, unquote, extractTools, renderCatalog } from "./lib.mjs";
import { build, OUT } from "./generate.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: !!cond, detail }); return !!cond; };

// ── selftest: the pure readers, RED/GREEN on inline fixtures ──────────────────────
const FM = '---\nname: a11y-check\ndescription: "Audit, with: colons"\nuser-invocable: true\nskills:\n  - nested\n---\nbody: not frontmatter\n';
ok("frontmatterBlock: stops at the closing fence", !frontmatterBlock(FM).includes("body: not frontmatter"));
const sc = readScalars(FM, ["name", "description", "user-invocable", "argument-hint"]);
ok("readScalars: reads a plain scalar", sc.name === "a11y-check", sc.name);
ok("readScalars: unquotes and keeps inner colons", sc.description === "Audit, with: colons", sc.description);
ok("readScalars: reads a boolean-ish scalar as text", sc["user-invocable"] === "true");
ok("readScalars: ignores nested list lines", sc["argument-hint"] === undefined);
ok("readScalars: absent key is undefined, not crash", readScalars("no frontmatter here", ["name"]).name === undefined);
const BLK = "---\nname: blk\ndescription: >-\n  line one\n  line two\nmodel: m1\n---\n";
const sb = readScalars(BLK, ["name", "description", "model"]);
ok("readScalars: folds a block scalar (>-) into one line", sb.description === "line one line two", sb.description);
ok("readScalars: reads the scalar key after a block scalar", sb.model === "m1", sb.model);
ok("unquote: strips matching double quotes", unquote('"x"') === "x");
ok("unquote: leaves bare value", unquote("x") === "x");
const tools = extractTools('server.tool("ai_ask", "Send a prompt.", {a:1}); server.tool(\n  "ai_consensus",\n  "Compare models.",\n)');
ok("extractTools: finds multiple registrations", tools.length === 2, `n=${tools.length}`);
ok("extractTools: captures name and description", tools[0].name === "ai_ask" && tools[0].description === "Send a prompt.");
ok("extractTools: handles multi-line registration", tools[1].name === "ai_consensus");
const escTools = extractTools("server.tool('canva_x', 'the user\\'s account.', {})");
ok("extractTools: keeps text after an escaped quote", escTools.length === 1 && escTools[0].description === "the user's account.", JSON.stringify(escTools));
ok("renderCatalog: deterministic for equal input", renderCatalog({ skills: [], agents: [], mcp: [] }) === renderCatalog({ skills: [], agents: [], mcp: [] }));

// ── drift: the committed catalog matches a fresh render of the live tree ──────────
const fresh = build();
if (ok("CAPABILITIES.md exists at the repo root", existsSync(OUT))) {
  const committed = readFileSync(OUT, "utf8");
  ok("CAPABILITIES.md matches the live capability tree (no drift)", committed === fresh,
    committed === fresh ? "" : "stale — run: node framework/standards/capability-index/generate.mjs");
}

for (const f of ["generate.mjs", "lib.mjs", "validate.mjs", "README.md"]) {
  ok(`file present: ${f}`, existsSync(join(__dirname, f)));
}

const failed = checks.filter((c) => !c.pass);
for (const c of checks) if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`capability-index: ${checks.length - failed.length}/${checks.length} selftest checks passed`);
process.exit(failed.length ? 1 : 0);
