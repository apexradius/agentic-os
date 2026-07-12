import { describe, expect, it } from 'vitest';

import {
  assessConfidence,
  buildOnComplete,
  buildStackConflicts,
  buildStackRecommendation,
  composePromptText,
  detectStack,
  detectPrimaryShells,
  isSensitivePath,
  keywordMatcher,
  needsIntakeContract,
  parsePromptLibrary,
  QUALITY,
  ROUTES,
  scoreRoutes,
  selectRoute,
  UNROUTED_ALLOWED,
  type PromptEntry,
  type RouteScore,
  type WorkspaceScan,
} from '../src/lib.js';

function makeScan(partial: Partial<WorkspaceScan> = {}): WorkspaceScan {
  return {
    workspace_path: '/tmp/fake-project',
    exists: true,
    empty_workspace: false,
    file_count: 0,
    file_paths: [],
    important_files: [],
    git_status: null,
    detected_stack: [],
    lifecycle_stage: null,
    lifecycle_complete: false,
    gtm_decision: null,
    warnings: [],
    ...partial,
  };
}

function makeRouteScore(partial: Partial<RouteScore>): RouteScore {
  return {
    prompt_name: 'X',
    trigger: 'X_RUN',
    reason: 'test',
    score: 0,
    best_quality: QUALITY.PRIOR,
    matched_signals: [],
    ...partial,
  };
}

describe('parsePromptLibrary', () => {
  it('parses a basic section', () => {
    const { prompts, warnings } = parsePromptLibrary(
      '## My Prompt\n\n```text\nDo the thing.\n```\n',
    );
    expect(warnings).toEqual([]);
    expect(prompts).toHaveLength(1);
    expect(prompts[0]!.name).toBe('My Prompt');
    expect(prompts[0]!.text).toBe('Do the thing.');
  });

  it('tolerates description lines between heading and fence', () => {
    const { prompts } = parsePromptLibrary(
      '## My Prompt\n\nUse this when debugging.\nSecond description line.\n\n```text\nBody\n```\n',
    );
    expect(prompts).toHaveLength(1);
    expect(prompts[0]!.text).toBe('Body');
  });

  it('keeps ## sub-headers inside fences as prompt content, not new sections', () => {
    const { prompts } = parsePromptLibrary(
      '## Outer\n\n```text\nIntro\n\n## Intake Gate\n\nAsk questions.\n```\n\n## Next\n\n```text\nOther\n```\n',
    );
    expect(prompts.map((p) => p.name)).toEqual(['Outer', 'Next']);
    expect(prompts[0]!.text).toContain('## Intake Gate');
  });

  it('does not close a fence on an indented ``` line', () => {
    const { prompts, warnings } = parsePromptLibrary(
      '## Outer\n\n```text\nbefore\n   ```\nafter\n```\n',
    );
    expect(warnings).toEqual([]);
    expect(prompts[0]!.text).toContain('after');
  });

  it('warns and keeps partial text on an unbalanced fence at EOF', () => {
    const { prompts, warnings } = parsePromptLibrary('## Broken\n\n```text\nNever closed\n');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Broken');
    expect(prompts).toHaveLength(1);
    expect(prompts[0]!.text).toBe('Never closed');
  });

  it('normalizes CRLF', () => {
    const { prompts } = parsePromptLibrary('## A\r\n\r\n```text\r\nBody\r\n```\r\n');
    expect(prompts[0]!.text).toBe('Body');
  });

  it('skips a heading with too many description lines before a fence', () => {
    const filler = 'line\n'.repeat(6);
    const { prompts } = parsePromptLibrary(`## Not A Prompt\n\n${filler}\n\`\`\`text\nBody\n\`\`\`\n`);
    expect(prompts).toHaveLength(0);
  });
});

