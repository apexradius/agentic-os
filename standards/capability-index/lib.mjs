// lib.mjs — shared, ZERO-npm-dependency machinery for the capability-index standard.
//
// Both generate.mjs (writes the catalog) and validate.mjs (proves the committed catalog
// matches reality) import this. It walks the four capability sources — skills, agents, and
// MCP servers+tools — reads only the flat scalar frontmatter fields the catalog needs, and
// renders one deterministic markdown document. No `yaml` dependency: the index needs a
// handful of single-line scalars (name/description/model/…), not nested YAML, so a tiny
// hand-rolled reader keeps this gate runnable on a bare extraction with no `npm install`.
//
// Determinism is load-bearing: the validator regenerates in memory and byte-compares against
// the committed file, so the render must depend only on the source tree — never on a clock,
// the environment, or filesystem order (everything is sorted).

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

// ── frontmatter: flat scalars only ───────────────────────────────────────────────
/** The frontmatter block (text between the line-1 `---` fence and the next `---`), or "". */
export function frontmatterBlock(raw) {
  const lines = String(raw).split(/\r?\n/);
  if (!/^---[ \t]*$/.test(lines[0] ?? '')) return '';
  for (let i = 1; i < lines.length; i++) {
    if (/^---[ \t]*$/.test(lines[i])) return lines.slice(1, i).join('\n');
  }
  return '';
}
/** Strip one layer of matching surrounding quotes from a scalar value. */
export function unquote(v) {
  const s = String(v).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}
/** Read requested top-level scalar keys (`key: value`) from a frontmatter block. Inline scalars
 *  are unquoted; YAML block scalars (`>`, `>-`, `|`, `|-`, …) are folded — their more-indented
 *  continuation lines are joined into one line. Nested mappings and list items are ignored —
 *  the index only wants flat scalars. */
export function readScalars(raw, keys) {
  const want = new Set(keys);
  const out = {};
  const lines = frontmatterBlock(raw).split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/^\s/.test(lines[i])) continue; // continuation lines are consumed with their key, below
    const m = lines[i].match(/^([A-Za-z0-9_-]+):\s?(.*)$/);
    if (!m) continue;
    const key = m[1];
    let value;
    if (/^[|>][+-]?\d*\s*$/.test(m[2])) {
      // Block scalar: fold the more-indented lines that follow into a single line.
      const block = [];
      let j = i + 1;
      for (; j < lines.length; j++) {
        if (lines[j].trim() === '') {
          block.push('');
          continue;
        }
        if (!/^\s/.test(lines[j])) break; // a non-indented line ends the block
        block.push(lines[j].replace(/^\s+/, ''));
      }
      i = j - 1;
      value = block.join(' ').replace(/\s+/g, ' ').trim();
    } else {
      value = unquote(m[2]);
    }
    if (want.has(key) && out[key] === undefined) out[key] = value;
  }
  return out;
}

// ── source walkers ───────────────────────────────────────────────────────────────
function listFiles(dir, pred) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(pred)
    .sort()
    .map((f) => join(dir, f));
}
function walkTs(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== 'dist') walkTs(p, acc);
    } else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) acc.push(p);
  }
  return acc;
}

