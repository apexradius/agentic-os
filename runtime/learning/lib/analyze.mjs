// lib/analyze.mjs — pure analysis over observability run-records. No I/O, no clock; the entry
// (../analyze.mjs) reads the file and injects the clock, so every aggregation is deterministic and
// assertable like observability/lib/record.mjs. Input fields are the observability standard
// (framework/doctrine/standards/observability.md); the loop this feeds is the learning standard
// (framework/doctrine/standards/learning.md). This module READS — it emits signals + bounded review
// candidates for a human/Council retro, and has no path that edits the framework.

/** Tolerant NDJSON parse — skips blank + malformed lines, mirroring observability/sink.mjs read-back. */
export function parseRunRecords(ndjson) {
  return String(ndjson ?? '')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function median(nums) {
  const xs = nums
    .filter(Number.isFinite)
    .slice()
    .sort((a, b) => a - b);
  if (!xs.length) return 0;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}
const round = (n) => Math.round(n * 100) / 100;

/** Aggregate per slice: runs, Verify fails (with sample task ids), and rework runs (>1 attempt). */
export function summarizeBySlice(records) {
  const m = new Map();
  for (const r of records) {
    const slice = String(r?.slice ?? '');
    if (!m.has(slice))
      m.set(slice, { slice, runs: 0, fails: 0, reworkRuns: 0, attempts: 0, taskIds: [] });
    const s = m.get(slice);
    s.runs++;
    if (r?.verify?.result === 'fail') {
      s.fails++;
      s.taskIds.push(String(r.task_id ?? ''));
    }
    const attempts = Number.isInteger(r?.attempts) ? r.attempts : 1;
    s.attempts += attempts;
    if (attempts > 1) s.reworkRuns++;
  }
  return [...m.values()];
}

/** Per gate rule, count allow/ask/deny. A rule with only ONE decision kind across >= minGate runs is
 *  "skewed" — candidate to retire (always-allow = dead weight) or re-tune (always-deny = friction/risk). */
export function gateSkew(records, minGate = 3) {
  const m = new Map();
  for (const r of records) {
    for (const g of Array.isArray(r?.gate_decisions) ? r.gate_decisions : []) {
      const decision = String(g?.decision ?? '');
      for (const rule of Array.isArray(g?.rules) ? g.rules : []) {
        if (!m.has(rule)) m.set(rule, { rule, allow: 0, ask: 0, deny: 0, total: 0 });
        const e = m.get(rule);
        if (decision === 'allow' || decision === 'ask' || decision === 'deny') e[decision]++;
        e.total++;
      }
    }
  }
  return [...m.values()]
    .filter((e) => e.total >= minGate)
    .map((e) => {
      const kinds = ['allow', 'ask', 'deny'].filter((k) => e[k] > 0);
      return { ...e, skewed: kinds.length === 1 ? kinds[0] : null };
    })
    .filter((e) => e.skewed);
}

/** Records whose numeric field exceeds `factor`× the median — the duration/cost outliers worth a look. */
function outliers(records, field, factor, top) {
  const med = median(records.map((r) => r?.[field]));
  if (!med) return { median: 0, items: [] };
  const items = records
    .filter((r) => Number.isFinite(r?.[field]) && r[field] > factor * med)
    .sort((a, b) => b[field] - a[field])
    .slice(0, top)
    .map((r) => ({
      task_id: String(r.task_id ?? ''),
      slice: String(r.slice ?? ''),
      [field]: r[field],
    }));
  return { median: med, items };
}

/** Build the full report. `now` (a Date) is injected so the report is deterministic under test. */
export function buildReport(records, opts = {}) {
  const { now, top = 5, minFails = 2, minRework = 2, minGate = 3, outlierFactor = 2 } = opts;
  const slices = summarizeBySlice(records);
  const ts = records
    .map((r) => r?.ts)
    .filter(Boolean)
    .sort();

  const recurring_failures = slices
    .filter((s) => s.fails >= minFails)
    .map((s) => ({
      slice: s.slice,
      runs: s.runs,
      fails: s.fails,
      fail_rate: round(s.fails / s.runs),
      evidence_task_ids: s.taskIds.slice(0, 3),
    }))
    .sort((a, b) => b.fails - a.fails || b.fail_rate - a.fail_rate);

  const rework_hotspots = slices
    .filter((s) => s.reworkRuns >= minRework)
    .map((s) => ({
      slice: s.slice,
      runs: s.runs,
      rework_runs: s.reworkRuns,
      avg_attempts: round(s.attempts / s.runs),
    }))
    .sort((a, b) => b.rework_runs - a.rework_runs);

  const signals = {
    recurring_failures,
    rework_hotspots,
    duration_outliers: outliers(records, 'duration', outlierFactor, top),
    cost_outliers: outliers(records, 'cost', outlierFactor, top),
    gate_skew: gateSkew(records, minGate).sort((a, b) => b.total - a.total),
  };

  return {
    generated_at: (now ?? new Date()).toISOString(),
    window: { total: records.length, first_ts: ts[0] ?? null, last_ts: ts[ts.length - 1] ?? null },
    signals,
    candidates: rankCandidates(signals).slice(0, top),
    note: 'Candidates are evidence for a human/Council retro — not actions. This loop reads run-records and never edits the framework; any change goes through the normal Plan->Implement->Verify path.',
  };
}

/** Reframe the strongest signals as review candidates, ranked by a simple severity heuristic, then
 *  strip the heuristic — what a reviewer sees is the kind, the subject, the rationale, and the evidence. */
function rankCandidates(signals) {
  const out = [];
  for (const f of signals.recurring_failures) {
    out.push({
      kind: 'recurring-failure',
      subject: f.slice,
      severity: f.fails * (0.5 + f.fail_rate),
      rationale: `Verify failed ${f.fails}/${f.runs} runs (${Math.round(f.fail_rate * 100)}%) for slice "${f.slice}" — a recurring failure to root-cause, not re-attempt.`,
      evidence: { runs: f.runs, fails: f.fails, task_ids: f.evidence_task_ids },
    });
  }
  for (const g of signals.gate_skew) {
    out.push({
      kind:
        g.skewed === 'deny'
          ? 'gate-always-denies'
          : g.skewed === 'allow'
            ? 'gate-always-allows'
            : 'gate-skew',
      subject: g.rule,
      severity: g.skewed === 'deny' ? g.total * 0.4 : g.total * 0.2,
      rationale:
        g.skewed === 'deny'
          ? `Rule "${g.rule}" denied every one of ${g.total} runs — confirm it catches real risk, or it is friction to re-tune.`
          : `Rule "${g.rule}" allowed every one of ${g.total} runs — candidate dead weight to retire, or it is silently rubber-stamping.`,
      evidence: { rule: g.rule, allow: g.allow, ask: g.ask, deny: g.deny, total: g.total },
    });
  }
  for (const h of signals.rework_hotspots) {
    out.push({
      kind: 'rework-hotspot',
      subject: h.slice,
      severity: h.rework_runs * 0.3,
      rationale: `Slice "${h.slice}" needed more than one implement->verify attempt on ${h.rework_runs}/${h.runs} runs (avg ${h.avg_attempts}) — a planning or spec gap worth a closer look.`,
      evidence: { runs: h.runs, rework_runs: h.rework_runs, avg_attempts: h.avg_attempts },
    });
  }
  return out.sort((a, b) => b.severity - a.severity).map(({ severity, ...c }) => c);
}
