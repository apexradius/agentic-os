#!/usr/bin/env node
// framework/primitives/mcp/validate.mjs — convention-lint an MCP server directory.
//
//   node validate.mjs <server-dir> ...   lint a server package directory
//   node validate.mjs --selftest         prove the linter against temp good/bad layouts
//   node validate.mjs                     (no in-repo sources) run selftest only
//
// HONEST SCOPE (see spec.md): this is a CONVENTION LINTER, not a schema validator. An MCP
// server is a TypeScript package, so there is no frontmatter to ajv. It checks:
//   ERROR   — package.json present + valid + has a name; an entry file (src/index.ts) exists
//   WARN    — depends on the shared factory (@framework/mcp-shared) + the MCP SDK; a tools/ dir exists;
//             system_health / registerHealthTool is present; every server.tool() name is snake_case
// It does NOT validate zod input schemas, tool handlers, or runtime behavior.

import { existsSync, readFileSync, readdirSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

import { compileSchema, formatErrors } from "../_lib/schema.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..", "..");

const schema = JSON.parse(readFileSync(join(__dirname, "mcp.schema.json"), "utf8"));
const validatePackageJson = compileSchema(schema);

// The shared factory now lives in this repo (framework/runtime/mcp-shared, published as
// @framework/mcp-shared), so that is the generic default. An org running its own factory under a
// different package id (a fork under its own scope) overrides it via APEX_MCP_SHARED_FACTORY —
// no code edit. The MCP SDK name is the standard, not coupling.
const SHARED_FACTORY = process.env.APEX_MCP_SHARED_FACTORY || "@framework/mcp-shared";
const MCP_SDK = "@modelcontextprotocol/sdk";

// Read every .ts under a server's source root (src/ if present, else the dir), shallowly
// recursive, skipping node_modules/dist. Concatenated for convention greps.
function readSource(dir) {
  const root = existsSync(join(dir, "src")) ? join(dir, "src") : dir;
  let out = "";
  const walk = (d, depth) => {
    if (depth > 4) return;
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name === "dist") continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (e.name.endsWith(".ts") || e.name.endsWith(".js")) {
        try { out += readFileSync(p, "utf8") + "\n"; } catch { /* skip unreadable */ }
      }
    }
  };
  walk(root, 0);
  return out;
}

// Core check on a server directory — used by file validation and the inline selftest.
export function checkServerDir(dir) {
  const errors = [];
  const warnings = [];

  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return { errors: [`not a directory: ${dir}`], warnings };
  }

  // ── package.json (the one schema-checkable artifact) ──
  const pkgPath = join(dir, "package.json");
  let pkg = null;
  if (!existsSync(pkgPath)) {
    errors.push("no package.json");
  } else {
    try {
      pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    } catch (e) {
      errors.push(`package.json is invalid JSON: ${e.message}`);
    }
    if (pkg && !validatePackageJson(pkg)) {
      for (const line of formatErrors(validatePackageJson.errors)) errors.push(`package.json ${line}`);
    }
    if (pkg) {
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (!deps[SHARED_FACTORY]) warnings.push(`does not depend on ${SHARED_FACTORY} (the shared createApexServer factory)`);
      if (!deps[MCP_SDK]) warnings.push(`does not depend on ${MCP_SDK}`);
      if (pkg.type !== "module") warnings.push("package.json 'type' is not 'module' (Apex servers are ESM)");
    }
  }

  // ── entry file (required) ──
  const entry = ["src/index.ts", "index.ts", "src/index.js", "index.js"].find((f) => existsSync(join(dir, f)));
  if (!entry) errors.push("no entry file (expected src/index.ts)");

  // ── tools/ directory (Apex convention) ──
  const toolsDir = ["src/tools", "tools"].find((d) => existsSync(join(dir, d)) && statSync(join(dir, d)).isDirectory());
  if (!toolsDir) {
    warnings.push("no tools/ directory (Apex convention: index.ts registers register*Tools from tools/*.ts)");
  }

  // ── source-level conventions ──
  const src = readSource(dir);
  if (src) {
    if (!/system_health|registerHealthTool/.test(src)) {
      warnings.push("no system_health / registerHealthTool found (every Apex server should expose system_health)");
    }
    // \s in JS regex spans newlines, so this catches the multi-line `server.tool(\n "name",` form.
    const names = [...src.matchAll(/\.tool\(\s*["']([^"']+)["']/g)].map((m) => m[1]);
    for (const n of names) {
      if (!/^[a-z0-9_]+$/.test(n)) warnings.push(`tool name '${n}' is not snake_case`);
    }
  }

  return { errors, warnings };
}

export function validateServerDir(dir) {
  const { errors, warnings } = checkServerDir(dir);
  return { path: dir, errors, warnings };
}

