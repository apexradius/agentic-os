import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SERVER = join(PACKAGE_ROOT, 'dist/index.js');
const WS = '/tmp/apex-chain-fieldtest';

function rpc(id, method, params) {
  return `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`;
}

function routePrompt(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [SERVER], { stdio: ['pipe', 'pipe', 'ignore'] });
    let out = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('timeout'));
    }, 20000);
    child.stdout.on('data', (d) => {
      out += d.toString();
      for (const line of out.split('\n')) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id === 2) {
            clearTimeout(timer);
            child.kill();
            resolve(JSON.parse(msg.result.content[0].text));
            return;
          }
        } catch {
          /* partial */
        }
      }
    });
    child.on('error', reject);
    child.stdin.write(
      rpc(1, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'chain-fieldtest', version: '0' },
      }),
    );
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`,
    );
    child.stdin.write(
      rpc(2, 'tools/call', { name: 'route_prompt', arguments: { workspace_path: WS, ...args } }),
    );
  });
}

const hops = [];
let failures = 0;

async function hop(label, setup, args, expect) {
  await setup();
  const res = await routePrompt(args);
  const got = {
    name: res.selected_prompt.name,
    confidence: res.selected_prompt.confidence,
    score: res.selected_prompt.confidence_score,
    next_trigger: res.selected_prompt.next_trigger,
    chain_next: res.execution_contract.on_complete.next_trigger,
    chain_complete: res.execution_contract.on_complete.chain_complete,
    stage: res.scan_summary.lifecycle_stage,
    gtm: res.scan_summary.gtm_decision,
  };
  const ok = expect(got);
  if (!ok) failures += 1;
  hops.push(
    `${ok ? 'PASS' : 'FAIL'}  ${label}\n      → ${got.name} (${got.confidence} ${got.score}/100, trigger=${got.next_trigger}) | state: stage=${got.stage} gtm=${got.gtm} | on_complete: next=${got.chain_next} complete=${got.chain_complete}`,
  );
}

// Hop 0 — operator runs /initialize in a brand-new empty folder.
await fs.rm(WS, { recursive: true, force: true });
await fs.mkdir(WS, { recursive: true });
await hop(
  'Hop 1: empty folder, no goal — bootstrap the lifecycle',
  async () => {},
  { user_goal: '' },
  (g) =>
    g.name === 'Application Development Lifecycle Master Prompt' &&
    g.confidence === 'high' &&
    g.next_trigger === 'S0_BOOTSTRAP' &&
    g.chain_next === 'GTM_READY',
);

// Hop 2 — master prompt has been working; state file says S4. Session resumes.
await hop(
  'Hop 2: lifecycle mid-flight (S4) — resume via NEXT_GATE',
  async () => {
    await fs.mkdir(`${WS}/docs/ops`, { recursive: true });
    await fs.writeFile(
      `${WS}/docs/ops/lifecycle-state.md`,
      '# State\n\nCurrent stage: S4\nResume: NEXT_GATE\n',
    );
    await fs.writeFile(`${WS}/README.md`, 'fieldtest project\n');
  },
  { session_summary: 'S3 exit gate passed; scaffold complete' },
  (g) =>
    g.name === 'Application Development Lifecycle Master Prompt' &&
    g.next_trigger === 'NEXT_GATE' &&
    g.stage === 'S4',
);

// Hop 3 — S11 passes; master's Chain Handoff writes the completion line.
await hop(
  'Hop 3: S11 complete — hand off to GTM readiness',
  async () => {
    await fs.writeFile(
      `${WS}/docs/ops/lifecycle-state.md`,
      '# State\n\nCurrent stage: S11 — complete\n',
    );
  },
  { session_summary: 'S11_OPERATE exit gate passed; lifecycle complete per Chain Handoff' },
  (g) =>
    g.name === 'Go To Market Readiness Prompt' &&
    g.chain_next === 'ACCOUNT_GROWTH_RUN' &&
    g.chain_complete === false,
);

// Hop 4 — GTM run scores CONDITIONAL; repair loop keeps routing to GTM.
await hop(
  'Hop 4: GTM Decision CONDITIONAL — stay in repair loop',
  async () => {
    await fs.mkdir(`${WS}/docs/gtm`, { recursive: true });
    await fs.writeFile(`${WS}/docs/gtm/readiness.md`, '# Readiness\n\nGTM Decision: CONDITIONAL\n');
  },
  { session_summary: 'GTM scored; repair plan in flight' },
  (g) => g.name === 'Go To Market Readiness Prompt' && g.gtm === 'conditional',
);

// Hop 5 — repairs done; GO recorded. Chain completes into growth.
await hop(
  'Hop 5: GTM Decision GO — Account Growth, chain complete',
  async () => {
    await fs.writeFile(`${WS}/docs/gtm/readiness.md`, '# Readiness\n\nGTM Decision: GO\n');
  },
  { session_summary: 'GTM repair plan executed; decision GO recorded' },
  (g) => g.name === 'Account Growth System' && g.chain_complete === true && g.gtm === 'go',
);

console.log(hops.join('\n'));
console.log(
  failures === 0
    ? '\nCHAIN FIELD TEST: ALL 5 HOPS PASS — empty folder to GTM-ready spine is live'
    : `\nCHAIN FIELD TEST: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
