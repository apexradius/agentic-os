#!/usr/bin/env node
// validate.mjs — the skill-ref-integrity standard, run bare or by `validate.mjs --all`. Discovered
// automatically by the runner (creating this file wires it into --all; no runner edit needed).
//
// What it guards: an agent's `skills:` frontmatter names a skill by exact string. No other gate proves
// those names resolve — the capability index renders agents WITHOUT their skills, mirror-parity ignores
// skills, and the agent emitter happily emits a dead name. So a collapse/retire that misses one agent
// line degrades that agent SILENTLY: it still dispatches, the promised capability just never loads. This
// gate makes that failure loud. Every `skills:` entry across the canonical agent set must resolve to a
// live skill directory OR an alias-registry key. A miss fails the build with file:line + the dead name.
//
// Scanning canonical agents (framework/roles + apex/agents) is sufficient: the agent emitter's own
// --check gate already guarantees the emitted runtime mirrors equal the canonical source byte-for-byte.
//
// Zero npm dependencies (node: builtins only), so it runs on a bare extraction with no install.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..', '..', '..'); // framework/standards/skill-ref-integrity -> repo root

// ── pure helpers (selftested below) ──────────────────────────────────────────────
/** Extract the `skills:` YAML list from a doc's frontmatter. Zero-dep line scan (list items only) —
 *  no `yaml` import, so the gate stays runnable on a bare extraction. Returns [{ name, line }]. */
export function parseSkillsList(raw) {
  const lines = String(raw).split(/\r?\n/);
  if (!/^---\s*$/.test(lines[0] ?? '')) return [];
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (/^---\s*$/.test(lines[i])) {
      close = i;
      break;
    }
  }
  if (close < 0) return [];
  const out = [];
  let inSkills = false;
  for (let i = 1; i < close; i++) {
    if (/^skills:\s*$/.test(lines[i])) {
      inSkills = true;
      continue;
    }
    if (inSkills) {
      const m = lines[i].match(/^\s+-\s*(\S+)\s*$/);
      if (m)
        out.push({ name: m[1], line: i + 1 }); // 1-based file line
      else if (/^\S/.test(lines[i])) inSkills = false; // a dedented key ends the list
    }
  }
  return out;
}
/** True iff a skill ref resolves — a live skill directory name or an alias-registry key. */
export function resolves(ref, liveSet, aliasSet) {
  return liveSet.has(ref) || aliasSet.has(ref);
}
/** Alias keys that collide with a live skill dir. A name that is BOTH an alias (redirect) and a real
 *  skill dir is the repo-side precondition for a runtime shadow: the sync stages a stub AND the real
 *  skill under one name, so the collapsed name resolves to a live body instead of the router redirect.
 *  Keeping this set empty is what makes the F4 shadow class impossible to reintroduce from the repo. */
export function aliasCollisions(aliasSet, liveSet) {
  return [...aliasSet].filter((k) => liveSet.has(k));
}

