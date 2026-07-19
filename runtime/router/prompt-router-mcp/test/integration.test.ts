import { existsSync, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  InvalidWorkspaceError,
  readPromptLibrary,
  resolveRoutes,
  scanWorkspace,
} from '../src/lib.js';
import { buildHealthReport, loadEffectiveRoutes, routePromptCore } from '../src/router.js';

const LIBRARY_PATH =
  process.env['APEX_PROMPT_LIBRARY_PATH'] ?? path.join(os.homedir(), 'prompt-library.md');
const hasLibrary = existsSync(LIBRARY_PATH);
const STRUCTURED_LIBRARY_PATH = path.resolve(
  process.cwd(),
  '../../../..',
  'apex/config/prompt-router/library/index.generated.md',
);

const tmpDirs: string[] = [];

async function makeWorkspace(files: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-router-test-'));
  tmpDirs.push(dir);
  for (const [relPath, content] of Object.entries(files)) {
    const target = path.join(dir, relPath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf8');
  }
  return dir;
}

afterAll(async () => {
  await Promise.all(tmpDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

function route(workspacePath: string, userGoal?: string, sessionSummary?: string) {
  return routePromptCore({
    workspacePath,
    libraryPath: LIBRARY_PATH,
    userGoal,
    sessionSummary,
    maxFiles: 300,
    maxDepth: 5,
    maxReadBytes: 12000,
  });
}

describe('workspace scanner', () => {
  it('treats an empty directory as an empty workspace', async () => {
    const dir = await makeWorkspace({});
    const scan = await scanWorkspace(dir, 300, 5, 12000);
    expect(scan.empty_workspace).toBe(true);
    expect(scan.file_count).toBe(0);
  });

  it('rejects filesystem and home roots', async () => {
    await expect(scanWorkspace('/', 300, 5, 12000)).rejects.toBeInstanceOf(InvalidWorkspaceError);
    await expect(scanWorkspace(os.homedir(), 300, 5, 12000)).rejects.toBeInstanceOf(
      InvalidWorkspaceError,
    );
    await expect(scanWorkspace('/tmp', 300, 5, 12000)).rejects.toBeInstanceOf(
      InvalidWorkspaceError,
    );
  });

  it('raises WORKSPACE_NOT_FOUND for a nonexistent path instead of empty-workspace routing', async () => {
    await expect(
      scanWorkspace('/tmp/definitely-not-here-zzz', 300, 5, 12000),
    ).rejects.toMatchObject({
      code: 'WORKSPACE_NOT_FOUND',
    });
  });

  it('skips sensitive files but reads .env.example', async () => {
    const dir = await makeWorkspace({
      '.env': 'SECRET=1',
      '.env.example': 'SECRET=',
      id_ed25519: 'key',
      'readme.md': 'hello',
    });
    const scan = await scanWorkspace(dir, 300, 5, 12000);
    expect(scan.file_paths).not.toContain('.env');
    expect(scan.file_paths).not.toContain('id_ed25519');
    expect(scan.important_files.map((f) => f.path)).toContain('.env.example');
  });

  it('reads lifecycle state even when the walk cap starves the docs directory', async () => {
    const filler: Record<string, string> = {};
    for (let i = 0; i < 40; i += 1) filler[`0file-${String(i).padStart(2, '0')}.txt`] = 'x';
    filler['docs/ops/lifecycle-state.md'] = '# State\n\nCurrent stage: S7\n';
    const dir = await makeWorkspace(filler);
    const scan = await scanWorkspace(dir, 20, 5, 12000);
    expect(scan.warnings.join('\n')).toContain('max_files=20');
    expect(scan.lifecycle_stage).toBe('S7');
    expect(scan.file_paths).toContain('docs/ops/lifecycle-state.md');
  });

  it('extracts the GTM decision from docs/gtm/readiness.md', async () => {
    const dir = await makeWorkspace({
      'docs/gtm/readiness.md': '# GTM\n\nGTM Decision: GO\n',
    });
    const scan = await scanWorkspace(dir, 300, 5, 12000);
    expect(scan.gtm_decision).toBe('go');
  });

  it('warns when multiple primary frontend shells are configured', async () => {
    const dir = await makeWorkspace({
      'astro.config.mjs': 'export default {};',
      'next.config.mjs': 'export default {};',
      'package.json': JSON.stringify({
        dependencies: { astro: '^5.0.0', next: '^15.0.0', nuxt: '^4.0.0' },
      }),
    });
    const scan = await scanWorkspace(dir, 300, 5, 12000);
    expect(scan.detected_stack).toEqual(expect.arrayContaining(['astro', 'nextjs', 'nuxt']));
    expect(scan.warnings.join('\n')).toContain('Stack shell conflict detected');
  });
});

describe.runIf(hasLibrary)('real library reconciliation', () => {
  it('every route resolves to a parsed prompt and every prompt is routed (or allowlisted)', async () => {
    const { prompts, warnings } = await readPromptLibrary(LIBRARY_PATH);
    const routes = await loadEffectiveRoutes(LIBRARY_PATH);
    const resolution = resolveRoutes(prompts, routes);
    expect(warnings).toEqual([]);
    expect(resolution.missing_route_prompts).toEqual([]);
    expect(resolution.unrouted_prompts).toEqual([]);
  });

  it('health reports ok', async () => {
    const report = await buildHealthReport(
      'apex-prompt-router-mcp',
      '0.4.1',
      LIBRARY_PATH,
      os.homedir(),
    );
    expect(report.ok).toBe(true);
    expect(report.library.prompt_count).toBeGreaterThanOrEqual(30);
  });
});

describe.runIf(existsSync(STRUCTURED_LIBRARY_PATH))('structured Prompt OS health', () => {
  it('includes read-only proof coverage when capabilities.json is present', async () => {
    const report = await buildHealthReport(
      'apex-prompt-router-mcp',
      '0.4.1',
      STRUCTURED_LIBRARY_PATH,
      os.homedir(),
    );
    expect(report.ok).toBe(true);
    expect(report.prompt_os.capability_index_readable).toBe(true);
    expect(report.prompt_os.proof_summary?.records).toBeGreaterThanOrEqual(30);
    expect(report.prompt_os.proof_summary?.high_risk_missing).toBe(0);
  });
});

describe.runIf(hasLibrary)('review-probe regressions (end to end)', () => {
  it('P1: "build the product page" never routes to Production Release Deploy', async () => {
    const dir = await makeWorkspace({ 'notes.txt': 'meeting notes from tuesday' });
    const res = await route(dir, 'build the product page for the new pricing tier');
    expect(res.selected_prompt.name).not.toBe('Production Release Deploy Prompt');
    expect(res.selected_prompt.name).toBe('Shopify Theme / Storefront');
    expect(res.selected_prompt.confidence).toBe('medium');
    expect(res.alternatives.map((a) => a.prompt_name)).toContain('Feature Slice Build Prompt');
  });

  it('P2: "gtm tracking setup" routes to Analytics & Reporting, not GTM readiness', async () => {
    const dir = await makeWorkspace({ 'notes.txt': 'meeting notes' });
    const res = await route(dir, 'prepare gtm tracking setup');
    expect(res.selected_prompt.name).toBe('Analytics & Reporting');
  });

  it('P2b: focused GTM blocker language routes to Focused GTM Slice', async () => {
    const dir = await makeWorkspace({ 'notes.txt': 'app repo with a public funnel blocker' });
    const res = await route(
      dir,
      'take this app repo to gtm ready with one focused goal: resolve the public funnel blocker',
    );
    expect(res.selected_prompt.name).toBe('Focused GTM Slice Prompt');
    expect(res.selected_prompt.next_trigger).toBe('FOCUSED_GTM_SLICE');
  });

  it('P2c: readiness-only GTM language still routes to GTM readiness', async () => {
    const dir = await makeWorkspace({ 'notes.txt': 'launch packet and scorecard' });
    const res = await route(dir, 'run gtm readiness for this app');
    expect(res.selected_prompt.name).toBe('Go To Market Readiness Prompt');
  });

  it('P3: explicit service goal in an empty folder beats the bootstrap prior', async () => {
    const dir = await makeWorkspace({});
    const res = await route(dir, 'plan a paid ads campaign for a Calgary HVAC client');
    expect(res.selected_prompt.name).toBe('Paid Advertising');
    expect(res.selected_prompt.confidence).toBe('medium');
    const master = res.alternatives.find(
      (a) => a.prompt_name === 'Application Development Lifecycle Master Prompt',
    );
    expect(master?.raw_signal_score ?? 0).toBeLessThan(res.selected_prompt.raw_signal_score);
  });

  it('P4: a nonexistent workspace is an error, not a 100/100 bootstrap', async () => {
    await expect(route('/tmp/nonexistent-path-zzz', 'anything')).rejects.toMatchObject({
      code: 'WORKSPACE_NOT_FOUND',
    });
  });

  it('P5: a goal-less scan of an MCP-ish repo onboards at honest confidence instead of MCP high', async () => {
    const dir = await makeWorkspace({
      'README.md': 'An MCP server with plugin connectors, webhook handlers, and oauth support.',
      'package.json': JSON.stringify({
        name: 'x',
        dependencies: { '@modelcontextprotocol/sdk': '^1.0.0' },
      }),
      'pyproject.toml': '[project]\nname = "x"\n',
      'tsconfig.json': '{}',
      'src/index.ts': 'export {};',
    });
    const res = await route(dir);
    expect(res.selected_prompt.name).toBe('Existing Codebase Onboarding Prompt');
    expect(res.selected_prompt.confidence).toBe('medium');
    expect(res.alternatives.map((a) => a.prompt_name)).toContain('MCP Tool Integration Prompt');
  });

  it('P6: public brand site stack intent routes to Web Design & Development', async () => {
    const dir = await makeWorkspace({ 'notes.txt': 'new client brand site' });
    const res = await route(
      dir,
      'build a public brand site with Astro, React components, R3F, GSAP, Tailwind, Sanity, and Stripe',
    );
    expect(res.selected_prompt.name).toBe('Web Design & Development');
    expect(res.selected_prompt.confidence).not.toBe('low');
    expect(res.metadata.response_contract_version).toBe('0.4');
    expect(res.metadata.package_version).toBe('0.4.1');
    expect(res.stack_recommendation).toMatchObject({
      site_type: 'public_brand_site',
      primary_shell: 'Astro',
    });
    expect(res.stack_recommendation.core_stack).toContain('Astro');
  });

  it('P7: app/SaaS stack intent routes to Application Development Lifecycle', async () => {
    const dir = await makeWorkspace({});
    const res = await route(
      dir,
      'build a SaaS app with Next.js, React, R3F, GSAP, Tailwind, Stripe, Prisma, and PostgreSQL',
    );
    expect(res.selected_prompt.name).toBe('Application Development Lifecycle Master Prompt');
    expect(res.selected_prompt.confidence).toBe('high');
    expect(res.stack_recommendation).toMatchObject({
      site_type: 'app_saas',
      primary_shell: 'Next.js',
    });
    expect(res.stack_recommendation.core_stack).toContain('Stripe');
  });

  it('P8: visual generation tool request routes to Prompt 3', async () => {
    const dir = await makeWorkspace({ 'notes.txt': 'brand refresh visual production' });
    const res = await route(
      dir,
      'create branded wireframes, mockups, image prompts, and video concepts using gpt-image-2, Nano Banana Pro, and Higglefield',
    );
    expect(res.selected_prompt.name).toBe('Prompt 3 Ultimate Design Research Mockup Brief');
    expect(res.selected_prompt.confidence).toBe('high');
    expect(res.prompt_text).toContain('GENERATION_PROMPT_PACK');
    expect(res.prompt_text).toContain('generation prompt pack');
    expect(res.prompt_text).toContain('paid image/video generation');
    expect(res.selected_prompts).toHaveLength(1);
    expect(res.execution_contract.multi_prompt_required).toBe(false);
  });

  it('P9: compound goals return an ordered multi-prompt chain', async () => {
    const dir = await makeWorkspace({});
    const res = await route(
      dir,
      'build a new app with branded mockups, wireframes, and go to market readiness',
    );
    expect(res.selected_prompt.name).toBe('Application Development Lifecycle Master Prompt');
    expect(res.execution_contract.multi_prompt_required).toBe(true);
    expect(res.selected_prompts.map((prompt) => prompt.name)).toEqual([
      'Application Development Lifecycle Master Prompt',
      'Prompt 3 Ultimate Design Research Mockup Brief',
      'Go To Market Readiness Prompt',
    ]);
    expect(res.execution_contract.prompt_sequence.map((prompt) => prompt.trigger)).toEqual([
      'S0_BOOTSTRAP',
      'DESIGN_RESEARCH_MOCKUP',
      'GTM_READY',
    ]);
    expect(res.execution_contract.on_complete.next_trigger).toBe('ACCOUNT_GROWTH_RUN');
    expect(res.multi_prompt_text).toContain('# Apex Multi-Prompt Execution Chain');
    expect(res.multi_prompt_text).toContain(
      '## Prompt 2: Prompt 3 Ultimate Design Research Mockup Brief',
    );
    expect(res.activation_message).toContain('Multi-prompt chain selected (3)');
  });
});

describe.runIf(hasLibrary)('chain spine (empty → GTM → growth)', () => {
  it('empty folder, no goal: master prompt at high confidence with a GTM hand-off', async () => {
    const dir = await makeWorkspace({});
    const res = await route(dir);
    expect(res.selected_prompt.name).toBe('Application Development Lifecycle Master Prompt');
    expect(res.selected_prompt.confidence).toBe('high');
    expect(res.execution_contract.activation_required).toBe(true);
    expect(res.execution_contract.on_complete.chain_complete).toBe(false);
    expect(res.execution_contract.on_complete.next_trigger).toBe('GTM_READY');
  });

  it('lifecycle in progress resumes the master prompt via NEXT_GATE', async () => {
    const dir = await makeWorkspace({
      'README.md': 'project',
      'docs/ops/lifecycle-state.md': '# State\n\nCurrent stage: S7\nNotes: build slice in flight\n',
    });
    const res = await route(dir);
    expect(res.selected_prompt.name).toBe('Application Development Lifecycle Master Prompt');
    expect(res.selected_prompt.next_trigger).toBe('NEXT_GATE');
    expect(res.selected_prompt.confidence).toBe('high');
    expect(res.scan_summary.lifecycle_stage).toBe('S7');
  });

  it('lifecycle complete routes to GTM readiness', async () => {
    const dir = await makeWorkspace({
      'README.md': 'project',
      'docs/ops/lifecycle-state.md': '# State\n\nCurrent stage: S11 — complete\n',
    });
    const res = await route(dir);
    expect(res.selected_prompt.name).toBe('Go To Market Readiness Prompt');
    expect(res.execution_contract.on_complete.next_trigger).toBe('ACCOUNT_GROWTH_RUN');
  });

  it('GTM GO decision routes to Account Growth and completes the chain', async () => {
    const dir = await makeWorkspace({
      'README.md': 'project',
      'docs/ops/lifecycle-state.md': '# State\n\nCurrent stage: S11 — complete\n',
      'docs/gtm/readiness.md': '# Readiness\n\nGTM Decision: GO\n',
    });
    const res = await route(dir);
    expect(res.selected_prompt.name).toBe('Account Growth System');
    expect(res.execution_contract.on_complete.chain_complete).toBe(true);
  });

  it('GTM CONDITIONAL stays in the readiness repair loop', async () => {
    const dir = await makeWorkspace({
      'README.md': 'project',
      'docs/ops/lifecycle-state.md': '# State\n\nCurrent stage: S11 — complete\n',
      'docs/gtm/readiness.md': '# Readiness\n\nGTM Decision: CONDITIONAL\n',
    });
    const res = await route(dir);
    expect(res.selected_prompt.name).toBe('Go To Market Readiness Prompt');
  });

  it('fresh debugging goal overrides lifecycle-complete chain state', async () => {
    const dir = await makeWorkspace({
      'README.md': 'project',
      'docs/ops/lifecycle-state.md': '# State\n\nCurrent stage: S11 — complete\n',
    });
    const res = await route(dir, 'fix the login bug on the client portal');
    expect(res.selected_prompt.name).toBe('Root Cause Debugging Prompt');
    expect(res.selected_prompt.matched_signals).toContain('bug');
  });

  it('fresh outage goal overrides GTM GO chain state', async () => {
    const dir = await makeWorkspace({
      'README.md': 'project',
      'docs/ops/lifecycle-state.md': '# State\n\nCurrent stage: S11 — complete\n',
      'docs/gtm/readiness.md': '# Readiness\n\nGTM Decision: GO\n',
    });
    const res = await route(dir, 'debug the production outage');
    expect(res.selected_prompt.name).toBe('Incident Recovery Prompt');
    expect(res.selected_prompt.matched_signals).toContain('outage');
  });

  it('service prompts are composed with the Universal Intake Contract', async () => {
    const dir = await makeWorkspace({});
    const res = await route(dir, 'plan a paid ads campaign for a client');
    expect(res.selected_prompt.composition).toEqual([
      'Universal Intake Contract',
      'Paid Advertising',
    ]);
    expect(res.prompt_text).not.toContain('[SERVICE]');
    expect(res.prompt_text).toContain('Paid Advertising');
  });

  it('low-confidence routing demands operator confirmation instead of activating', async () => {
    const dir = await makeWorkspace({ 'data.bin': 'x', 'misc.txt': 'y' });
    const res = await route(dir);
    expect(res.selected_prompt.confidence).toBe('low');
    expect(res.execution_contract.activation_required).toBe(false);
    expect(res.execution_contract.operator_confirmation_required).toBe(true);
    expect(res.activation_message).toContain('confirm');
  });
});
