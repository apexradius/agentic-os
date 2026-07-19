// lib/grade.mjs — the deterministic grader. Pure: no model calls, no I/O. An eval.md is
// machine-gradeable only when it carries explicit assertions; everything else is judge-required
// (graded by the instance's model endpoint, not here). This keeps the framework's deterministic
// guarantee honest — it grades what is deterministically expressible and says so when it can't.

// ── baseline: a fenced ```expect block of repeatable contains/regex/not_contains lines ──
const EXPECT_BLOCK = /```expect[ \t]*\r?\n([\s\S]*?)\r?\n```/i;

/** Extract the assertion block from an eval body, or null when there is none (→ judge-required). */
export function parseExpect(body) {
  const m = String(body).match(EXPECT_BLOCK);
  if (!m) return null;
  const a = { contains: [], regex: [], not_contains: [] };
  for (const line of m[1].split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const kv = t.match(/^(contains|regex|not_contains)\s*:\s*(.+)$/i);
    if (!kv) continue;
    a[kv[1].toLowerCase()].push(unquote(kv[2].trim()));
  }
  return a.contains.length + a.regex.length + a.not_contains.length ? a : null;
}

function unquote(v) {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
    return v.slice(1, -1);
  return v;
}

/** Evaluate an assertion set against a model output → {pass, missing[]}. */
export function evalAssertions(assertions, output) {
  const out = String(output ?? '');
  const missing = [];
  for (const s of assertions.contains) if (!out.includes(s)) missing.push(`contains:${s}`);
  for (const r of assertions.regex) {
    let re;
    try {
      re = new RegExp(r, 'm');
    } catch {
      missing.push(`regex(invalid):${r}`);
      continue;
    }
    if (!re.test(out)) missing.push(`regex:${r}`);
  }
  for (const s of assertions.not_contains) if (out.includes(s)) missing.push(`not_contains:${s}`);
  return { pass: missing.length === 0, missing };
}

/** Grade a baseline eval. gradeable:false when there is no assertion block. */
export function gradeBaseline(body, output) {
  const assertions = parseExpect(body);
  if (!assertions)
    return { gradeable: false, pass: null, reason: 'judge-required (no expect block)' };
  const { pass, missing } = evalAssertions(assertions, output);
  return { gradeable: true, pass, missing };
}

// ── rubric: a markdown table, ★ = auto-fail, an optional machine predicate per row ──
function parsePredicate(cell) {
  // not_contains MUST be tried before contains — "contains" is a substring of "not_contains".
  const n = cell.match(/not_contains\s*:\s*"([^"]*)"/i);
  if (n) return { type: 'not_contains', value: n[1] };
  const c = cell.match(/(?:^|[^_])contains\s*:\s*"([^"]*)"/i);
  if (c) return { type: 'contains', value: c[1] };
  const r = cell.match(/regex\s*:\s*\/(.+?)\//i);
  if (r) return { type: 'regex', value: r[1] };
  return null;
}

function predicateMatches(pred, output) {
  const out = String(output ?? '');
  if (pred.type === 'contains') return out.includes(pred.value);
  if (pred.type === 'not_contains') return !out.includes(pred.value);
  if (pred.type === 'regex') {
    try {
      return new RegExp(pred.value, 'm').test(out);
    } catch {
      return false;
    }
  }
  return false;
}

function parseThreshold(body) {
  // Line-based, not a lazy `$` lookahead: under the /m flag `$` matches every line-end, which would
  // capture an empty section. Take the lines from the heading to the next `## ` heading and read a number.
  const lines = String(body).split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+(?:pass[ -]?threshold|threshold)\b/i.test(l));
  if (start === -1) return null;
  const section = [];
  for (let j = start + 1; j < lines.length && !/^##\s/.test(lines[j]); j++) section.push(lines[j]);
  const num = section.join('\n').match(/\d+/);
  return num ? parseInt(num[0], 10) : null;
}

/** Parse the rubric table rows + the pass threshold from an eval body. */
export function parseRubric(body) {
  const rows = [];
  for (const line of String(body).split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const cells = t
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 4) continue;
    const weight = parseInt(cells[2], 10);
    if (Number.isNaN(weight)) continue; // header / separator / non-data row
    rows.push({
      n: cells[0].replace(/★/g, '').trim(),
      criterion: cells[1],
      weight,
      autoFail: /★/.test(cells[0]) || /★/.test(cells[1]),
      predicate: parsePredicate(cells[3]),
    });
  }
  return { rows, threshold: parseThreshold(body) };
}

/** Grade a rubric eval. gradeable:false unless every row carries a machine predicate and a
 *  threshold parses. Otherwise: weighted score, auto-fail on any missed ★ row, pass iff
 *  no auto-fail AND score ≥ threshold. */
export function gradeRubric(body, output) {
  const { rows, threshold } = parseRubric(body);
  if (!rows.length)
    return { gradeable: false, pass: null, reason: 'judge-required (no rubric rows)' };
  if (threshold == null)
    return { gradeable: false, pass: null, reason: 'judge-required (no parseable threshold)' };
  if (rows.some((r) => !r.predicate))
    return {
      gradeable: false,
      pass: null,
      reason: 'judge-required (rows without a machine predicate)',
    };

  const max = rows.reduce((s, r) => s + r.weight, 0);
  let score = 0;
  let autoFailTripped = false;
  const missing = [];
  for (const r of rows) {
    if (predicateMatches(r.predicate, output)) {
      score += r.weight;
    } else {
      missing.push(`#${r.n} ${r.criterion}`);
      if (r.autoFail) autoFailTripped = true;
    }
  }
  return {
    gradeable: true,
    pass: !autoFailTripped && score >= threshold,
    score,
    max,
    threshold,
    autoFailTripped,
    missing,
  };
}
