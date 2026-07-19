// Behavioral router test: invoke routePromptCore exactly as the MCP route_prompt handler does,
// against a runtime library, on THIS machine's own dist code + node.
// usage: <node> router-test.mjs <abs dist/router.js> <abs index.generated.md> <abs workspace dir>
const [, , routerPath, libPath, ws] = process.argv;
const { routePromptCore } = await import(routerPath);

const goals = [
  {
    label: 'debug',
    goal: 'debug why the production API intermittently returns 500 errors under load',
  },
  { label: 'plan', goal: 'plan and architect a new multi-tenant billing system from scratch' },
  { label: 'audit', goal: 'audit this website for SEO, performance, and core web vitals' },
];

const cases = [];
for (const g of goals) {
  const r = await routePromptCore({
    workspacePath: ws,
    libraryPath: libPath,
    userGoal: g.goal,
    sessionSummary: undefined,
    maxFiles: 300,
    maxDepth: 5,
    maxReadBytes: 12000,
  });
  const sp = r.selected_prompt;
  cases.push({
    label: g.label,
    status: r.status,
    selected: sp?.name ?? null,
    trigger: sp?.trigger ?? null,
    confidence: sp?.confidence ?? null,
    confidence_score: sp?.confidence_score ?? null,
    raw_signal_score: sp?.raw_signal_score ?? null,
    contract: Boolean(r.execution_contract),
    warnings: (r.warnings || []).length,
  });
}

const distinct_selected = new Set(cases.map((c) => c.selected)).size;
const all_ok = cases.every(
  (c) => c.status === 'ok' && c.selected && c.contract && c.warnings === 0,
);
console.log(JSON.stringify({ cases, distinct_selected, all_ok }, null, 2));
