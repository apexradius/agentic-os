#!/usr/bin/env node
// validate.mjs — the model-tier-routing selftest, run bare by the framework harness
// (`validate.mjs --all`). Given a manifest file as an argument it instead checks that manifest's
// declared node routing (`model_tier`, `effort`) against the generic vocabulary in `routing.json`.
//
// The check is a membership floor, honestly bounded: it rejects a node that pins a raw model name
// (the defect that rots inline model references) or declares an off-ladder effort. It does NOT
// judge whether the chosen tier fits the slice's difficulty — that is behavioral, scored by
// trajectory-eval. Undeclared routing is unconstrained (fail-open), matching sequencing-spine.
// Tiers and effort levels are generic here; the concrete tier->model resolution is instance data.

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

function loadRouting() {
  return JSON.parse(readFileSync(join(__dirname, 'routing.json'), 'utf8'));
}

// Membership check: a declared model_tier must be a generic tier and a declared effort must be on
// the ladder. Undeclared fields are unconstrained.
export function checkRouting(manifest, routing) {
  if (!isObject(manifest)) return ['manifest is not an object'];
  if (!isObject(routing)) return ['routing table is not an object'];
  const tiers = Array.isArray(routing.tiers) ? routing.tiers : [];
  const ladder = Array.isArray(routing.effort_ladder) ? routing.effort_ladder : [];
  const nodes = Array.isArray(manifest.nodes)
    ? manifest.nodes.filter((n) => isObject(n) && hasText(n.id))
    : [];
  const errors = [];
  for (const n of nodes) {
    if (hasText(n.model_tier) && !tiers.includes(n.model_tier)) {
      errors.push(
        `routing: node '${n.id}' declares model_tier '${n.model_tier}', not a generic tier (allowed: ${tiers.join(', ')}) — a plan names a tier, never a model`,
      );
    }
    if (hasText(n.effort) && !ladder.includes(n.effort)) {
      errors.push(
        `routing: node '${n.id}' declares effort '${n.effort}', not on the ladder (allowed: ${ladder.join(', ')})`,
      );
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

const ROUTING = loadRouting();
const node = (id, tier, effort) => {
  const n = {
    id,
    owner: 'role/executor',
    depends_on: [],
    files_owned: [`work/${id}.txt`],
    validation_command: 'true',
    output_artifact: `out/${id}`,
    resume_key: id,
  };
  if (tier !== undefined) n.model_tier = tier;
  if (effort !== undefined) n.effort = effort;
  return n;
};

// RED 1: a raw vendor tier name.
ok(
  "RED: model_tier 'opus' (vendor name) is rejected",
  checkRouting({ id: 'r1', nodes: [node('a', 'opus', 'high')] }, ROUTING).some((e) =>
    /'a'.*model_tier 'opus'/.test(e),
  ),
);

// RED 2: a fully-qualified model ID.
ok(
  "RED: model_tier 'claude-opus-4-8' (model ID) is rejected",
  checkRouting({ id: 'r2', nodes: [node('a', 'claude-opus-4-8', 'high')] }, ROUTING).some((e) =>
    /model_tier 'claude-opus-4-8'/.test(e),
  ),
);

// RED 3: an off-ladder effort.
ok(
  "RED: effort 'turbo' (off-ladder) is rejected",
  checkRouting({ id: 'r3', nodes: [node('a', 'mid', 'turbo')] }, ROUTING).some((e) =>
    /effort 'turbo'/.test(e),
  ),
);

// GREEN 4: a valid tier + effort.
ok(
  "GREEN: model_tier 'strongest' + effort 'high' passes",
  checkRouting({ id: 'g4', nodes: [node('a', 'strongest', 'high')] }, ROUTING).length === 0,
);

// GREEN 5 (fail-open): a node declaring neither is unconstrained.
ok(
  'GREEN: node with no model_tier/effort is unconstrained',
  checkRouting({ id: 'g5', nodes: [node('a', undefined, undefined)] }, ROUTING).length === 0,
);

// GREEN 6: all three tiers with assorted valid efforts.
ok(
  'GREEN: all three tiers with valid efforts pass',
  checkRouting(
    {
      id: 'g6',
      nodes: [node('a', 'fast', 'low'), node('b', 'mid', 'medium'), node('c', 'strongest', 'max')],
    },
    ROUTING,
  ).length === 0,
);

// GREEN 7 (A1 mandate): xhigh is on the five-level ladder — a legitimate declaration must not false-red.
ok(
  "GREEN: effort 'xhigh' passes (five-level ladder, no false red)",
  checkRouting({ id: 'g7', nodes: [node('a', 'strongest', 'xhigh')] }, ROUTING).length === 0,
);

// routing.json shape.
ok(
  'routing.json: tiers is a non-empty array',
  Array.isArray(ROUTING.tiers) && ROUTING.tiers.length > 0,
);
ok(
  'routing.json: effort_ladder is five levels including xhigh',
  Array.isArray(ROUTING.effort_ladder) &&
    ROUTING.effort_ladder.length === 5 &&
    ROUTING.effort_ladder.includes('xhigh'),
);

ok('file present: validate.mjs', existsSync(join(__dirname, 'validate.mjs')));
ok('file present: routing.json', existsSync(join(__dirname, 'routing.json')));
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
      console.error(`model-tier-routing: cannot read ${file}: ${err.message}`);
      failed = true;
      continue;
    }
    const errs = checkRouting(manifest, ROUTING);
    if (errs.length) {
      failed = true;
      console.error(`model-tier-routing: ${file} FAILED`);
      for (const e of errs) console.error(`  - ${e}`);
    } else {
      console.log(`model-tier-routing: ${file} OK`);
    }
  }
  process.exit(failed ? 1 : 0);
}

const failedChecks = checks.filter((c) => !c.pass);
for (const c of checks) {
  console.log(`${c.pass ? 'ok' : 'FAIL'} - ${c.name}${c.detail ? ` (${c.detail})` : ''}`);
}
console.log(
  `model-tier-routing: ${checks.length - failedChecks.length}/${checks.length} selftest checks passed`,
);
process.exit(failedChecks.length ? 1 : 0);
