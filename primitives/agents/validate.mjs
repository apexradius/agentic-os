#!/usr/bin/env node
// framework/primitives/agents/validate.mjs — validate canonical agent .md files.
//
//   node validate.mjs                 validate every agent in framework/roles + apex/agents
//   node validate.mjs <file.md> ...   validate specific files
//
// Two layers, honestly separated:
//   1. FRONTMATTER  -> ajv against agents.schema.json (the structured contract)
//   2. BODY         -> code checks the <Agent_Prompt> shape rules (not JSON; ajv can't)
// Plus a ZONE guard: a framework/roles/ agent must carry zero Apex coupling.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

import { parseFrontmatter } from "../_lib/frontmatter.mjs";
import { compileSchema, formatErrors } from "../_lib/schema.mjs";
import { loadCoupling } from "../_lib/zone-coupling.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const NESTED_REPO = join(__dirname, "..", "..", "..");
const EXTRACTED_REPO = join(__dirname, "..", "..");
const REPO = existsSync(join(NESTED_REPO, "framework")) ? NESTED_REPO : EXTRACTED_REPO;
const FRAMEWORK_ROLE_DIRS = [join(REPO, "framework", "roles"), join(REPO, "roles")];
const SOURCE_DIRS = [...FRAMEWORK_ROLE_DIRS, join(REPO, "apex", "agents")];

const schema = JSON.parse(readFileSync(join(__dirname, "agents.schema.json"), "utf8"));
const validateFrontmatter = compileSchema(schema);

// ORG BUSINESS coupling — a generic role must name no host, product, or person. The token list is
// externalized (apex/config/zone-coupling.json "agents" profile); framework/ keeps only a generic
// default. See ../_lib/zone-coupling.mjs (CLEANUP C3).
const COUPLING = loadCoupling("agents");
// RUNTIME coupling — a generic role must name no specific runtime's plugin/command.
// (Bare "Claude"/"Codex" is too broad to flag; these tokens are unambiguous.)
const RUNTIME_COUPLING = /oh-my-(claudecode|codex)|\/team\b/i;

export function validateAgentFile(path) {
  const errors = [];
  const warnings = [];
  const raw = readFileSync(path, "utf8");

  let parsed;
  try {
    parsed = parseFrontmatter(raw);
  } catch (e) {
    return { path, errors: [`frontmatter: ${e.message}`], warnings };
  }
  const { data, body, hasFrontmatter } = parsed;

  if (!hasFrontmatter) errors.push("no frontmatter block");

  if (!validateFrontmatter(data)) {
    for (const line of formatErrors(validateFrontmatter.errors)) errors.push(`frontmatter ${line}`);
  }

  const stem = basename(path, ".md");
  if (data.name && data.name !== stem) errors.push(`name '${data.name}' != filename '${stem}'`);
  if (!data.model) warnings.push("no 'model' — Claude will use the session default");

  checkBody(body, errors);
  checkZone(path, raw, errors);

  return { path, errors, warnings };
}

function checkBody(body, errors) {
  if (!/<Agent_Prompt>[\s\S]*<\/Agent_Prompt>/.test(body)) {
    errors.push("body is not wrapped in <Agent_Prompt>…</Agent_Prompt>");
    return;
  }
  const has = (tag) => new RegExp(`<${tag}>`).test(body);
  if (!has("Role")) errors.push("body missing required <Role>");

  const reasoning = has("Constraints");
  const operating = has("Core_Context") && has("Workflow");
  if (!reasoning && !operating) {
    errors.push("body must satisfy one shape: <Constraints> (reasoning) OR <Core_Context>+<Workflow> (operating)");
  }
  if (body.includes('"""')) errors.push('body contains `"""` — breaks the Codex TOML emit');
}

function checkZone(path, raw, errors) {
  if (FRAMEWORK_ROLE_DIRS.some((dir) => path.includes(`${dir}/`))) {
    const biz = raw.match(COUPLING);
    if (biz) errors.push(`framework/roles must be Apex-free, but body/frontmatter contains '${biz[0]}'`);
    const rt = raw.match(RUNTIME_COUPLING);
    if (rt) errors.push(`framework/roles must be runtime-neutral, but contains '${rt[0]}' — genericize it`);
  }
}

function collectTargets(args) {
  const files = args.filter((a) => !a.startsWith("--"));
  if (files.length) return files;
  const out = [];
  for (const dir of SOURCE_DIRS) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (f.endsWith(".md") && f !== "README.md") out.push(join(dir, f));
    }
  }
  return out.sort();
}

function runtimeContractSelftest() {
  const base = {
    name: "runtime-contract-fixture",
    description: "Fixture proving optional runtime contracts validate structurally.",
  };
  const good = {
    ...base,
    runtime_contract: {
      input_schema: "schemas/input.schema.json",
      output_schema: { type: "object" },
      tool_param_schemas: {
        read_file: "schemas/read-file.schema.json",
      },
      retry_limit: 2,
      handoff_targets: ["verifier"],
    },
    runtime_contract_examples: {
      valid_inputs: [{ artifact: "reports/trace.json" }],
      invalid_inputs: [{ artifact: "" }],
      valid_outputs: [{ verdict: "pass" }],
      invalid_tool_params: {
        read_file: [{ path: "" }],
      },
    },
  };
  const badRetry = {
    ...base,
    runtime_contract: { retry_limit: 99 },
  };
  const badTarget = {
    ...base,
    runtime_contract: { handoff_targets: ["Verifier"] },
  };
  const badExamplesWithoutContract = {
    ...base,
    runtime_contract_examples: {
      valid_inputs: [{ artifact: "reports/trace.json" }],
    },
  };
  const badEmptyExamples = {
    ...base,
    runtime_contract: { input_schema: "schemas/input.schema.json" },
    runtime_contract_examples: {
      valid_inputs: [],
    },
  };
  return (
    validateFrontmatter(good) &&
    !validateFrontmatter(badRetry) &&
    !validateFrontmatter(badTarget) &&
    !validateFrontmatter(badExamplesWithoutContract) &&
    !validateFrontmatter(badEmptyExamples)
  );
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith("validate.mjs")) {
  const targets = collectTargets(process.argv.slice(2));
  let failed = 0;
  let warned = 0;
  const schemaSelftestOk = runtimeContractSelftest();
  console.log(`  ${schemaSelftestOk ? "ok  " : "FAIL"} runtime_contract schema selftest`);
  for (const t of targets) {
    const { errors, warnings } = validateAgentFile(t);
    const rel = t.startsWith(REPO + "/") ? t.slice(REPO.length + 1) : t;
    if (errors.length) {
      failed++;
      console.log(`  FAIL ${rel}`);
      for (const e of errors) console.log(`       ✗ ${e}`);
    } else if (warnings.length) {
      warned++;
      console.log(`  warn ${rel}`);
      for (const w of warnings) console.log(`       ! ${w}`);
    } else {
      console.log(`  ok   ${rel}`);
    }
  }
  console.log(`\nagents: ${targets.length - failed}/${targets.length} valid${warned ? `, ${warned} with warnings` : ""}`);
  process.exit(failed || !schemaSelftestOk ? 1 : 0);
}
