// lib/harness.mjs — eval.md parsing + the run loop. Pure except for the injected provider:
// runHarness({evals, provider}) never knows whether `provider` is a live model or a mock, which is
// the whole portability seam. No I/O here — the CLI reads eval.md text and passes it in; the
// selftest inlines fixtures. The frontmatter splitter + heading regexes mirror
// framework/primitives/skills/validate.mjs verbatim, re-implemented (not imported) because that
// validator pulls in `yaml`/`ajv` and would break this tree's zero-npm contract.

import { gradeBaseline, gradeRubric } from "./grade.mjs";

const FENCE = /^---[ \t]*$/;

/** Split a doc into {fm, body} on the frontmatter fence — never split('---'), bodies contain `---`. */
export function splitFrontmatter(raw) {
  let text = String(raw);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.split(/\r?\n/);
  if (!FENCE.test(lines[0] ?? "")) return { fm: "", body: text };
  let close = -1;
  for (let i = 1; i < lines.length; i++) if (FENCE.test(lines[i])) { close = i; break; }
  if (close === -1) throw new Error("frontmatter opened with `---` but never closed");
  return { fm: lines.slice(1, close).join("\n"), body: lines.slice(close + 1).join("\n") };
}

// A one-key scalar reader — we need only `eval-type`, not a full YAML parser.
function readScalar(fm, key) {
  const m = fm.match(new RegExp(`^${key}\\s*:\\s*(.+)$`, "im"));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}

const RE = {
  baseline: /^##\s+baseline\b/im,
  pass: /^##\s+(pass|with skill)\b/im,
  rubric: /^##\s+rubric\b/im,
  threshold: /^##\s+(pass[ -]?threshold|threshold)\b/im,
};

/** Parse + structurally validate an eval.md. Throws on an unknown eval-type or a missing required
 *  section (mirrors the skills validator's error contract). Returns {evalType, body}. */
export function parseEval(raw) {
  const { fm, body } = splitFrontmatter(raw);
  let evalType = "baseline";
  const declared = readScalar(fm, "eval-type");
  if (declared != null) evalType = declared; // value is case-SENSITIVE, per the skills validator
  if (evalType !== "baseline" && evalType !== "rubric") {
    throw new Error(`unknown eval-type '${evalType}' (expected 'baseline' or 'rubric')`);
  }
  if (evalType === "baseline") {
    if (!RE.baseline.test(body)) throw new Error("baseline eval missing a '## Baseline' section");
    if (!RE.pass.test(body)) throw new Error("baseline eval missing a '## Pass' (or '## With skill') section");
  } else {
    if (!RE.rubric.test(body)) throw new Error("rubric eval missing a '## Rubric' section");
    if (!RE.threshold.test(body)) throw new Error("rubric eval missing a '## Pass threshold' section");
  }
  return { evalType, body };
}

/**
 * Run every eval through the provider and grade it. `evals` = [{skill, raw}] (raw eval.md text);
 * `provider` = async ({skill, evalType, raw}) => model output string. Returns the scoreboard.
 * A parse error or a thrown provider is captured per-eval (errored) — one bad eval never aborts the run.
 */
export async function runHarness({ evals, provider }) {
  const results = [];
  let passed = 0, failed = 0, skipped = 0, gradeable = 0, errored = 0;
  for (const e of evals) {
    try {
      const { evalType, body } = parseEval(e.raw);
      const output = await provider({ skill: e.skill, evalType, raw: e.raw });
      const verdict = evalType === "rubric" ? gradeRubric(body, output) : gradeBaseline(body, output);
      results.push({ skill: e.skill, evalType, ...verdict });
      if (!verdict.gradeable) skipped++;
      else { gradeable++; verdict.pass ? passed++ : failed++; }
    } catch (err) {
      results.push({ skill: e.skill, evalType: null, gradeable: false, pass: null, error: err.message });
      errored++;
    }
  }
  return { total: evals.length, gradeable, passed, failed, skipped, errored, results };
}
