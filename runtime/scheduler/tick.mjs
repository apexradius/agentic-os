#!/usr/bin/env node
// tick.mjs — one proactive scheduler tick over a coordination ledger.
//
//   node tick.mjs [--owner <role>] [--json] <tasks.jsonl>
//
// Reads the append-only ledger, selects the tasks that are READY (dependencies completed),
// UNSTARTED or owned by me, and DUE (due_at passed / schedule interval elapsed), and prints
// the dispatch plan — the proactive heartbeat both Hermes Agent and OpenClaw ship, expressed
// over Apex's existing file-backed ledger instead of a bespoke store. It DISPATCHES nothing
// itself: emitting the plan is the portable, side-effect-free core; the instance wires this
// tick to its cron cadence and hands the plan to its executor/Council (see
// framework/coordination/scheduler.md). Read-only by design — safe to run on a live ledger.

import { readFileSync } from 'node:fs';
import { selectDispatchable } from './lib/select.mjs';

/** Parse a tasks.jsonl blob into records (one JSON object per non-blank, non-comment line). */
export function parseLedger(jsonl) {
  return jsonl
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'))
    .map((l) => JSON.parse(l));
}

if (process.argv[1] && process.argv[1].endsWith('tick.mjs')) {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  let owner = null;
  const oi = argv.indexOf('--owner');
  if (oi !== -1 && argv[oi + 1]) owner = argv[oi + 1];
  const target = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--owner');

  if (!target) {
    console.error('usage: tick.mjs [--owner <role>] [--json] <tasks.jsonl>');
    process.exit(2);
  }

  const now = Date.now();
  const records = parseLedger(readFileSync(target, 'utf8'));
  const due = selectDispatchable(records, { now, owner });

  if (json) {
    console.log(
      JSON.stringify({ now: new Date(now).toISOString(), owner, dispatch: due }, null, 2),
    );
  } else {
    console.log(
      `scheduler tick @ ${new Date(now).toISOString()}${owner ? ` (owner: ${owner})` : ''}`,
    );
    if (!due.length) console.log('  nothing ready/due this tick');
    for (const t of due) {
      const cadence = t.schedule ? ` [${t.schedule}]` : t.due_at ? ` [due ${t.due_at}]` : '';
      console.log(`  → ${t.priority || 'P?'} ${t.id}: ${t.title}${cadence}`);
    }
  }
  process.exit(0);
}
