#!/usr/bin/env node
// emit.mjs — the agent single-source pipeline.
//
//   node emit.mjs            (re)generate the runtime interfaces from canonical .md
//   node emit.mjs --check    fail if committed interfaces drift from canonical (CI gate)
//
// Canonical source:  framework/roles/<name>.md   (generic, zero Apex coupling)
//                    apex/agents/<name>.md        (Apex instance)
// Emitted (committed, loadable on clone):
//                    .claude/agents/<name>.md     copy of canonical (Claude loads .md)
//                    .codex/agents/<name>.toml    projection: name+description+body
//
// The Codex projection is intentionally lossy — see framework/primitives/agents/spec.md.

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

import { parseFrontmatter } from "./frontmatter.mjs";
import { emitAgentToml } from "./emit-toml.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO = join(__dirname, "..", "..", "..");

const SOURCE_DIRS = [join(REPO, "framework", "roles"), join(REPO, "apex", "agents")];
const OUT_CLAUDE = join(REPO, ".claude", "agents");
const OUT_CODEX = join(REPO, ".codex", "agents");

function listAgentMd(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort()
    .map((f) => join(dir, f));
}

/** Build the emitted content for every canonical agent. Throws on structural errors. */
export function buildAll() {
  const agents = [];
  const seen = new Map();
  for (const dir of SOURCE_DIRS) {
    for (const path of listAgentMd(dir)) {
      const raw = readFileSync(path, "utf8");
      const { data, body } = parseFrontmatter(raw);
      const stem = basename(path, ".md");
      const name = data.name;
      if (!name) throw new Error(`${rel(path)}: frontmatter is missing 'name'`);
      if (name !== stem) throw new Error(`${rel(path)}: frontmatter name '${name}' != filename stem '${stem}'`);
      if (seen.has(name)) throw new Error(`duplicate agent '${name}': ${rel(seen.get(name))} and ${rel(path)}`);
      seen.set(name, path);

      const claudeOut = raw.replace(/\n*$/, "\n"); // exactly one trailing newline
      const codexOut = emitAgentToml({ name, description: data.description ?? "", body });
      agents.push({ name, sourcePath: path, claudeOut, codexOut });
    }
  }
  return agents;
}

/** Compare committed interfaces to freshly built output. Returns a list of drift lines. */
export function check(agents = buildAll()) {
  const drift = [];
  const names = new Set(agents.map((a) => a.name));

  for (const a of agents) {
    compare(join(OUT_CLAUDE, `${a.name}.md`), a.claudeOut, drift);
    compare(join(OUT_CODEX, `${a.name}.toml`), a.codexOut, drift);
  }
  // Orphans: emitted files with no canonical source.
  for (const [dir, ext] of [[OUT_CLAUDE, ".md"], [OUT_CODEX, ".toml"]]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(ext) || f === "README.md") continue;
      if (!names.has(basename(f, ext))) drift.push(`orphan    ${rel(join(dir, f))} (no canonical source)`);
    }
  }
  return drift;
}

function compare(path, expected, drift) {
  if (!existsSync(path)) drift.push(`missing   ${rel(path)}`);
  else if (readFileSync(path, "utf8") !== expected) drift.push(`drift     ${rel(path)}`);
}

function write(agents) {
  mkdirSync(OUT_CLAUDE, { recursive: true });
  mkdirSync(OUT_CODEX, { recursive: true });
  for (const a of agents) {
    writeFileSync(join(OUT_CLAUDE, `${a.name}.md`), a.claudeOut);
    writeFileSync(join(OUT_CODEX, `${a.name}.toml`), a.codexOut);
  }
}

function rel(p) {
  return p.startsWith(REPO + "/") ? p.slice(REPO.length + 1) : p;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith("emit.mjs")) {
  const isCheck = process.argv.slice(2).includes("--check");
  try {
    const agents = buildAll();
    if (isCheck) {
      const drift = check(agents);
      if (drift.length) {
        console.error(`emit --check: DRIFT (${drift.length})\n` + drift.map((d) => "  " + d).join("\n"));
        process.exit(1);
      }
      console.log(`emit --check: clean — ${agents.length} agents, interfaces match canonical`);
    } else {
      write(agents);
      console.log(`emit: wrote ${agents.length} agents -> .claude/agents/*.md + .codex/agents/*.toml`);
    }
  } catch (e) {
    console.error("emit: " + e.message);
    process.exit(1);
  }
}
