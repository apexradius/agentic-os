// lib/select.mjs — the pure selection core of the proactive scheduler.
//
// Zero dependencies, no clock of its own: every function that needs "now" takes it as an
// argument, so the selection is a pure function of (ledger records, now, owner) and the
// selftest can pin time. The tick wrapper (../tick.mjs) supplies the real clock and the
// real tasks.jsonl. This mirrors the file-backed, greppable control-plane philosophy of
// framework/coordination/ledger.md — the scheduler reads the same append-only JSONL the
// ledger engine writes, it does not own a second source of truth.

/** Collapse append-only records to the latest line per id (the ledger's "latest wins" rule). */
export function latestById(records) {
  const m = new Map();
  for (const r of records) if (r && r.id) m.set(r.id, r);
  return [...m.values()];
}

const INTERVAL = /^@every\s+(\d+)\s*(s|sec|m|min|h|hr|hour|d|day)s?$/i;
const UNIT_MS = {
  s: 1e3,
  sec: 1e3,
  m: 6e4,
  min: 6e4,
  h: 36e5,
  hr: 36e5,
  hour: 36e5,
  d: 864e5,
  day: 864e5,
};

/** Parse '@every 30m' → milliseconds, or null if not a recognized interval expression. */
export function intervalMs(schedule) {
  const m = String(schedule || '').match(INTERVAL);
  if (!m) return null;
  return Number(m[1]) * UNIT_MS[m[2].toLowerCase()];
}

/** Is this task due to run at `now` (epoch ms)? due_at gates one-shots; schedule gates recurrence. */
export function isDue(task, now) {
  if (task.due_at) {
    const t = Date.parse(task.due_at);
    if (!Number.isNaN(t) && t > now) return false;
  }
  if (task.schedule) {
    const every = intervalMs(task.schedule);
    if (every == null) return false; // unparseable cadence → never auto-dispatch (fail safe)
    const last = Date.parse(task?.metadata?.last_run_at ?? '');
    if (!Number.isNaN(last) && now - last < every) return false; // not enough time elapsed
  }
  return true;
}

/** Every id this task depends on must be completed. */
function dependenciesMet(task, byId) {
  return (task.depends_on || []).every((id) => byId.get(id)?.status === 'completed');
}

const PRIORITY_RANK = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 };

/**
 * Select the tasks the scheduler should dispatch this tick.
 * A task is dispatchable when it is unstarted (or already mine), its dependencies are met,
 * and it is due. Returns them ordered by priority then id (stable, deterministic).
 */
export function selectDispatchable(records, { now, owner = null } = {}) {
  const tasks = latestById(records);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return tasks
    .filter((t) => {
      if (t.status !== 'pending' && t.status !== 'claimed') return false;
      // A claimed task is only mine to (re)dispatch when I am its declared owner. Without an
      // owner to match against we cannot prove it's ours, so we leave it to its holder rather
      // than risk double-dispatching in-flight work.
      if (t.status === 'claimed' && (!owner || t.owner !== owner)) return false;
      if (!dependenciesMet(t, byId)) return false;
      if (!isDue(t, now)) return false;
      return true;
    })
    .sort((a, b) => {
      const pa = PRIORITY_RANK[a.priority] ?? 9;
      const pb = PRIORITY_RANK[b.priority] ?? 9;
      return pa - pb || String(a.id).localeCompare(String(b.id));
    });
}
