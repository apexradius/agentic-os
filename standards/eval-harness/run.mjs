#!/usr/bin/env node
// run.mjs — the instance-facing eval-harness CLI. Discovers skills, runs each eval.md against a
// LIVE model the instance supplies, prints the scoreboard, and (opt-in) appends a run-record per
// gradeable eval to the observability sink.
//
//   EVAL_HARNESS_ENDPOINT=/abs/path/to/endpoint.mjs \
//   [RUNRECORD_LOG=/abs/path/runs.ndjson] \
//   node framework/standards/eval-harness/run.mjs <skills-root> [<skills-root> ...]
//
// The endpoint module must `export default async ({skill, evalType, raw}) => <model output string>`.
// The framework hardcodes no model, no endpoint, and no log path — all are instance-supplied.

import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runHarness } from "./lib/harness.mjs";

/** Collect every <root>/<skill>/eval.md, and count the skills (those with a SKILL.md) for coverage. */
export function collectEvals(roots) {
  const evals = [];
  let totalSkills = 0;
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const d of readdirSync(root, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      if (!existsSync(join(root, d.name, "SKILL.md"))) continue;
      totalSkills++;
      const evalPath = join(root, d.name, "eval.md");
      if (existsSync(evalPath)) evals.push({ skill: d.name, raw: readFileSync(evalPath, "utf8") });
    }
  }
  return { evals, totalSkills };
}

async function loadEndpoint() {
  const p = process.env.EVAL_HARNESS_ENDPOINT;
  if (!p) throw new Error("no EVAL_HARNESS_ENDPOINT configured — set it to a module exporting `default async (ctx)=>output`, or run validate.mjs for the MOCK selftest");
  const mod = await import(pathToFileURL(resolve(p)).href);
  const fn = mod.default ?? mod.endpoint;
  if (typeof fn !== "function") throw new Error("EVAL_HARNESS_ENDPOINT module must export `default async ({skill, evalType, raw})=>output`");
  return fn;
}

if (process.argv[1] && process.argv[1].endsWith("run.mjs")) {
  const roots = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!roots.length) { console.error("usage: run.mjs <skills-root> [<skills-root> ...]"); process.exit(2); }

  const { evals, totalSkills } = collectEvals(roots);
  const provider = await loadEndpoint();
  const board = await runHarness({ evals, provider });
  board.coverage = { withEval: evals.length, total: totalSkills, pct: totalSkills ? Math.round((evals.length / totalSkills) * 100) : 0 };
  board.generated_at = new Date().toISOString();

  // Opt-in: append one run-record per GRADEABLE eval to the observability sink (judge-required
  // evals never ran a deterministic verify, so they get no run-record).
  if (process.env.RUNRECORD_LOG) {
    const { appendRunRecord } = await import("../../runtime/observability/sink.mjs");
    for (const r of board.results) {
      if (!r.gradeable) continue;
      appendRunRecord({
        task_id: `eval:${r.skill}`,
        slice: r.evalType || "eval",
        model: process.env.EVAL_HARNESS_MODEL || "",
        effort: process.env.EVAL_HARNESS_EFFORT || "",
        attempts: 1,
        verify: { first_pass: r.pass === true, result: r.pass === true ? "pass" : "fail" },
        metadata: { score: r.score, max: r.max },
      });
    }
  }

  console.log(JSON.stringify(board, null, 2));
  process.exit(board.failed === 0 && board.errored === 0 ? 0 : 1);
}
