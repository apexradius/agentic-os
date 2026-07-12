import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SERVER = join(PACKAGE_ROOT, 'dist/index.js');
const REPO_ROOT = resolve(PACKAGE_ROOT, '../../../..');
const LIBRARY = process.env.APEX_PROMPT_LIBRARY_PATH
  ?? join(REPO_ROOT, 'apex/config/prompt-router/library/index.generated.md');
const SERVER_ENV = { ...process.env, APEX_PROMPT_LIBRARY_PATH: LIBRARY };

function rpc(id, method, params) {
  return `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`;
}

function callTool(name, args) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [SERVER], { env: SERVER_ENV, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`timeout; stderr: ${err}`));
    }, 20000);
    child.stderr.on('data', (d) => {
      err += d.toString();
    });
    child.stdout.on('data', (d) => {
      out += d.toString();
      for (const line of out.split('\n')) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id === 2) {
            clearTimeout(timer);
            child.kill();
            resolve({ msg, stderr: err });
            return;
          }
        } catch {
          /* partial line */
        }
      }
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.stdin.write(
      rpc(1, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'smoke', version: '0.0.0' },
      }),
    );
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
    child.stdin.write(rpc(2, 'tools/call', { name, arguments: args }));
  });
}

function closesAfterStdinEof() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [SERVER], { env: SERVER_ENV, stdio: ['pipe', 'pipe', 'pipe'] });
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`server remained alive after stdin EOF; stderr: ${err}`));
    }, 5000);
    child.stderr.on('data', (data) => {
      err += data.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      if (code === 0 && signal === null) resolve(err);
      else reject(new Error(`server exited abnormally after stdin EOF (code=${code}, signal=${signal})`));
    });
    child.stdin.end();
  });
}

function payload(result) {
  const text = result.msg.result?.content?.[0]?.text;
  return { isError: result.msg.result?.isError ?? false, body: text ? JSON.parse(text) : null };
}

async function writeFixtureFile(filePath, content) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

async function prepareFixtures() {
  await rm('/tmp/apex-rt-empty', { recursive: true, force: true });
  await rm('/tmp/apex-rt-neutral', { recursive: true, force: true });
  await rm('/tmp/apex-rt-chain', { recursive: true, force: true });
  await rm('/tmp/apex-rt-mcpish', { recursive: true, force: true });
  await rm('/tmp/apex-rt-shell-conflict', { recursive: true, force: true });
  await rm('/tmp/apex-rt-visual', { recursive: true, force: true });

  await mkdir('/tmp/apex-rt-empty', { recursive: true });
  await writeFixtureFile('/tmp/apex-rt-neutral/notes.txt', 'neutral notes');
  await writeFixtureFile('/tmp/apex-rt-visual/notes.txt', 'brand refresh visual production');
  await writeFixtureFile('/tmp/apex-rt-chain/README.md', 'chain fixture');
  await writeFixtureFile('/tmp/apex-rt-chain/docs/ops/lifecycle-state.md', 'Current stage: S11 - complete\n');
  await writeFixtureFile('/tmp/apex-rt-chain/docs/gtm/readiness.md', 'GTM Decision: GO\n');
  await writeFixtureFile(
    '/tmp/apex-rt-mcpish/README.md',
    'An MCP server with plugin connectors, webhook handlers, and oauth support.',
  );
  await writeFixtureFile(
    '/tmp/apex-rt-mcpish/package.json',
    JSON.stringify({ name: 'x', dependencies: { '@modelcontextprotocol/sdk': '^1.0.0' } }),
  );
  await writeFixtureFile('/tmp/apex-rt-mcpish/pyproject.toml', '[project]\nname = "x"\n');
  await writeFixtureFile('/tmp/apex-rt-mcpish/tsconfig.json', '{}');
  await writeFixtureFile('/tmp/apex-rt-mcpish/src/index.ts', 'export {};\n');
  await writeFixtureFile('/tmp/apex-rt-shell-conflict/astro.config.mjs', 'export default {};\n');
  await writeFixtureFile('/tmp/apex-rt-shell-conflict/next.config.mjs', 'export default {};\n');
  await writeFixtureFile(
    '/tmp/apex-rt-shell-conflict/package.json',
    JSON.stringify({ dependencies: { astro: '^5.0.0', next: '^15.0.0', nuxt: '^4.0.0' } }),
  );
}

await prepareFixtures();