describe('keywordMatcher boundaries', () => {
  it("matches 'prod' as a word but never inside 'product' or 'production'", () => {
    const m = keywordMatcher('prod');
    expect(m.test('deploy to prod now')).toBe(true);
    expect(m.test('build the product page')).toBe(false);
    expect(m.test('production rollout')).toBe(false);
  });

  it("matches 'ship' but not 'shipping'", () => {
    const m = keywordMatcher('ship');
    expect(m.test('ship it today')).toBe(true);
    expect(m.test('shipping label flow')).toBe(false);
  });

  it("matches 'gtm' only as a standalone token", () => {
    const m = keywordMatcher('gtm');
    expect(m.test('set up gtm for the site')).toBe(true);
    expect(m.test('gtm4 something')).toBe(false);
  });

  it('handles trailing non-alphanumeric keywords like "pr #"', () => {
    const m = keywordMatcher('pr #');
    expect(m.test('merge pr #42')).toBe(true);
    expect(m.test('april #hashtag')).toBe(false);
  });

  it('treats hyphens as separators in phrases', () => {
    const m = keywordMatcher('go to market');
    expect(m.test('our go-to-market plan')).toBe(true);
    expect(m.test('go to market readiness')).toBe(true);
  });

  it('matches dotted keywords exactly', () => {
    const m = keywordMatcher('claude.md');
    expect(m.test('write claude.md first')).toBe(true);
    expect(m.test('claude.mdx file')).toBe(false);
  });
});

