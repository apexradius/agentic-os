#!/usr/bin/env node
// validate.mjs — orchestration-manifest standard. It validates the portable
// multi-agent DAG contract: nodes, owners, dependencies, validation commands,
// output artifacts, and resume keys.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const checks = [];
const ok = (name, cond, detail = '') => {
  checks.push({ name, pass: !!cond, detail });
  return !!cond;
};

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function arrayOfText(value) {
  return Array.isArray(value) && value.every(hasText);
}

function nodesInDependencyOrder(manifest) {
  const nodes = manifest.nodes || [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const remaining = new Set(nodes.map((node) => node.id));
  const ordered = [];
  while (remaining.size) {
    let progressed = false;
    for (const node of nodes) {
      if (!remaining.has(node.id)) continue;
      const deps = node.depends_on || [];
      if (deps.every((dep) => byId.has(dep) && !remaining.has(dep))) {
        ordered.push(node);
        remaining.delete(node.id);
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return ordered;
}

function ownershipConflicts(nodes) {
  const owners = new Map();
  for (const node of nodes) {
    for (const file of node.files_owned || []) {
      const list = owners.get(file) || [];
      list.push(node.id);
      owners.set(file, list);
    }
  }
  return [...owners.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([file, nodes]) => ({ file, nodes }));
}

export function validateManifest(manifest) {
  const errors = [];
  if (!isObject(manifest)) return ['manifest is not an object'];
  if (!hasText(manifest.id)) errors.push('id is required');
  if (!Array.isArray(manifest.nodes) || manifest.nodes.length === 0) {
    errors.push('nodes must be a non-empty array');
    return errors;
  }

  const ids = new Set();
  const depsById = new Map();
  manifest.nodes.forEach((node, index) => {
    const where = `nodes[${index}]`;
    if (!isObject(node)) {
      errors.push(`${where} is not an object`);
      return;
    }
    if (!hasText(node.id)) errors.push(`${where}.id is required`);
    if (!hasText(node.owner)) errors.push(`${where}.owner is required`);
    if (!hasText(node.validation_command)) errors.push(`${where}.validation_command is required`);
    if (!hasText(node.output_artifact)) errors.push(`${where}.output_artifact is required`);
    if (!hasText(node.resume_key)) errors.push(`${where}.resume_key is required`);
    if (node.files_owned !== undefined && !arrayOfText(node.files_owned)) {
      errors.push(`${where}.files_owned must be an array of strings`);
    }
    if (node.depends_on !== undefined && !arrayOfText(node.depends_on)) {
      errors.push(`${where}.depends_on must be an array of strings`);
    }
    if (hasText(node.id)) {
      if (ids.has(node.id)) errors.push(`duplicate node id '${node.id}'`);
      ids.add(node.id);
      depsById.set(node.id, node.depends_on || []);
    }
  });

  for (const [id, deps] of depsById) {
    for (const dep of deps) {
      if (!ids.has(dep)) errors.push(`node '${id}' depends on unknown node '${dep}'`);
    }
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(id, stack) {
    if (visited.has(id)) return false;
    if (visiting.has(id)) {
      errors.push(`cycle detected: ${[...stack, id].join(' -> ')}`);
      return true;
    }
    visiting.add(id);
    const deps = depsById.get(id) || [];
    for (const dep of deps) {
      if (ids.has(dep)) visit(dep, [...stack, id]);
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }
  for (const id of ids) visit(id, []);

  return errors;
}

export function dryRunManifest(manifest) {
  const errors = validateManifest(manifest);
  const nodes = Array.isArray(manifest && manifest.nodes) ? manifest.nodes : [];
  const ordered = errors.length ? [] : nodesInDependencyOrder(manifest);
  const conflicts = ownershipConflicts(nodes);
  const blocked = nodes
    .filter((node) => !ordered.some((orderedNode) => orderedNode.id === node.id))
    .map((node) => ({ id: node.id, reason: 'dependency cycle or invalid dependency' }));
  return {
    ok: errors.length === 0 && conflicts.length === 0 && blocked.length === 0,
    errors,
    ordered_nodes: ordered.map((node) => node.id),
    blocked_nodes: blocked,
    ownership_conflicts: conflicts,
    validation_plan: ordered.map((node) => ({
      id: node.id,
      owner: node.owner,
      validation_command: node.validation_command,
      output_artifact: node.output_artifact,
    })),
    resume_keys: ordered.map((node) => ({ id: node.id, resume_key: node.resume_key })),
  };
}

// Selftest + CLI run only when this file is the entrypoint, so importing the exported
// checkers (validateManifest, dryRunManifest) fires no side effects and never exits.
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const valid = {
    id: 'release-hardening',
    nodes: [
      {
        id: 'plan',
        owner: 'planner',
        depends_on: [],
        files_owned: ['plan.md'],
        validation_command: 'node framework/primitives/_lib/validate.mjs --all',
        output_artifact: 'artifacts/plan.md',
        resume_key: 'plan',
      },
      {
        id: 'verify',
        owner: 'verifier',
        depends_on: ['plan'],
        files_owned: [],
        validation_command: 'git diff --check',
        output_artifact: 'artifacts/verify.md',
        resume_key: 'verify',
      },
    ],
  };
  const missingCommand = {
    id: 'missing-command',
    nodes: [{ id: 'build', owner: 'builder', output_artifact: 'out.md', resume_key: 'build' }],
  };
  const cyclic = {
    id: 'cycle',
    nodes: [
      {
        id: 'a',
        owner: 'one',
        depends_on: ['b'],
        validation_command: 'true',
        output_artifact: 'a.md',
        resume_key: 'a',
      },
      {
        id: 'b',
        owner: 'two',
        depends_on: ['a'],
        validation_command: 'true',
        output_artifact: 'b.md',
        resume_key: 'b',
      },
    ],
  };

  ok('validateManifest: valid DAG passes', validateManifest(valid).length === 0);
  ok(
    'validateManifest: missing validation command fails',
    validateManifest(missingCommand).some((e) => /validation_command/.test(e)),
  );
  ok(
    'validateManifest: cycle fails',
    validateManifest(cyclic).some((e) => /cycle detected/.test(e)),
  );
  const dry = dryRunManifest(valid);
  ok(
    'dryRunManifest: valid DAG emits dependency order',
    dry.ok === true && dry.ordered_nodes.join(',') === 'plan,verify',
  );
  ok(
    'dryRunManifest: emits validation plan and resume keys',
    dry.validation_plan.length === 2 && dry.resume_keys[1].resume_key === 'verify',
  );
  const overlap = {
    id: 'overlap',
    nodes: [
      {
        id: 'a',
        owner: 'one',
        files_owned: ['same.md'],
        validation_command: 'true',
        output_artifact: 'a.md',
        resume_key: 'a',
      },
      {
        id: 'b',
        owner: 'two',
        files_owned: ['same.md'],
        validation_command: 'true',
        output_artifact: 'b.md',
        resume_key: 'b',
      },
    ],
  };
  ok(
    'dryRunManifest: overlapping file ownership fails dry-run',
    dryRunManifest(overlap).ownership_conflicts.length === 1 &&
      dryRunManifest(overlap).ok === false,
  );
  ok('file present: validate.mjs', existsSync(join(__dirname, 'validate.mjs')));
  ok('file present: README.md', existsSync(join(__dirname, 'README.md')));

  const rawArgs = process.argv.slice(2);
  const dryRun = rawArgs.includes('--dry-run');
  const args = rawArgs.filter((a) => !a.startsWith('--'));
  let fileFailures = 0;
  for (const arg of args) {
    try {
      const parsed = JSON.parse(readFileSync(arg, 'utf8'));
      if (dryRun) {
        const result = dryRunManifest(parsed);
        console.log(JSON.stringify(result, null, 2));
        if (!result.ok) fileFailures++;
        continue;
      }
      const errors = validateManifest(parsed);
      if (errors.length) {
        fileFailures++;
        console.log(`  FAIL ${arg}`);
        for (const e of errors) console.log(`       x ${e}`);
      } else {
        console.log(`  ok   ${arg}`);
      }
    } catch (e) {
      fileFailures++;
      console.log(`  FAIL ${arg}`);
      console.log(`       x invalid JSON: ${e.message}`);
    }
  }

  if (dryRun && args.length) process.exit(fileFailures ? 1 : 0);

  const failed = checks.filter((c) => !c.pass);
  for (const c of failed) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ''}`);
  console.log(
    `orchestration-manifest: ${checks.length - failed.length}/${checks.length} selftest checks passed`,
  );
  process.exit(failed.length || fileFailures ? 1 : 0);
}