// ── Selftest: build temp good/bad server layouts and prove the linter's verdicts ──
function runSelftest() {
  let work;
  const checks = [];
  const ok = (name, cond) => { checks.push({ name, pass: !!cond }); };

  const mkServer = (name, { pkg, index = true, tools = true, health = true, badToolName = false } = {}) => {
    const d = join(work, name);
    mkdirSync(join(d, "src", "tools"), { recursive: true });
    if (pkg !== null) writeFileSync(join(d, "package.json"), JSON.stringify(pkg ?? defaultPkg(name)));
    if (index) writeFileSync(join(d, "src", "index.ts"), indexSrc(health));
    if (tools) writeFileSync(join(d, "src", "tools", "demo.ts"), toolSrc(badToolName));
    return d;
  };
  const defaultPkg = (name) => ({
    name: `@framework/${name}`,
    type: "module",
    dependencies: { [SHARED_FACTORY]: "*", [MCP_SDK]: "*" },
  });
  const indexSrc = (health) =>
    `import { createApexServer${health ? ", registerHealthTool" : ""} } from "${SHARED_FACTORY}";\n` +
    `const { server } = createApexServer({ version: "1.0.0" });\n` +
    (health ? `registerHealthTool(server, {});\n` : "");
  const toolSrc = (bad) =>
    `export function registerDemoTools(server) {\n  server.tool(\n    "${bad ? "BadToolName" : "good_tool_name"}",\n    "desc",\n    {},\n    async () => ({}),\n  );\n}\n`;

  try {
    work = mkdtempSync(join(tmpdir(), "apex-mcp-selftest-"));

    ok("accepts a well-formed server", checkServerDir(mkServer("apex-good-mcp")).errors.length === 0);

    const noPkg = mkServer("apex-nopkg-mcp", { pkg: null });
    ok("rejects a server with no package.json", checkServerDir(noPkg).errors.some((e) => /package\.json/.test(e)));

    const noEntry = join(work, "apex-noentry-mcp");
    mkdirSync(join(noEntry, "src", "tools"), { recursive: true });
    writeFileSync(join(noEntry, "package.json"), JSON.stringify(defaultPkg("apex-noentry-mcp")));
    ok("rejects a server with no entry file", checkServerDir(noEntry).errors.some((e) => /entry file/.test(e)));

    const noHealth = checkServerDir(mkServer("apex-nohealth-mcp", { health: false }));
    ok("warns when system_health is missing", noHealth.errors.length === 0 && noHealth.warnings.some((w) => /system_health/.test(w)));

    const badName = checkServerDir(mkServer("apex-badname-mcp", { badToolName: true }));
    ok("warns on a non-snake_case tool name", badName.warnings.some((w) => /not snake_case/.test(w)));

    const noShared = mkServer("apex-noshared-mcp", { pkg: { name: "x", type: "module", dependencies: {} } });
    ok("warns when the shared factory dependency is absent", checkServerDir(noShared).warnings.some((w) => /mcp-shared/.test(w)));
  } finally {
    if (work) { try { rmSync(work, { recursive: true, force: true }); } catch { /* best effort */ } }
  }

  let pass = 0;
  for (const c of checks) { if (c.pass) pass++; console.log(`  ${c.pass ? "ok  " : "FAIL"} ${c.name}`); }
  console.log(`\nmcp selftest: ${pass}/${checks.length} passed`);
  return pass === checks.length;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith("validate.mjs")) {
  const args = process.argv.slice(2);

  if (args.includes("--selftest")) {
    process.exit(runSelftest() ? 0 : 1);
  }

  const targets = args.filter((a) => !a.startsWith("--"));
  let failed = 0;
  let warned = 0;
  for (const t of targets) {
    const { errors, warnings } = validateServerDir(t);
    const rel = t.startsWith(REPO + "/") ? t.slice(REPO.length + 1) : t;
    const label = basename(t);
    if (errors.length) {
      failed++;
      console.log(`  FAIL ${label}  (${rel})`);
      for (const e of errors) console.log(`       ✗ ${e}`);
    } else if (warnings.length) {
      warned++;
      console.log(`  warn ${label}  (${rel})`);
      for (const w of warnings) console.log(`       ! ${w}`);
    } else {
      console.log(`  ok   ${label}`);
    }
  }
  if (targets.length) {
    console.log(`\nmcp: ${targets.length - failed}/${targets.length} valid${warned ? `, ${warned} with warnings` : ""}`);
  }

  let selftestOk = true;
  if (targets.length === 0) {
    selftestOk = runSelftest();
  }
  process.exit(failed || !selftestOk ? 1 : 0);
}