describe('scoreRoutes', () => {
  it("'product page' routes to Shopify-class intent, never Release via 'prod' substring", () => {
    const scores = scoreRoutes(ROUTES, 'build the product page for the new pricing tier', '', makeScan());
    const release = scores.find((s) => s.trigger === 'RELEASE_RUN');
    expect(scores[0]!.trigger).toBe('SHOPIFY_STOREFRONT_RUN');
    expect(release?.score ?? 0).toBe(0);
  });

  it("'gtm tracking setup' routes to Analytics, not GTM readiness", () => {
    const scores = scoreRoutes(ROUTES, 'prepare gtm tracking setup', '', makeScan());
    expect(scores[0]!.trigger).toBe('ANALYTICS_RUN');
    const gtmReady = scores.find((s) => s.trigger === 'GTM_READY');
    expect(gtmReady?.score ?? 0).toBe(0);
  });

  it('deploy verification wording routes to production deploy verify', () => {
    const scores = scoreRoutes(
      ROUTES,
      'deploy target=web-api with verification_contract against production',
      '',
      makeScan(),
    );
    expect(scores[0]!.trigger).toBe('PRODUCTION_DEPLOY_VERIFY');
    expect(scores[0]!.matched_signals).toEqual(
      expect.arrayContaining(['deploy target=', 'verification_contract']),
    );
  });

  it('focused GTM blocker wording routes to the focused slice prompt', () => {
    const scores = scoreRoutes(
      ROUTES,
      'take this app repo to gtm ready with one focused goal: fix the public funnel blocker',
      '',
      makeScan(),
    );
    expect(scores[0]!.trigger).toBe('FOCUSED_GTM_SLICE');
    expect(scores[0]!.matched_signals).toContain('gtm ready with one focused goal');
  });

  it('plain GTM readiness wording still routes to readiness', () => {
    const scores = scoreRoutes(ROUTES, 'run gtm readiness for this app', '', makeScan());
    expect(scores[0]!.trigger).toBe('GTM_READY');
    const focused = scores.find((s) => s.trigger === 'FOCUSED_GTM_SLICE');
    expect(focused?.score ?? 0).toBe(0);
  });

  it('public brand site intent routes to Web Design & Development', () => {
    const scores = scoreRoutes(
      ROUTES,
      'build a public brand site with Astro, React components, R3F, GSAP, Tailwind, Sanity, and Stripe',
      '',
      makeScan(),
    );
    expect(scores[0]!.trigger).toBe('WEB_BUILD');
  });

  it('app/SaaS intent routes to the application lifecycle prompt', () => {
    const scores = scoreRoutes(
      ROUTES,
      'build a SaaS app with Next.js, React, R3F, GSAP, Tailwind, Stripe, Prisma, and PostgreSQL',
      '',
      makeScan(),
    );
    expect(scores[0]!.trigger).toBe('S0_BOOTSTRAP');
  });

  it('visual generation tools route to Prompt 3 design research/mockup', () => {
    const scores = scoreRoutes(
      ROUTES,
      'generate branded wireframes, video concepts, and mockups using gpt-image-2, Nano Banana Pro, and Higglefield',
      '',
      makeScan(),
    );
    expect(scores[0]!.trigger).toBe('DESIGN_RESEARCH_MOCKUP');
    expect(scores[0]!.matched_signals).toEqual(
      expect.arrayContaining([
        'wireframes',
        'video concepts',
        'mockups',
        'gpt-image-2',
        'nano banana pro',
        'higglefield',
      ]),
    );
  });

  it('explicit goal beats the empty-workspace prior', () => {
    const scores = scoreRoutes(
      ROUTES,
      'plan a paid ads campaign for a calgary hvac client',
      '',
      makeScan({ empty_workspace: true }),
    );
    expect(scores[0]!.trigger).toBe('PAID_ADS_PLAN');
    const master = scores.find((s) => s.trigger === 'S0_BOOTSTRAP');
    expect(master!.score).toBeLessThan(scores[0]!.score);
  });

  it('empty workspace with no goal selects the master prompt decisively', () => {
    const scores = scoreRoutes(ROUTES, '', '', makeScan({ empty_workspace: true, file_count: 0 }));
    expect(scores[0]!.trigger).toBe('S0_BOOTSTRAP');
    expect(scores[0]!.score).toBeGreaterThanOrEqual(45);
    expect(scores[0]!.best_quality).toBe(QUALITY.STATE);
  });

  it('workspace evidence is suppressed for routes that did not match a stated goal', () => {
    const stuffedReadme =
      'deploy release production rollback ship staging preflight pull request merge readiness required checks ci green branch protection github actions';
    const scores = scoreRoutes(
      ROUTES,
      'fix the login bug',
      stuffedReadme,
      makeScan({ file_paths: ['readme.md'], file_count: 1 }),
    );
    expect(scores[0]!.trigger).toBe('DEBUG_LOOP');
    const release = scores.find((s) => s.trigger === 'RELEASE_RUN');
    expect(release?.score ?? 0).toBe(0);
  });

  it('content keywords are capped so a stuffed README cannot dominate without intent', () => {
    const stuffedReadme =
      'deploy release production rollback ship staging preflight pull request merge readiness required checks ci green branch protection github actions';
    const scores = scoreRoutes(
      ROUTES,
      '',
      stuffedReadme,
      makeScan({ file_paths: ['readme.md'], file_count: 1 }),
    );
    const release = scores.find((s) => s.trigger === 'RELEASE_RUN');
    expect(release!.score).toBeLessThanOrEqual(6);
    expect(scores[0]!.trigger).toBe('ONBOARD_REPO');
  });

  it('lifecycle in progress pins the master prompt with a STATE signal', () => {
    const scores = scoreRoutes(ROUTES, '', '', makeScan({ lifecycle_stage: 'S7', file_count: 3 }));
    expect(scores[0]!.trigger).toBe('S0_BOOTSTRAP');
    expect(scores[0]!.matched_signals).toContain('lifecycle:S7');
  });

  it('lifecycle complete hands off to GTM readiness', () => {
    const scores = scoreRoutes(
      ROUTES,
      '',
      '',
      makeScan({ lifecycle_stage: 'S11', lifecycle_complete: true, file_count: 3 }),
    );
    expect(scores[0]!.trigger).toBe('GTM_READY');
  });

  it('GTM GO decision hands off to Account Growth', () => {
    const scores = scoreRoutes(
      ROUTES,
      '',
      '',
      makeScan({ lifecycle_stage: 'S11', lifecycle_complete: true, gtm_decision: 'go', file_count: 3 }),
    );
    expect(scores[0]!.trigger).toBe('ACCOUNT_GROWTH_RUN');
  });

  it('GTM CONDITIONAL keeps routing to GTM readiness for the repair loop', () => {
    const scores = scoreRoutes(
      ROUTES,
      '',
      '',
      makeScan({ lifecycle_complete: true, gtm_decision: 'conditional', file_count: 3 }),
    );
    expect(scores[0]!.trigger).toBe('GTM_READY');
    expect(scores[0]!.matched_signals).toContain('gtm:conditional');
  });

  it('explicit debugging intent beats lifecycle-complete chain state', () => {
    const scores = scoreRoutes(
      ROUTES,
      'fix the login bug on the client portal',
      '',
      makeScan({ lifecycle_stage: 'S11', lifecycle_complete: true, file_count: 3 }),
      { userGoalText: 'fix the login bug on the client portal' },
    );
    expect(scores[0]!.trigger).toBe('DEBUG_LOOP');
    const gtmReady = scores.find((s) => s.trigger === 'GTM_READY');
    expect(gtmReady?.score ?? 0).toBe(0);
  });

  it('explicit outage intent beats GTM GO chain state', () => {
    const scores = scoreRoutes(
      ROUTES,
      'debug the production outage',
      '',
      makeScan({ lifecycle_complete: true, gtm_decision: 'go', file_count: 3 }),
      { userGoalText: 'debug the production outage' },
    );
    expect(scores[0]!.trigger).toBe('INCIDENT_RUN');
    const accountGrowth = scores.find((s) => s.trigger === 'ACCOUNT_GROWTH_RUN');
    expect(accountGrowth?.score ?? 0).toBe(0);
  });

  it('explicit lifecycle continuation still accepts chain state', () => {
    const scores = scoreRoutes(
      ROUTES,
      'continue the lifecycle from current stage',
      '',
      makeScan({ lifecycle_stage: 'S4', file_count: 3 }),
      { userGoalText: 'continue the lifecycle from current stage' },
    );
    expect(scores[0]!.trigger).toBe('S0_BOOTSTRAP');
    expect(scores[0]!.matched_signals).toContain('lifecycle:S4');
  });
});

