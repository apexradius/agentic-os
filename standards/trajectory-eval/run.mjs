#!/usr/bin/env node
// run.mjs — the instance-facing trajectory-eval CLI. Scores one RECORDED run (a candidate
// trajectory) against a PINNED baseline (a golden trajectory), prints the scoreboard, and exits
// non-zero when the deterministic floor fails OR a gating dimension regressed. Judge dimensions run
// only when the instance supplies a provider; with none they report as judge-required (never block).
//
//   node run.mjs <candidate.trajectory.json> --baseline <baseline.trajectory.json> \
//        [--provider /abs/endpoint.mjs] [--report <out-dir>]
//
// The framework hardcodes no model and no store — the candidate/baseline are files you export
// (see lib/export.mjs) and the judge provider is instance-supplied. Exit 0 = pass, 1 = regression
// or floor failure, 2 = usage / load error.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compareToBaseline } from './lib/regression.mjs';
import { scoreJudge } from './lib/score-judge.mjs';
import { loadTrajectory } from './lib/trajectory.mjs';

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

async function loadProvider() {
  const p = arg('--provider') || process.env.TRAJECTORY_JUDGE_ENDPOINT;
  if (!p) return null;
  const mod = await import(pathToFileURL(resolve(p)).href);
  const fn = mod.default ?? mod.judge;
  if (typeof fn !== 'function')
    throw new Error(
      "--provider module must export `default async ({dimension, candidate, baseline, presentation})=>'pass'|'fail'`",
    );
  return fn;
}

/** Render a human-readable regression report from a comparison + judge block. */
export function renderReport(comparison, judge, meta) {
  const L = [];
  const verdict = comparison.pass ? 'PASS' : comparison.regressed ? 'REGRESSION' : 'FLOOR-FAIL';
  L.push(`# Trajectory regression report — ${verdict}`);
  L.push('');
  L.push(`- candidate: \`${meta.candidate}\` (model ${meta.candidateModel})`);
  L.push(`- baseline:  \`${meta.baseline}\` (model ${meta.baselineModel})`);
  L.push(`- task fingerprint: \`${meta.fingerprint}\``);
  L.push(`- generated: ${meta.generated_at}`);
  L.push('');
  L.push('## Deterministic floor');
  L.push('');
  L.push('| Dimension | Candidate | Baseline | Bar | Meets | Regressed |');
  L.push('|---|---|---|---|---|---|');
  for (const [name, d] of Object.entries(comparison.dimensions)) {
    if (!d.gating) continue;
    const bar = d.direction === 'lower-is-better' ? `≤ ${d.max}` : `≥ ${d.threshold}`;
    const cand = fmt(d.candidate),
      base = fmt(d.baseline);
    L.push(
      `| ${name} | ${cand} | ${base} | ${bar} | ${d.meets_threshold ? 'yes' : 'NO'} | ${d.regressed ? 'YES' : 'no'} |`,
    );
  }
  L.push('');
  const eff = comparison.dimensions.efficiency;
  L.push(
    `_Informational — tokens_out Δ ${eff.delta.tokens_out}, span_count Δ ${eff.delta.span_count}; fan-out width ${comparison.dimensions.fan_out.candidate.width} (baseline ${comparison.dimensions.fan_out.baseline.width})._`,
  );
  L.push('');
  L.push('## Judge dimensions');
  L.push('');
  if (!judge || !judge.dimensions) {
    L.push('_Not run._');
  } else {
    for (const [name, d] of Object.entries(judge.dimensions)) {
      const v = d.gradeable
        ? d.verdict.toUpperCase()
        : d.escalate
          ? 'ESCALATED (order-swap disagreed)'
          : 'judge-required (not run)';
      L.push(`- **${name}**: ${v}`);
    }
  }
  L.push('');
  return L.join('\n');
}

function fmt(v) {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3);
  return String(v);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const candidatePath =
    process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
  const baselinePath = arg('--baseline');
  if (!candidatePath || !baselinePath) {
    console.error(
      'usage: run.mjs <candidate.trajectory.json> --baseline <baseline.trajectory.json> [--provider ep.mjs] [--report dir]',
    );
    process.exit(2);
  }

  const cand = loadTrajectory(readFileSync(candidatePath, 'utf-8'));
  const base = loadTrajectory(readFileSync(baselinePath, 'utf-8'));
  if (cand.errors.length) {
    console.error(`candidate invalid: ${cand.errors.join('; ')}`);
    process.exit(2);
  }
  if (base.errors.length) {
    console.error(`baseline invalid: ${base.errors.join('; ')}`);
    process.exit(2);
  }

  const comparison = compareToBaseline(cand.trajectory, base.trajectory);
  const provider = await loadProvider();
  const judge = await scoreJudge({
    candidate: cand.trajectory,
    baseline: base.trajectory,
    provider,
  });

  const meta = {
    candidate: candidatePath,
    baseline: baselinePath,
    candidateModel: cand.trajectory.provenance.model,
    baselineModel: base.trajectory.provenance.model,
    fingerprint: base.trajectory.provenance.task_fingerprint,
    generated_at: new Date().toISOString(),
  };
  const scoreboard = {
    verdict: comparison.pass ? 'pass' : comparison.regressed ? 'regression' : 'floor-fail',
    ...comparison,
    judge,
    meta,
  };

  const reportDir = arg('--report');
  if (reportDir) {
    if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });
    const stamp = meta.generated_at.slice(0, 10);
    writeFileSync(
      join(reportDir, `trajectory-regression-${stamp}.json`),
      JSON.stringify(scoreboard, null, 2),
    );
    writeFileSync(
      join(reportDir, `trajectory-regression-${stamp}.md`),
      renderReport(comparison, judge, meta),
    );
  }

  console.log(JSON.stringify(scoreboard, null, 2));
  process.exit(comparison.pass ? 0 : 1);
}