/** Skills from a `<root>/<name>/SKILL.md` corpus, tagged with `zone`. */
function collectSkills(root, zone) {
  const dir = root;
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, 'SKILL.md')))
    .map((e) => {
      const fm = readScalars(readFileSync(join(dir, e.name, 'SKILL.md'), 'utf8'), [
        'name',
        'description',
        'user-invocable',
        'argument-hint',
      ]);
      return {
        zone,
        name: fm.name || e.name,
        description: fm.description || '',
        userInvocable: String(fm['user-invocable']) === 'true',
        argHint: fm['argument-hint'] || '',
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Agents from a `<root>/<name>.md` directory (roles or apex agents), tagged with `zone`. */
function collectAgents(root, zone) {
  return listFiles(root, (f) => f.endsWith('.md') && f !== 'README.md')
    .map((p) => {
      const fm = readScalars(readFileSync(p, 'utf8'), ['name', 'description', 'model']);
      return {
        zone,
        name: fm.name || basename(p, '.md'),
        description: fm.description || '',
        model: fm.model || '',
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Tool registrations statically visible as `server.tool("name", "description", …)`. Best-effort:
 *  programmatically/loop-registered or vendored-proxy tools are not statically visible and are not
 *  counted here — the catalog labels this accordingly. */
export function extractTools(tsSource) {
  const out = [];
  // name then description: each a quoted string (", ', or `) whose body may contain escaped quotes
  // (`\'`). The `(?!\1)` guard matches up to the first UNescaped closing quote, so `user\'s` no
  // longer truncates the description at the apostrophe.
  const re =
    /server\.tool\(\s*(["'`])((?:\\.|(?!\1)[\s\S])*)\1\s*,\s*(["'`])((?:\\.|(?!\3)[\s\S])*)\3/g;
  const unescape = (s) => s.replace(/\\(['"`\\])/g, '$1');
  let m;
  while ((m = re.exec(tsSource))) {
    out.push({ name: unescape(m[2]), description: unescape(m[4]).replace(/\s+/g, ' ').trim() });
  }
  return out;
}

/** MCP servers under a given `<serversRoot>/<name>/` (framework/runtime + apex/runtime are both
 *  scanned) — package.json name+description + statically-detected tools across its TS sources. */
function collectMcp(serversRoot) {
  if (!existsSync(serversRoot)) return [];
  return readdirSync(serversRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(serversRoot, e.name, 'package.json')))
    .map((e) => {
      const dir = join(serversRoot, e.name);
      let pkg = {};
      try {
        pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
      } catch {
        pkg = {};
      }
      const tools = [];
      const seen = new Set();
      for (const ts of walkTs(join(dir, 'src'))) {
        for (const t of extractTools(readFileSync(ts, 'utf8'))) {
          if (!seen.has(t.name)) {
            seen.add(t.name);
            tools.push(t);
          }
        }
      }
      tools.sort((a, b) => a.name.localeCompare(b.name));
      return { dir: e.name, name: pkg.name || e.name, description: pkg.description || '', tools };
    })
    .sort((a, b) => a.dir.localeCompare(b.dir));
}

/** Walk the whole repo and gather every capability source, relative to `repo`. */
export function collectAll(repo) {
  return {
    skills: [
      ...collectSkills(join(repo, 'framework', 'skills'), 'framework'),
      ...collectSkills(join(repo, 'apex', 'skills'), 'apex'),
    ].sort((a, b) => a.name.localeCompare(b.name)),
    agents: [
      ...collectAgents(join(repo, 'framework', 'roles'), 'framework'),
      ...collectAgents(join(repo, 'apex', 'agents'), 'apex'),
    ].sort((a, b) => a.name.localeCompare(b.name)),
    mcp: [
      ...collectMcp(join(repo, 'framework', 'runtime', 'mcp-servers')),
      ...collectMcp(join(repo, 'apex', 'runtime', 'mcp-servers')),
    ].sort((a, b) => a.dir.localeCompare(b.dir)),
  };
}

// ── render ───────────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

/** Render the full catalog as one deterministic markdown document. No timestamps. */
export function renderCatalog(data) {
  const { skills, agents, mcp } = data;
  const toolCount = mcp.reduce((n, s) => n + s.tools.length, 0);
  const L = [];
  L.push('# CAPABILITIES — generated capability index');
  L.push('');
  L.push('> **Generated file — do not edit by hand.** Rebuild with');
  L.push('> `node framework/standards/capability-index/generate.mjs`. The');
  L.push('> `capability-index` standard fails CI if this file drifts from the live sources.');
  L.push('');
  L.push(
    `A single browsable catalog of what this repo can do: **${skills.length} skills**, ` +
      `**${agents.length} agents**, **${mcp.length} MCP servers** (${toolCount} statically-detected tools). ` +
      'Skills and agents are split by zone — `framework` (generic, portable) vs `apex` (this instance).',
  );
  L.push('');

  L.push('## Skills');
  L.push('');
  L.push('| Skill | Zone | Invocable | Description |');
  L.push('|---|---|---|---|');
  for (const s of skills) {
    L.push(
      `| \`${esc(s.name)}\` | ${s.zone} | ${s.userInvocable ? 'yes' : '—'} | ${esc(s.description)} |`,
    );
  }
  L.push('');

  L.push('## Agents');
  L.push('');
  L.push('| Agent | Zone | Model | Description |');
  L.push('|---|---|---|---|');
  for (const a of agents) {
    L.push(
      `| \`${esc(a.name)}\` | ${a.zone} | ${a.model ? `\`${esc(a.model)}\`` : '—'} | ${esc(a.description)} |`,
    );
  }
  L.push('');

  L.push('## MCP servers & tools');
  L.push('');
  L.push(
    'Tool lists are a best-effort static scan of `server.tool(...)` registrations; vendored-proxy ' +
      'or programmatically-registered tools may not appear and are not counted.',
  );
  L.push('');
  for (const s of mcp) {
    L.push(`### \`${esc(s.name)}\``);
    L.push('');
    if (s.description) {
      L.push(esc(s.description));
      L.push('');
    }
    if (s.tools.length) {
      L.push('| Tool | Description |');
      L.push('|---|---|');
      for (const t of s.tools) L.push(`| \`${esc(t.name)}\` | ${esc(t.description)} |`);
    } else {
      L.push('_No tools statically detected (vendored proxy or dynamic registration)._');
    }
    L.push('');
  }
  return L.join('\n').replace(/\n+$/, '\n');
}