describe('assessConfidence', () => {
  it('single primary word match is medium, not low', () => {
    const top = makeRouteScore({ score: 6, best_quality: QUALITY.PRIMARY_WORD });
    const second = makeRouteScore({ score: 4 });
    expect(assessConfidence(top, second).confidence).toBe('medium');
  });

  it('content-only evidence can never reach high', () => {
    const top = makeRouteScore({ score: 40, best_quality: QUALITY.CONTENT });
    expect(assessConfidence(top, undefined).confidence).toBe('medium');
  });

  it('prior-only evidence is low', () => {
    const top = makeRouteScore({ score: 12, best_quality: QUALITY.PRIOR });
    expect(assessConfidence(top, undefined).confidence).toBe('low');
  });

  it('state evidence with a strong score is high', () => {
    const top = makeRouteScore({ score: 30, best_quality: QUALITY.STATE });
    expect(assessConfidence(top, makeRouteScore({ score: 10 })).confidence).toBe('high');
  });

  it('a close margin blocks high even with strong intent', () => {
    const top = makeRouteScore({ score: 18, best_quality: QUALITY.PRIMARY_PHRASE });
    const second = makeRouteScore({ score: 16 });
    expect(assessConfidence(top, second).confidence).toBe('medium');
  });
});

describe('selectRoute fallback', () => {
  it('falls back to onboarding at low confidence when nothing matches', () => {
    const selection = selectRoute([], makeScan({ file_count: 2 }));
    expect(selection.fallback).toBe(true);
    expect(selection.route.trigger).toBe('ONBOARD_REPO');
    expect(selection.confidence).toBe('low');
  });

  it('rewrites the master prompt trigger to NEXT_GATE when resuming a lifecycle', () => {
    const scores = scoreRoutes(ROUTES, '', '', makeScan({ lifecycle_stage: 'S4', file_count: 3 }));
    const selection = selectRoute(scores, makeScan({ lifecycle_stage: 'S4', file_count: 3 }));
    expect(selection.route.trigger).toBe('S0_BOOTSTRAP');
    expect(selection.next_trigger).toBe('NEXT_GATE');
  });
});