const probes = [
  {
    label: 'P-empty: empty dir, no goal',
    tool: 'route_prompt',
    args: { workspace_path: '/tmp/apex-rt-empty' },
    check: (p) =>
      p.body.selected_prompt.name === 'Application Development Lifecycle Master Prompt' &&
      p.body.selected_prompt.confidence === 'high' &&
      p.body.execution_contract.on_complete.next_trigger === 'GTM_READY',
    show: (p) =>
      `${p.body.selected_prompt.name} | ${p.body.selected_prompt.confidence} ${p.body.selected_prompt.confidence_score}/100 | next=${p.body.execution_contract.on_complete.next_trigger}`,
  },
  {
    label: 'P1: product page goal (was Release 68/100)',
    tool: 'route_prompt',
    args: { workspace_path: '/tmp/apex-rt-neutral', user_goal: 'build the product page for the new pricing tier' },
    check: (p) => p.body.selected_prompt.name !== 'Production Release Deploy Prompt',
    show: (p) =>
      `${p.body.selected_prompt.name} | ${p.body.selected_prompt.confidence} ${p.body.selected_prompt.confidence_score}/100`,
  },
  {
    label: 'P2: gtm tracking setup (was GTM Readiness)',
    tool: 'route_prompt',
    args: { workspace_path: '/tmp/apex-rt-neutral', user_goal: 'prepare gtm tracking setup' },
    check: (p) => p.body.selected_prompt.name === 'Analytics & Reporting',
    show: (p) =>
      `${p.body.selected_prompt.name} | ${p.body.selected_prompt.confidence} ${p.body.selected_prompt.confidence_score}/100`,
  },
  {
    label: 'P3: paid ads goal in empty dir (was Bootstrap 100/100)',
    tool: 'route_prompt',
    args: { workspace_path: '/tmp/apex-rt-empty', user_goal: 'plan a paid ads campaign for a Calgary HVAC client' },
    check: (p) =>
      p.body.selected_prompt.name === 'Paid Advertising' &&
      JSON.stringify(p.body.selected_prompt.composition) ===
        JSON.stringify(['Universal Intake Contract', 'Paid Advertising']) &&
      !p.body.prompt_text.includes('[SERVICE]'),
    show: (p) =>
      `${p.body.selected_prompt.name} | composition=${p.body.selected_prompt.composition.join(' + ')}`,
  },
  {
    label: 'P4: nonexistent path (was Bootstrap 100/100)',
    tool: 'route_prompt',
    args: { workspace_path: '/tmp/apex-rt-nonexistent-zzz', user_goal: 'anything' },
    check: (p) => p.isError === true && p.body.code === 'WORKSPACE_NOT_FOUND',
    show: (p) => `isError=${p.isError} code=${p.body.code}`,
  },
  {
    label: 'P5: MCP-ish repo, no goal (was MCP Tool 100/100)',
    tool: 'route_prompt',
    args: { workspace_path: '/tmp/apex-rt-mcpish' },
    check: (p) =>
      p.body.selected_prompt.name === 'Existing Codebase Onboarding Prompt' &&
      p.body.selected_prompt.confidence !== 'high',
    show: (p) =>
      `${p.body.selected_prompt.name} | ${p.body.selected_prompt.confidence} ${p.body.selected_prompt.confidence_score}/100`,
  },
  {
    label: 'P-chain: lifecycle complete + GTM GO',
    tool: 'route_prompt',
    args: { workspace_path: '/tmp/apex-rt-chain' },
    check: (p) =>
      p.body.selected_prompt.name === 'Account Growth System' &&
      p.body.execution_contract.on_complete.chain_complete === true,
    show: (p) =>
      `${p.body.selected_prompt.name} | signals=${p.body.selected_prompt.matched_signals.join(',')} | chain_complete=${p.body.execution_contract.on_complete.chain_complete}`,
  },
  {
    label: 'P6: public brand site stack policy',
    tool: 'route_prompt',
    args: {
      workspace_path: '/tmp/apex-rt-empty',
      user_goal: 'build a public brand site with Astro, React components, R3F, GSAP, Tailwind, Sanity, and Stripe',
    },
    check: (p) =>
      p.body.metadata.response_contract_version === '0.4' &&
      p.body.metadata.package_version === '0.4.1' &&
      p.body.selected_prompt.name === 'Web Design & Development' &&
      p.body.stack_recommendation.site_type === 'public_brand_site' &&
      p.body.stack_recommendation.primary_shell === 'Astro',
    show: (p) =>
      `${p.body.selected_prompt.name} | contract=${p.body.metadata.response_contract_version} package=${p.body.metadata.package_version} stack=${p.body.stack_recommendation.primary_shell}`,
  },
  {
    label: 'P7: app/SaaS stack policy + aliases',
    tool: 'route_prompt',
    args: {
      workspace_path: '/tmp/apex-rt-empty',
      user_goal: 'build a SaaS app with Next.js, R3F, Superbase, Postgres, Prisma, Redis, Docker, and Kubernetes',
    },
    check: (p) =>
      p.body.selected_prompt.name === 'Application Development Lifecycle Master Prompt' &&
      p.body.stack_recommendation.site_type === 'app_saas' &&
      p.body.stack_recommendation.primary_shell === 'Next.js' &&
      p.body.stack_recommendation.optional_addons.includes('Supabase') &&
      p.body.stack_recommendation.optional_addons.includes('PostgreSQL'),
    show: (p) =>
      `${p.body.selected_prompt.name} | stack=${p.body.stack_recommendation.primary_shell} addons=${p.body.stack_recommendation.optional_addons.join(',')}`,
  },
  {
    label: 'P8: visual generation routes to Prompt 3',
    tool: 'route_prompt',
    args: {
      workspace_path: '/tmp/apex-rt-visual',
      user_goal:
        'create branded wireframes, mockups, image prompts, and video concepts using gpt-image-2, Nano Banana Pro, and Higglefield',
    },
    check: (p) =>
      p.body.selected_prompt.name === 'Prompt 3 Ultimate Design Research Mockup Brief' &&
      p.body.selected_prompt.confidence === 'high' &&
      p.body.prompt_text.includes('GENERATION_PROMPT_PACK') &&
      p.body.prompt_text.includes('tool lane +') &&
      p.body.prompt_text.includes('paid generation or publish'),
    show: (p) =>
      `${p.body.selected_prompt.name} | ${p.body.selected_prompt.confidence} ${p.body.selected_prompt.confidence_score}/100`,
  },
  {
    label: 'P9: compound goal returns multi-prompt chain',
    tool: 'route_prompt',
    args: {
      workspace_path: '/tmp/apex-rt-empty',
      user_goal: 'build a new app with branded mockups, wireframes, and go to market readiness',
    },
    check: (p) =>
      p.body.selected_prompt.name === 'Application Development Lifecycle Master Prompt' &&
      p.body.execution_contract.multi_prompt_required === true &&
      p.body.selected_prompts.map((prompt) => prompt.name).join('|') ===
        [
          'Application Development Lifecycle Master Prompt',
          'Prompt 3 Ultimate Design Research Mockup Brief',
          'Go To Market Readiness Prompt',
        ].join('|') &&
      p.body.multi_prompt_text.includes('# Apex Multi-Prompt Execution Chain'),
    show: (p) =>
      `${p.body.selected_prompts.map((prompt) => prompt.name).join(' -> ')} | multi=${p.body.execution_contract.multi_prompt_required}`,
  },
  {
    label: 'P10: multi-shell conflict is machine-readable',
    tool: 'route_prompt',
    args: {
      workspace_path: '/tmp/apex-rt-shell-conflict',
      user_goal: 'inspect this frontend setup',
    },
    check: (p) =>
      p.body.stack_recommendation.conflicts.length === 1 &&
      p.body.stack_recommendation.conflicts[0].shells.includes('Astro') &&
      p.body.stack_recommendation.conflicts[0].shells.includes('Next.js') &&
      p.body.stack_recommendation.conflicts[0].shells.includes('Nuxt') &&
      p.body.warnings.join('\n').includes('Stack shell conflict detected'),
    show: (p) =>
      `conflicts=${p.body.stack_recommendation.conflicts[0]?.shells.join('+') ?? 'none'} warnings=${p.body.warnings.length}`,
  },
  {
    label: 'P-health: reconciliation',
    tool: 'prompt_router_health',
    args: {},
    check: (p) =>
      p.body.ok === true &&
      p.body.routing.routes_resolved === p.body.routing.routes_total &&
      p.body.routing.missing_route_prompts.length === 0 &&
      p.body.routing.unrouted_prompts.length === 0,
    show: (p) =>
      `ok=${p.body.ok} prompts=${p.body.library.prompt_count} routes=${p.body.routing.routes_resolved}/${p.body.routing.routes_total} missing=${p.body.routing.missing_route_prompts.length} unrouted=${p.body.routing.unrouted_prompts.length} version=${p.body.server.version}`,
  },
];

let failures = 0;
try {
  const lifecycleStderr = await closesAfterStdinEof();
  if (!lifecycleStderr.includes('library ok [structured]')) {
    throw new Error(`startup did not report structured mode; stderr: ${lifecycleStderr}`);
  }
  console.log('PASS  P-lifecycle: structured server closes on stdin EOF');
} catch (error) {
  failures += 1;
  console.log(`FAIL  P-lifecycle: stdin EOF closes the server\n      ${error.message}`);
}
for (const probe of probes) {
  try {
    const result = await callTool(probe.tool, probe.args);
    const p = payload(result);
    const ok = probe.check(p);
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${probe.label}\n      ${probe.show(p)}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL  ${probe.label}\n      ${error.message}`);
  }
}
console.log(failures === 0 ? '\nSMOKE: ALL PASS' : `\nSMOKE: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
