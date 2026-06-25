#!/usr/bin/env node
// validate.mjs — the scheduler selftest. Time is pinned (no real clock), so selection is a
// pure, deterministic function of the ledger. Proves the four behaviors the proactive loop
// rests on: ready → dispatched, unmet dependency → skipped, not-yet-due → skipped,
// terminal status → skipped, plus interval-recurrence and priority ordering.

import { selectDispatchable, isDue, intervalMs, latestById } from "./lib/select.mjs";

const NOW = Date.parse("2026-06-25T12:00:00Z");
const iso = (ms) => new Date(ms).toISOString();

const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, pass: !!cond, detail }); return !!cond; };

// ── interval parsing ──────────────────────────────────────────────────────────
ok("intervalMs: 30m", intervalMs("@every 30m") === 30 * 60_000);
ok("intervalMs: 1h", intervalMs("@every 1h") === 3_600_000);
ok("intervalMs: 90s", intervalMs("@every 90s") === 90_000);
ok("intervalMs: garbage → null", intervalMs("soon-ish") === null);

// ── isDue ───────────────────────────────────────────────────────────────────
ok("isDue: no constraints → due", isDue({ id: "a" }, NOW));
ok("isDue: future due_at → not due", !isDue({ id: "a", due_at: iso(NOW + 60_000) }, NOW));
ok("isDue: past due_at → due", isDue({ id: "a", due_at: iso(NOW - 60_000) }, NOW));
ok("isDue: schedule, never run → due", isDue({ id: "a", schedule: "@every 30m" }, NOW));
ok("isDue: schedule, ran 10m ago → not due",
  !isDue({ id: "a", schedule: "@every 30m", metadata: { last_run_at: iso(NOW - 10 * 60_000) } }, NOW));
ok("isDue: schedule, ran 40m ago → due",
  isDue({ id: "a", schedule: "@every 30m", metadata: { last_run_at: iso(NOW - 40 * 60_000) } }, NOW));
ok("isDue: unparseable schedule → not due (fail safe)", !isDue({ id: "a", schedule: "whenever" }, NOW));

// ── latest-wins collapse ──────────────────────────────────────────────────────
ok("latestById: last line wins",
  latestById([{ id: "x", status: "pending" }, { id: "x", status: "completed" }]).every((t) => t.status === "completed"));

// ── selectDispatchable: the four core behaviors ───────────────────────────────
const ledger = [
  { id: "ready", title: "Ready now", status: "pending", priority: "P2" },
  { id: "dep-parent", title: "Parent (incomplete)", status: "in-progress" },
  { id: "blocked-by-dep", title: "Waits on parent", status: "pending", depends_on: ["dep-parent"], priority: "P1" },
  { id: "future", title: "Not yet due", status: "pending", due_at: iso(NOW + 3_600_000) },
  { id: "done", title: "Already finished", status: "completed" },
  { id: "urgent", title: "Top priority", status: "pending", priority: "P0" },
  { id: "recurring", title: "Heartbeat job", status: "pending", schedule: "@every 30m", metadata: { last_run_at: iso(NOW - 40 * 60_000) } },
];
const due = selectDispatchable(ledger, { now: NOW });
const ids = due.map((t) => t.id);

ok("select: ready task dispatched", ids.includes("ready"));
ok("select: unmet dependency skipped", !ids.includes("blocked-by-dep"));
ok("select: not-yet-due skipped", !ids.includes("future"));
ok("select: completed skipped", !ids.includes("done"));
ok("select: in-progress (not pending/claimed) skipped", !ids.includes("dep-parent"));
ok("select: recurring-due dispatched", ids.includes("recurring"));
ok("select: priority order (P0 first)", ids[0] === "urgent", `got [${ids.join(",")}]`);

// Dependency becomes dispatchable once the parent completes.
const after = selectDispatchable(
  ledger.map((t) => (t.id === "dep-parent" ? { ...t, status: "completed" } : t)),
  { now: NOW },
).map((t) => t.id);
ok("select: dependent dispatches after parent completes", after.includes("blocked-by-dep"));

// Owner scoping: a claimed task is mine to run, but not someone else's.
const claimed = [{ id: "c", title: "Claimed", status: "claimed", owner: "claude" }];
ok("select: claimed-by-me dispatched", selectDispatchable(claimed, { now: NOW, owner: "claude" }).length === 1);
ok("select: claimed-by-other skipped", selectDispatchable(claimed, { now: NOW, owner: "codex" }).length === 0);
ok("select: claimed skipped when no owner declared", selectDispatchable(claimed, { now: NOW }).length === 0);

const failed = checks.filter((c) => !c.pass);
for (const c of checks) if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
console.log(`scheduler: ${checks.length - failed.length}/${checks.length} selftest checks passed`);
process.exit(failed.length ? 1 : 0);