describe('composition', () => {
  const intake: PromptEntry = {
    name: 'Universal Intake Contract',
    slug: 'universal-intake-contract',
    text: 'You are running intake for [SERVICE].\nCollect the brief for [SERVICE].',
  };
  const bare: PromptEntry = { name: 'Paid Advertising', slug: 'paid-advertising', text: 'Plan the ads.' };
  const gated: PromptEntry = {
    name: 'Security Review Prompt',
    slug: 'security-review-prompt',
    text: '## Intake Gate\n\nAsk first.\n\nThen review.',
  };

  it('prepends the intake contract with [SERVICE] substituted for gate-less prompts', () => {
    const composed = composePromptText(bare, [intake, bare]);
    expect(composed.composition).toEqual(['Universal Intake Contract', 'Paid Advertising']);
    expect(composed.text).toContain('intake for Paid Advertising');
    expect(composed.text).not.toContain('[SERVICE]');
    expect(composed.text.endsWith('Plan the ads.')).toBe(true);
  });

  it('leaves prompts with their own Intake Gate unchanged', () => {
    expect(needsIntakeContract(gated)).toBe(false);
    const composed = composePromptText(gated, [intake, gated]);
    expect(composed.composition).toEqual(['Security Review Prompt']);
    expect(composed.text).toBe(gated.text);
  });

  it('never composes the intake contract with itself', () => {
    expect(needsIntakeContract(intake)).toBe(false);
  });
});

describe('chain table', () => {
  it('master prompt chains to GTM readiness', () => {
    const onComplete = buildOnComplete('S0_BOOTSTRAP');
    expect(onComplete.chain_complete).toBe(false);
    expect(onComplete.next_trigger).toBe('GTM_READY');
  });

  it('GTM readiness chains to account growth', () => {
    expect(buildOnComplete('GTM_READY').next_trigger).toBe('ACCOUNT_GROWTH_RUN');
  });

  it('account growth completes the chain', () => {
    const onComplete = buildOnComplete('ACCOUNT_GROWTH_RUN');
    expect(onComplete.chain_complete).toBe(true);
    expect(onComplete.next_trigger).toBeNull();
  });

  it('service prompts without a chain entry are chain-complete', () => {
    expect(buildOnComplete('DEBUG_LOOP').chain_complete).toBe(true);
  });
});

