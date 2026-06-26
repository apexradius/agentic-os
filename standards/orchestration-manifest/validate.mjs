#!/usr/bin/env node
// validate.mjs — orchestration-manifest standard. It validates the portable
// multi-agent DAG contract: nodes, owners, dependencies, validation commands,
// output artifacts, and resume keys.

import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: !!cond, detail }); return !!cond; };

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function arrayOfText(value) {
  return Array.isArray(value) && value.every(hasText);
}

export function validateManifest(manifest) {
  const errors = [];
  if (!isObject(manifest)) return ["manifest is not an object"];
  if (!hasText(manifest.id)) errors.push("id is required");
  if (!Array.isArray(manifest.nodes) || manifest.nodes.length === 0) {
    errors.push("nodes must be a non-empty array");
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
      errors.push(`cycle detected: ${[...stack, id].join(" -> ")}`);
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

const valid = {
  id: "release-hardening",
  nodes: [
    {
      id: "plan",
      owner: "planner",
      depends_on: [],
      files_owned: ["plan.md"],
      validation_command: "node framework/primitives/_lib/validate.mjs --all",
      output_artifact: "artifacts/plan.md",
      resume_key: "plan",
    },
    {
      id: "verify",
      owner: "verifier",
      depends_on: ["plan"],
      files_owned: [],
      validation_command: "git diff --check",
      output_artifact: "artifacts/verify.md",
      resume_key: "verify",
    },
  ],
};
const missingCommand = {
  id: "missing-command",
  nodes: [
    { id: "build", owner: "builder", output_artifact: "out.md", resume_key: "build" },
  ],
};
const cyclic = {
  id: "cycle",
  nodes: [
    { id: "a", owner: "one", depends_on: ["b"], validation_command: "true", output_artifact: "a.md", resume_key: "a" },
    { id: "b", owner: "two", depends_on: ["a"], validation_command: "true", output_artifact: "b.md", resume_key: "b" },
  ],
};

ok("validateManifest: valid DAG passes", validateManifest(valid).length === 0);
ok("validateManifest: missing validation command fails", validateManifest(missingCommand).some((e) => /validation_command/.test(e)));
ok("validateManifest: cycle fails", validateManifest(cyclic).some((e) => /cycle detected/.test(e)));
ok("file present: validate.mjs", existsSync(join(__dirname, "validate.mjs")));
ok("file present: README.md", existsSync(join(__dirname, "README.md")));

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
let fileFailures = 0;
for (const arg of args) {
  try {
    const parsed = JSON.parse(readFileSync(arg, "utf8"));
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

const failed = checks.filter((c) => !c.pass);
for (const c of failed) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`orchestration-manifest: ${checks.length - failed.length}/${checks.length} selftest checks passed`);
process.exit(failed.length || fileFailures ? 1 : 0);