// ── live sources ─────────────────────────────────────────────────────────────────
function skillDirNames(absDir) {
  if (!existsSync(absDir)) return [];
  return readdirSync(absDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(absDir, e.name, 'SKILL.md')))
    .map((e) => e.name);
}
function aliasKeys(absPath) {
  if (!existsSync(absPath)) return [];
  try {
    return Object.keys(JSON.parse(readFileSync(absPath, 'utf8')));
  } catch {
    return [];
  }
}
function agentFiles(absDir) {
  if (!existsSync(absDir)) return [];
  return readdirSync(absDir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .map((f) => join(absDir, f));
}

// ── selftest: RED/GREEN on inline fixtures ────────────────────────────────────────
const checks = [];
const ok = (name, cond, detail = '') => {
  checks.push({ name, pass: !!cond, detail });
  return !!cond;
};
{
  const live = new Set(['audit', 'research']);
  const alias = new Set(['web-audit']);
  const green =
    '---\nname: g\nskills:\n  - audit\n  - web-audit\ndisallowedTools: Edit\n---\nbody\n';
  const red = '---\nname: r\nskills:\n  - does-not-exist\n---\nbody\n';
  const gList = parseSkillsList(green);
  const rList = parseSkillsList(red);
  ok(
    'parseSkillsList: reads list items and stops at the next key',
    gList.length === 2 && gList[0].name === 'audit',
  );
  ok(
    'parseSkillsList: no skills key yields empty',
    parseSkillsList('---\nname: z\n---\nbody\n').length === 0,
  );
  ok('resolves: a live dir resolves', resolves('audit', live, alias));
  ok('resolves: an alias key resolves', resolves('web-audit', live, alias));
  ok('resolves: an unknown ref fails (RED)', !resolves('does-not-exist', live, alias));
  ok(
    'selftest RED fixture surfaces its unresolved ref',
    rList.some((s) => !resolves(s.name, live, alias)),
  );
  ok(
    'selftest GREEN fixture fully resolves',
    gList.length > 0 && gList.every((s) => resolves(s.name, live, alias)),
  );
  // F5b: an alias key that is also a live skill dir is a shadow-in-waiting; disjoint sets are clean.
  ok(
    'F5b: alias key shadowing a live skill dir is caught (RED)',
    aliasCollisions(new Set(['ship']), new Set(['audit', 'ship'])).length === 1,
  );
  ok(
    'F5b: disjoint alias/skill sets report no collision (GREEN)',
    aliasCollisions(new Set(['ship']), new Set(['audit', 'release'])).length === 0,
  );
}

// ── live scan: every canonical agent skills: ref must resolve ─────────────────────
const liveSet = new Set([
  ...skillDirNames(join(REPO, 'framework', 'skills')),
  ...skillDirNames(join(REPO, 'apex', 'skills')),
]);
const aliasSet = new Set(aliasKeys(join(REPO, 'apex', 'skills', '.aliases.json')));
const files = [
  ...agentFiles(join(REPO, 'framework', 'roles')),
  ...agentFiles(join(REPO, 'apex', 'agents')),
];
const unresolved = [];
for (const file of files) {
  for (const s of parseSkillsList(readFileSync(file, 'utf8'))) {
    if (!resolves(s.name, liveSet, aliasSet)) {
      unresolved.push(
        `${file.replace(REPO + '/', '')}:${s.line}: unresolved skill ref '${s.name}'`,
      );
    }
  }
}
ok(
  `live scan: every agent skills: ref resolves (${liveSet.size} skill dirs, ${aliasSet.size} aliases, ${files.length} agents)`,
  unresolved.length === 0,
  unresolved.length ? `${unresolved.length} dead ref(s)` : '',
);

// F5b live scan: no alias key may shadow a live skill dir (repo-side guard against the F4 shadow class).
const collisions = aliasCollisions(aliasSet, liveSet);
ok(
  `no alias key shadows a live skill dir (${aliasSet.size} aliases vs ${liveSet.size} skill dirs)`,
  collisions.length === 0,
  collisions.length ? `collisions: ${collisions.join(', ')}` : '',
);

// ── report ───────────────────────────────────────────────────────────────────────
if (unresolved.length) {
  console.log(
    'skill-ref-integrity — dead agent skill refs (repoint to a live skill or add an alias):',
  );
  for (const u of unresolved) console.log('  ' + u);
}
if (collisions.length) {
  console.log(
    'skill-ref-integrity — alias keys shadowing a live skill dir (a runtime shadow waiting to happen):',
  );
  for (const c of collisions)
    console.log(
      `  '${c}' is both an alias key and a live skill dir — rename the skill or retire the alias`,
    );
}
const failed = checks.filter((c) => !c.pass);
for (const c of failed)
  if (!/live scan/.test(c.name))
    console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ''}`);
console.log(
  `skill-ref-integrity: ${checks.length - failed.length}/${checks.length} selftest checks passed`,
);
process.exit(failed.length ? 1 : 0);