describe('guards and stack detection', () => {
  it('flags key material and credential files as sensitive', () => {
    expect(isSensitivePath('.env')).toBe(true);
    expect(isSensitivePath('.env.local')).toBe(true);
    expect(isSensitivePath('.env.example')).toBe(false);
    expect(isSensitivePath('keys/id_ed25519')).toBe(true);
    expect(isSensitivePath('.npmrc')).toBe(true);
    expect(isSensitivePath('certs/server.pem')).toBe(true);
    expect(isSensitivePath('ci/firebase-adminsdk.json')).toBe(true);
    expect(isSensitivePath('src/index.ts')).toBe(false);
  });

  it('detects typescript from a top-level src directory', () => {
    expect(detectStack(['src/index.ts', 'package.json'])).toContain('typescript');
  });

  it('detects the approved frontend stack vocabulary from manifests', () => {
    const stack = detectStack(
      [
        'package.json',
        'tsconfig.json',
        'next.config.mjs',
        'astro.config.mjs',
        'vite.config.ts',
        'tailwind.config.ts',
        'prisma/schema.prisma',
        'Dockerfile',
        'k8s/deployment.yaml',
      ],
      JSON.stringify({
        dependencies: {
          '@react-three/fiber': '^9.0.0',
          '@sanity/client': '^6.0.0',
          '@supabase/supabase-js': '^2.0.0',
          cloudinary: '^2.0.0',
          gsap: '^3.0.0',
          next: '^15.0.0',
          prisma: '^6.0.0',
          react: '^19.0.0',
          redis: '^4.0.0',
          stripe: '^18.0.0',
          three: '^0.170.0',
        },
      }),
    );
    expect(stack).toEqual(
      expect.arrayContaining([
        'astro',
        'cloudinary',
        'docker',
        'frontend',
        'gsap',
        'kubernetes',
        'nextjs',
        'node',
        'prisma',
        'react',
        'react-three-fiber',
        'redis',
        'sanity',
        'stripe',
        'supabase',
        'tailwind',
        'threejs',
        'typescript',
        'vite',
      ]),
    );
  });

  it('detects primary shell conflicts across frontend shells', () => {
    expect(detectPrimaryShells(['astro', 'nextjs', 'nuxt'])).toEqual(['Astro', 'Next.js', 'Nuxt']);
    const conflicts = buildStackConflicts(['astro', 'nextjs', 'nuxt']);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.shells).toEqual(['Astro', 'Next.js', 'Nuxt']);
  });

  it('builds a public-site stack recommendation with alias and typo normalization', () => {
    const recommendation = buildStackRecommendation(
      makeScan({ detected_stack: [] }),
      'build a public brand site with Astro, R3F, Superbase, Postgres, Netlify, and Vercel',
      undefined,
      'WEB_BUILD',
    );
    expect(recommendation.site_type).toBe('public_brand_site');
    expect(recommendation.primary_shell).toBe('Astro');
    expect(recommendation.core_stack).toContain('React Three Fiber');
    expect(recommendation.optional_addons).toEqual(expect.arrayContaining(['Netlify', 'Vercel']));
    expect(recommendation.aliases_matched).toEqual(
      expect.arrayContaining(['astro', 'netlify', 'postgres', 'r3f', 'superbase', 'vercel']),
    );
  });

  it('builds an app/SaaS recommendation with Next.js and data add-ons', () => {
    const recommendation = buildStackRecommendation(
      makeScan({ detected_stack: ['nextjs', 'postgresql', 'supabase'] }),
      'build a SaaS app with Next.js, Supabase, PostgreSQL, Prisma, Redis, Docker, and Kubernetes',
      undefined,
      'S0_BOOTSTRAP',
    );
    expect(recommendation.site_type).toBe('app_saas');
    expect(recommendation.primary_shell).toBe('Next.js');
    expect(recommendation.core_stack).toContain('Stripe');
    expect(recommendation.optional_addons).toEqual(
      expect.arrayContaining(['Docker', 'Kubernetes', 'PostgreSQL', 'Prisma', 'Redis', 'Supabase']),
    );
  });

  it('route table has no duplicate triggers or prompt names', () => {
    const triggers = ROUTES.map((route) => route.trigger);
    const names = ROUTES.map((route) => route.promptName);
    expect(new Set(triggers).size).toBe(triggers.length);
    expect(new Set(names).size).toBe(names.length);
    expect(UNROUTED_ALLOWED.has('Universal Intake Contract')).toBe(true);
  });

  it('every static route selects itself when invoked by its exact trigger', () => {
    for (const route of ROUTES) {
      const scores = scoreRoutes(ROUTES, route.trigger.toLowerCase(), '', makeScan(), {
        userGoalText: route.trigger,
      });
      expect(scores[0]?.prompt_name, route.trigger).toBe(route.promptName);
    }
  });
});
