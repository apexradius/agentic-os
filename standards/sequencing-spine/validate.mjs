#!/usr/bin/env node
// validate.mjs — the sequencing-spine selftest, run bare by the framework harness
// (`validate.mjs --all`). Given a manifest file as an argument it instead checks that
// manifest's declared node classes against the ordering rule table in `rules.json`.
//
// This gate composes ON the orchestration-manifest gate, it does not fork it: the manifest
// gate proves shape (owners, deps, no cycles); this gate proves the ordering of the classes
// the planner declared. It never imports orchestration-manifest's validate.mjs (each gate is
// its own layer under --all), and it never re-validates shape — a real manifest passes
// both gates independently under `--all`. A node's optional `class` field is tolerated by the
// manifest gate (which is required-present, not strict).

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function hasText(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function loadRules() {
  return JSON.parse(readFileSync(join(__dirname, 'rules.json'), 'utf8'));
}

// Transitive ancestor set for every node id, computed from depends_on edges. Cycle-safe:
// a back-edge is skipped rather than followed (a cyclic manifest is the manifest gate's to
// flag; this walk must not hang on it). Unknown deps are ignored for the same reason.
function ancestorMap(nodes) {
  const deps = new Map();
  for (const n of nodes) deps.set(n.id, Array.isArray(n.depends_on) ? n.depends_on : []);
  const memo = new Map();
  function ancestors(id, stack) {
    if (memo.has(id)) return memo.get(id);
    const acc = new Set();
    if (stack.has(id)) return acc;
    stack.add(id);
    for (const dep of deps.get(id) || []) {
      if (!deps.has(dep)) continue;
      acc.add(dep);
      for (const a of ancestors(dep, stack)) acc.add(a);
    }
    stack.delete(id);
    memo.set(id, acc);
    return acc;
  }
  const out = new Map();
  for (const n of nodes) out.set(n.id, ancestors(n.id, new Set()));
  return out;
}

// Ordering check (A1 semantics): for each rule (before B -> after A), and only when the
// manifest declares at least one B-classed node, every A-classed node must have AT LEAST ONE
// B-classed ancestor. "At least one" — not "every" — so parallel lanes (each carrying its own
// B->A chain) pass. Zero B-classed nodes leaves the rule unconstrained: the prerequisite may
// already stand outside the plan, so its EXISTENCE is planning judgment, not ordering shape.
export function checkSpine(manifest, rules) {
  if (!isObject(manifest)) return ['manifest is not an object'];
  if (!Array.isArray(rules)) return ['rules table is not an array'];
  const nodes = Array.isArray(manifest.nodes)
    ? manifest.nodes.filter((n) => isObject(n) && hasText(n.id))
    : [];
  if (nodes.length === 0) return [];

  const byClass = new Map();
  for (const n of nodes) {
    if (!hasText(n.class)) continue;
    if (!byClass.has(n.class)) byClass.set(n.class, []);
    byClass.get(n.class).push(n.id);
  }

  const anc = ancestorMap(nodes);
  const errors = [];
  for (const rule of rules) {
    if (!isObject(rule) || !hasText(rule.before) || !hasText(rule.after)) continue;
    const beforeIds = byClass.get(rule.before) || [];
    if (beforeIds.length === 0) continue;
    for (const afterId of byClass.get(rule.after) || []) {
      const ancestors = anc.get(afterId) || new Set();
      if (!beforeIds.some((b) => ancestors.has(b))) {
        errors.push(
          `ordering: node '${afterId}' (class '${rule.after}') needs at least one '${rule.before}' ancestor (rule: ${rule.before} before ${rule.after})`,
        );
      }
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// selftest
// ---------------------------------------------------------------------------
const checks = [];
const ok = (name, cond, detail = '') => {
  checks.push({ name, pass: !!cond, detail });
  return !!cond;
};

const RULES = loadRules();
const node = (id, cls, deps) => {
  const n = {
    id,
    owner: 'role/executor',
    depends_on: deps || [],
    files_owned: [`work/${id}.txt`],
    validation_command: 'true',
    output_artifact: `out/${id}`,
    resume_key: id,
  };
  if (cls !== undefined) n.class = cls;
  return n;
};

// RED 1 (canonical): a dep-upgrade with a test-signal present elsewhere in the DAG but not on
// its own ancestor path. This is the plan's canonical red — deps upgraded before test signal.
const redCanonical = {
  id: 'm-red-1',
  nodes: [
    node('ts', 'test-signal', []),
    node('base', 'edit', []),
    node('up', 'dep-upgrade', ['base']),
  ],
};
ok(
  'RED canonical: dep-upgrade with a test-signal declared elsewhere but not on its path is flagged',
  checkSpine(redCanonical, RULES).some((e) => /'up'.*test-signal/.test(e)),
);

// RED 2: dep-upgrade lacking a lockfile ancestor (test-signal ancestor present, isolates lockfile).
const red2 = {
  id: 'm-red-2',
  nodes: [
    node('lock', 'lockfile', []),
    node('ts', 'test-signal', []),
    node('up', 'dep-upgrade', ['ts']),
  ],
};
ok(
  'RED: dep-upgrade with no lockfile ancestor is flagged',
  checkSpine(red2, RULES).some((e) => /'up'.*lockfile/.test(e)),
);

// RED 3: publish lacking a de-bloat ancestor.
const red3 = { id: 'm-red-3', nodes: [node('db', 'de-bloat', []), node('pub', 'publish', [])] };
ok(
  'RED: publish with no de-bloat ancestor is flagged',
  checkSpine(red3, RULES).some((e) => /'pub'.*de-bloat/.test(e)),
);

// RED 4: baseline lacking a pin ancestor.
const red4 = { id: 'm-red-4', nodes: [node('pin', 'pin', []), node('bl', 'baseline', [])] };
ok(
  'RED: baseline with no pin ancestor is flagged',
  checkSpine(red4, RULES).some((e) => /'bl'.*pin/.test(e)),
);

// RED 5: edit lacking a sync ancestor.
const red5 = { id: 'm-red-5', nodes: [node('s', 'sync', []), node('e', 'edit', [])] };
ok(
  'RED: edit with no sync ancestor is flagged',
  checkSpine(red5, RULES).some((e) => /'e'.*sync/.test(e)),
);

// RED 6: gate-add lacking a cascade ancestor.
const red6 = { id: 'm-red-6', nodes: [node('c', 'cascade', []), node('g', 'gate-add', [])] };
ok(
  'RED: gate-add with no cascade ancestor is flagged',
  checkSpine(red6, RULES).some((e) => /'g'.*cascade/.test(e)),
);

// RED 7: reversed edge — test-signal is a DESCENDANT of the dep-upgrade, so no test-signal
// ancestor exists. Flagged under A1 the same as any missing prerequisite.
const red7 = {
  id: 'm-red-7',
  nodes: [node('up', 'dep-upgrade', []), node('ts', 'test-signal', ['up'])],
};
ok(
  'RED: reversed edge (test-signal below dep-upgrade) still flags the dep-upgrade',
  checkSpine(red7, RULES).some((e) => /'up'.*test-signal/.test(e)),
);

// GREEN discriminator (A1): two independent lanes, each with its own test-signal -> dep-upgrade
// chain. GREEN under A1 (each dep-upgrade has its own test-signal ancestor); this is exactly the
// case the naive "every A needs every B" quantifier would have false-flagged.
const greenParallel = {
  id: 'm-green-parallel',
  nodes: [
    node('ts1', 'test-signal', []),
    node('up1', 'dep-upgrade', ['ts1']),
    node('ts2', 'test-signal', []),
    node('up2', 'dep-upgrade', ['ts2']),
  ],
};
ok(
  'GREEN A1 discriminator: parallel B->A lanes pass (each A has its own B ancestor)',
  checkSpine(greenParallel, RULES).length === 0,
);

// GREEN full spine: one manifest exercising all seven rules cleanly (mirrors example-manifest.json).
const greenFull = {
  id: 'm-green-full',
  nodes: [
    node('sync', 'sync', []),
    node('edit', 'edit', ['sync']),
    node('casc', 'cascade', ['edit']),
    node('gate', 'gate-add', ['casc']),
    node('pin', 'pin', ['edit']),
    node('base', 'baseline', ['pin']),
    node('lock', 'lockfile', ['edit']),
    node('ts', 'test-signal', ['lock']),
    node('up', 'dep-upgrade', ['lock', 'ts']),
    node('db', 'de-bloat', ['edit']),
    node('pub', 'publish', ['casc', 'gate', 'base', 'db', 'up']),
  ],
};
ok('GREEN: full seven-rule spine passes clean', checkSpine(greenFull, RULES).length === 0);

// GREEN undeclared: nodes with no declared class are unconstrained.
const greenUndeclared = {
  id: 'm-green-undeclared',
  nodes: [node('x', undefined, []), node('y', undefined, ['x'])],
};
ok(
  'GREEN: nodes with no declared class are unconstrained',
  checkSpine(greenUndeclared, RULES).length === 0,
);

// GREEN vacuous: an after-class node present but its before-class absent -> rule unconstrained.
const greenVacuous = { id: 'm-green-vacuous', nodes: [node('up', 'dep-upgrade', [])] };
ok(
  'GREEN: after-class present but before-class absent is unconstrained',
  checkSpine(greenVacuous, RULES).length === 0,
);

// Rule table is data: seven well-formed rows.
ok(
  'rules.json is a non-empty array of seven {before, after, why} rows',
  Array.isArray(RULES) &&
    RULES.length === 7 &&
    RULES.every((r) => hasText(r.before) && hasText(r.after) && hasText(r.why)),
);

ok('file present: validate.mjs', existsSync(join(__dirname, 'validate.mjs')));
ok('file present: rules.json', existsSync(join(__dirname, 'rules.json')));
ok('file present: README.md', existsSync(join(__dirname, 'README.md')));
ok('file present: example-manifest.json', existsSync(join(__dirname, 'example-manifest.json')));

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const rawArgs = process.argv.slice(2);
const args = rawArgs.filter((a) => !a.startsWith('--'));

if (args.length > 0) {
  let failed = false;
  for (const file of args) {
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      console.error(`sequencing-spine: cannot read ${file}: ${err.message}`);
      failed = true;
      continue;
    }
    const errs = checkSpine(manifest, RULES);
    if (errs.length) {
      failed = true;
      console.error(`sequencing-spine: ${file} FAILED`);
      for (const e of errs) console.error(`  - ${e}`);
    } else {
      console.log(`sequencing-spine: ${file} OK`);
    }
  }
  process.exit(failed ? 1 : 0);
}

const failedChecks = checks.filter((c) => !c.pass);
for (const c of checks) {
  console.log(`${c.pass ? 'ok' : 'FAIL'} - ${c.name}${c.detail ? ` (${c.detail})` : ''}`);
}
console.log(
  `sequencing-spine: ${checks.length - failedChecks.length}/${checks.length} selftest checks passed`,
);
process.exit(failedChecks.length ? 1 : 0);
