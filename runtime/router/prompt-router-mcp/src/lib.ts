import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PromptEntry = {
  name: string;
  slug: string;
  text: string;
  /** Declarative composition: ordered list of block ids to prepend before this prompt's text.
   * Populated only in structured mode (parsed from front-matter). Undefined in monolith mode.
   */
  includes?: string[];
};

export type ParsedLibrary = {
  prompts: PromptEntry[];
  warnings: string[];
};

export type ImportantFile = {
  path: string;
  bytes: number;
  text: string;
};

export type WorkspaceScan = {
  workspace_path: string;
  exists: boolean;
  empty_workspace: boolean;
  file_count: number;
  file_paths: string[];
  important_files: ImportantFile[];
  git_status: string | null;
  detected_stack: string[];
  lifecycle_stage: string | null;
  lifecycle_complete: boolean;
  gtm_decision: 'go' | 'conditional' | 'no_go' | null;
  warnings: string[];
};

export type StackSiteType = 'public_brand_site' | 'app_saas' | 'commerce_storefront' | 'unknown';

export type StackConflict = {
  type: 'multiple_primary_shells';
  shells: string[];
  recommendation: string;
};

export type StackRecommendation = {
  policy_version: string;
  site_type: StackSiteType;
  primary_shell: string | null;
  core_stack: string[];
  optional_addons: string[];
  conflicts: StackConflict[];
  aliases_matched: string[];
  reason: string;
};

export type RouteDefinition = {
  promptName: string;
  trigger: string;
  reason: string;
  keywords: string[];
  fileHints?: string[];
  stackHints?: string[];
  emptyWorkspace?: boolean;
  existingWorkspace?: boolean;
  chainNext?: { trigger: string; when: string } | null;
};

// Signal quality ranks. Higher = more trustworthy evidence for activation.
export const QUALITY = {
  PRIOR: 0,
  CONTENT: 1,
  FILE_HINT: 2,
  PRIMARY_WORD: 3,
  PRIMARY_PHRASE: 4,
  STATE: 5,
} as const;

export type Quality = (typeof QUALITY)[keyof typeof QUALITY];

export type RouteScore = {
  prompt_name: string;
  trigger: string;
  reason: string;
  score: number;
  best_quality: Quality;
  matched_signals: string[];
};

export type Selection = {
  route: RouteScore;
  confidence: 'high' | 'medium' | 'low';
  confidence_score: number;
  margin: number;
  next_trigger: string;
  fallback: boolean;
};

export type RouteResolution = {
  resolved: RouteDefinition[];
  missing_route_prompts: string[];
  unrouted_prompts: string[];
};

type FileRecord = {
  absolutePath: string;
  relativePath: string;
};

export class WorkspaceNotFoundError extends Error {
  readonly code = 'WORKSPACE_NOT_FOUND';
}

export class InvalidWorkspaceError extends Error {
  readonly code = 'INVALID_WORKSPACE';
}

// ---------------------------------------------------------------------------
// Scoring weights. Invariant: explicit user intent must always be able to beat
// workspace-derived evidence — see scoreRoutes() and the regression tests.
// ---------------------------------------------------------------------------

export const WEIGHTS = {
  STATE: 30,
  PRIMARY_PHRASE: 9,
  PRIMARY_WORD: 6,
  FILE_HINT: 4,
  STACK_HINT: 4,
  CONTENT: 2,
  CONTENT_CAP: 6,
  EMPTY_DECISIVE: 45,
  EMPTY_REINFORCE: 20,
  EMPTY_FALLBACK: 4,
  EXISTING_NO_INTENT: 12,
  EXISTING_WITH_INTENT: 4,
} as const;

// Library sections that are intentionally not routable: composition elements,
// assembly documentation, and loop engineering fragments (Phase 3).
export const UNROUTED_ALLOWED = new Set([
  'Universal Intake Contract',
  'Copy Patterns',
  // Loop block fragments (library/loops/*.md) — composition-only, not executable prompts
  'Loop Contract',
  'Plan-Implement-Verify',
  'Planner-Generator-Evaluator',
  'Reflexion',
  'Ralph Pattern',
]);

export const INTAKE_CONTRACT_NAME = 'Universal Intake Contract';

const INTAKE_GATE_MARKER = '## Intake Gate';

export const STACK_POLICY_VERSION = 'stack-policy-2026-06-11.v1';

// ---------------------------------------------------------------------------
// Route table. Single source of truth for routing; reconciled against the
// library at startup and in health (resolveRoutes).
// ---------------------------------------------------------------------------

export const ROUTES: RouteDefinition[] = [
  {
    promptName: 'Application Development Lifecycle Master Prompt',
    trigger: 'S0_BOOTSTRAP',
    reason: 'Use when starting an application from an empty folder or driving the staged product lifecycle.',
    emptyWorkspace: true,
    chainNext: { trigger: 'GTM_READY', when: 'after S11_OPERATE passes its exit gate' },
    keywords: [
      'empty folder',
      'new app',
      'new project',
      'new application',
      'saas',
      'saas app',
      'app/saas',
      'application shell',
      'next.js app',
      'stripe app',
      'application development',
      'product development lifecycle',
      'build an app',
      'build the folder environment',
      'from scratch',
      'greenfield',
      'vision',
      'mission',
      'bootstrap',
      's0_bootstrap',
      'next_gate',
      'full_run',
      'lifecycle',
      'claude.md',
      'agents.md',
      'agent.md',
    ],
    fileHints: ['docs/ops/lifecycle-plan.md', 'docs/ops/lifecycle-state.md'],
  },
  {
    promptName: 'Incident Recovery Prompt',
    trigger: 'INCIDENT_RUN',
    reason: 'Use when production is down, degraded, or revenue flow is interrupted.',
    keywords: [
      'incident',
      'outage',
      'production down',
      'site down',
      'app down',
      'degraded',
      '500',
      '502',
      '503',
      'health check failing',
      'leads stopped',
      'orders stopped',
      'urgent recovery',
    ],
  },
  {
    promptName: 'Root Cause Debugging Prompt',
    trigger: 'DEBUG_LOOP',
    reason: 'Use when the task is to reproduce, diagnose, and fix a failure.',
    keywords: [
      'bug',
      'debug',
      'broken',
      'error',
      'failing',
      'failure',
      'traceback',
      'exception',
      'regression',
      'root cause',
      'does not work',
      'not working',
      'crash',
    ],
  },
  {
    promptName: 'Production Release Deploy Prompt',
    trigger: 'RELEASE_RUN',
    reason: 'Use when preparing, shipping, or verifying a release.',
    keywords: [
      'deploy',
      'deployment',
      'release',
      'staging',
      'production',
      'prod',
      'rollback',
      'roll back',
      'preflight',
      'ship',
      'launch to prod',
      'pr #',
      'pull request',
      'merge readiness',
      'merge decision',
      'required checks',
      'checks green',
      'ci running',
      'ci green',
      'ci complete',
      'security scanners',
      'branch protection',
      'workflow_dispatch',
      'github actions',
    ],
    fileHints: ['docs/release/release-plan.md'],
  },
  {
    promptName: 'Security Review Prompt',
    trigger: 'SECURITY_REVIEW',
    reason: 'Use for threat modeling, auth, permissions, secrets, or secure-code review.',
    keywords: [
      'security',
      'auth',
      'authorization',
      'permission',
      'secret',
      'token',
      'credential',
      'owasp',
      'xss',
      'sql injection',
      'csrf',
      'vulnerability',
      'hardcoded secret',
      'threat model',
    ],
    fileHints: ['docs/security/review.md'],
  },
  {
    promptName: 'Refactor Migration Prompt',
    trigger: 'MIGRATION_RUN',
    reason: 'Use for refactors, schema changes, framework changes, or structural migrations.',
    keywords: [
      'refactor',
      'migration',
      'migrate',
      'schema change',
      'rename',
      'restructure',
      'framework upgrade',
      'move files',
      'modular monolith',
    ],
  },
  {
    promptName: 'QA Test Strategy Prompt',
    trigger: 'QA_PLAN',
    reason: 'Use when the main deliverable is test strategy, regression coverage, or quality gates.',
    keywords: [
      'qa',
      'test plan',
      'test strategy',
      'tests',
      'coverage',
      'regression suite',
      'playwright',
      'e2e',
      'unit test',
      'integration test',
      'acceptance test',
    ],
  },
  {
    promptName: 'MCP Tool Integration Prompt',
    trigger: 'MCP_TOOL_RUN',
    reason: 'Use for MCP servers, plugins, APIs, webhooks, OAuth, and tool integrations.',
    keywords: [
      'mcp',
      'mcp server',
      'mcp tool',
      'plugin',
      'connector',
      'api integration',
      'webhook',
      'oauth',
      'stdio',
      'json-rpc',
      'server tool',
      'agent tool',
      'tool integration',
      'tool call',
      'prompt router',
      'codex app',
      'codex prompt',
      'custom prompt',
      'slash command',
      '/prompts',
      'skill',
      'skills',
      'entrypoint',
      'activate prompt',
      'prompt loop',
      'initialize command',
    ],
    fileHints: ['package.json', 'tsconfig.json'],
    stackHints: ['mcp'],
  },
  {
    promptName: 'Feature Slice Build Prompt',
    trigger: 'BUILD_SLICE',
    reason: 'Use when implementing one concrete feature, endpoint, workflow, or UI slice.',
    keywords: [
      'feature',
      'build',
      'implement',
      'add endpoint',
      'add page',
      'add ui',
      'workflow',
      'screen',
      'form',
      'button',
      'component',
      'ui slice',
    ],
  },
  {
    promptName: 'Existing Codebase Onboarding Prompt',
    trigger: 'ONBOARD_REPO',
    reason: 'Use when entering an existing repository and needing orientation before first safe action.',
    existingWorkspace: true,
    keywords: [
      'existing codebase',
      'existing repo',
      'scan codebase',
      'understand codebase',
      'onboard',
      'orientation',
      'what is this',
      'where are we',
      'next steps',
    ],
    fileHints: ['readme.md', 'package.json', 'pyproject.toml', 'go.mod', 'cargo.toml'],
  },
  {
    promptName: 'Agent Handoff Resume Prompt',
    trigger: 'HANDOFF_RESUME',
    reason: 'Use when packaging a handoff between agents/sessions or resuming from one.',
    keywords: [
      'handoff',
      'hand off',
      'handover',
      'resume',
      'pick up where',
      'continue the session',
      'context reset',
      'compaction',
      'session handoff',
    ],
    fileHints: ['docs/handoff/current.md'],
  },
  {
    promptName: 'Go To Market Readiness Prompt',
    trigger: 'GTM_READY',
    reason: 'Use for launch readiness, channel plan, sales enablement, and market entry checks.',
    chainNext: { trigger: 'ACCOUNT_GROWTH_RUN', when: 'after a GO decision in docs/gtm/readiness.md' },
    keywords: [
      'go to market',
      'gtm readiness',
      'gtm launch',
      'gtm ready',
      'market readiness',
      'launch readiness',
      'go/no-go',
      'waitlist',
      'beta launch',
      'sales enablement',
      'pricing page',
      'product hunt',
      'launch plan',
      'market entry',
    ],
    fileHints: ['docs/gtm/readiness.md'],
  },
  {
    promptName: 'Prompt 3 Ultimate Design Research Mockup Brief',
    trigger: 'DESIGN_RESEARCH_MOCKUP',
    reason: 'Use for design research, branded mockups, wireframes, and UI exploration.',
    keywords: [
      'mockup',
      'mockups',
      'mock up',
      'wireframe',
      'wireframes',
      'wire frame',
      'branded mockups',
      'image generation',
      'generate images',
      'image gen',
      'image gen 2',
      'gpt-image-2',
      'chatgpt images 2.0',
      'image prompts',
      'video generation',
      'generate video',
      'ai video',
      'video concepts',
      'video prompts',
      'visual asset',
      'visual assets',
      'storyboard',
      'storyboards',
      'shot list',
      'shot lists',
      'nano banana',
      'nano banana pro',
      'gemini-3-pro-image',
      'higgsfield',
      'higglefield',
      'dribbble',
      'pinterest',
      'figma',
      'look and feel',
      'ui design',
      'design research',
      'design inspiration',
    ],
  },
  {
    promptName: 'Brand & UI Design System',
    trigger: 'BRAND_SYSTEM',
    reason: 'Use for brand identity, design tokens, and reusable UI design systems.',
    keywords: [
      'brand',
      'branding',
      'brand identity',
      'design system',
      'design tokens',
      'color palette',
      'typography',
      'visual identity',
      'style guide',
    ],
  },
  {
    promptName: 'Web Design & Development',
    trigger: 'WEB_BUILD',
    reason: 'Use for website strategy, page design, site builds, and launch handoff.',
    keywords: [
      'website',
      'web design',
      'web development',
      'landing page',
      'site build',
      'site redesign',
      'homepage',
      'marketing site',
      'public site',
      'public website',
      'brand site',
      'brand website',
      'public brand site',
      'astro',
      'astro site',
      'webflow',
      'custom js',
    ],
  },
  {
    promptName: 'Paid Advertising',
    trigger: 'PAID_ADS_PLAN',
    reason: 'Use for Google, Meta, LinkedIn, or other paid acquisition planning.',
    keywords: ['paid ads', 'google ads', 'meta ads', 'facebook ads', 'linkedin ads', 'ad campaign', 'ppc'],
  },
  {
    promptName: 'SEO & Content',
    trigger: 'SEO_CONTENT_PLAN',
    reason: 'Use for search visibility, rankings, content strategy, and AI citation growth.',
    keywords: ['seo', 'content', 'rankings', 'search visibility', 'blog', 'editorial', 'ai citation'],
  },
  {
    promptName: 'Social Media Management',
    trigger: 'SOCIAL_RUN',
    reason: 'Use for social calendars, posting systems, comments, and community workflows.',
    keywords: ['social media', 'instagram', 'facebook', 'linkedin', 'tiktok', 'content calendar', 'community'],
  },
  {
    promptName: 'Reputation & Reviews',
    trigger: 'REPUTATION_RUN',
    reason: 'Use for review generation, review response, and reputation monitoring.',
    keywords: ['reviews', 'reputation', 'google reviews', 'sentiment', 'review response'],
  },
  {
    promptName: 'Marketing Automation',
    trigger: 'AUTOMATION_RUN',
    reason: 'Use for CRM workflows, lead nurture, and operational automations.',
    keywords: ['marketing automation', 'crm', 'nurture', 'follow up', 'workflow automation', 'zapier'],
  },
  {
    promptName: 'Analytics & Reporting',
    trigger: 'ANALYTICS_RUN',
    reason: 'Use for attribution, dashboards, reporting, GA4, Google Tag Manager, and review data.',
    keywords: [
      'analytics',
      'reporting',
      'dashboard',
      'ga4',
      'google tag manager',
      'gtm tags',
      'gtm container',
      'tag manager',
      'tracking setup',
      'conversion tracking',
      'attribution',
    ],
  },
  {
    promptName: 'Lead Generation Funnel',
    trigger: 'LEAD_FUNNEL_RUN',
    reason: 'Use for qualified booked opportunities, funnel design, qualification, and conversion flow.',
    keywords: ['lead generation', 'lead funnel', 'qualified leads', 'booked calls', 'conversion funnel'],
  },
  {
    promptName: 'Growth Ops System',
    trigger: 'GROWTH_OPS_RUN',
    reason: 'Use for growth operations spanning intake, automation, and reporting.',
    keywords: ['growth ops', 'growth operations', 'growth engine', 'intake automation', 'operations automation'],
  },
  {
    promptName: 'AI Voice Agent',
    trigger: 'VOICE_AGENT_RUN',
    reason: 'Use for phone agents, receptionists, call qualification, and voice workflows.',
    keywords: [
      'voice agent',
      'phone agent',
      'receptionist',
      'call qualification',
      'phone calls',
      'inbound calls',
      'answering service',
      'ivr',
    ],
  },
  {
    promptName: 'Shopify Theme / Storefront',
    trigger: 'SHOPIFY_STOREFRONT_RUN',
    reason: 'Use for Shopify themes, storefronts, product pages, and commerce UX.',
    keywords: ['shopify', 'theme', 'storefront', 'product page', 'collection page', 'liquid'],
    stackHints: ['shopify'],
  },
  {
    promptName: 'Client Proposal / Scope',
    trigger: 'PROPOSAL_SCOPE_RUN',
    reason: 'Use for proposals, scopes of work, quotes, and client-ready engagement docs.',
    keywords: ['proposal', 'scope', 'sow', 'quote', 'contract', 'client brief'],
  },
  {
    promptName: 'Engagement Model Selector',
    trigger: 'ENGAGEMENT_MODEL',
    reason: 'Use to choose between managed retainer and fixed-scope engagement shapes.',
    chainNext: { trigger: 'ACCOUNT_GROWTH_RUN', when: 'after the engagement model is selected' },
    keywords: ['engagement model', 'retainer', 'managed retainer', 'one-and-done', 'one and done', 'fixed scope'],
  },
  {
    promptName: 'Account Growth System',
    trigger: 'ACCOUNT_GROWTH_RUN',
    reason: 'Use for full growth engagements spanning multiple Apex services.',
    keywords: ['growth system', 'growth engagement', 'full client growth', 'account growth'],
  },
];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function normalizeRelativePath(value: string): string {
  return value.split(path.sep).join('/').toLowerCase();
}

function assertAbsolutePath(value: string, fieldName: string): void {
  if (!path.isAbsolute(value)) {
    throw new InvalidWorkspaceError(`${fieldName} must be an absolute path`);
  }
}

// Workspace paths that must never be scanned. Scanning "/" or a home root is
// always a caller mistake (typo or missing workspace_path), never intent.
export function assertSafeWorkspacePath(value: string): string {
  assertAbsolutePath(value, 'workspace_path');
  const resolved = path.resolve(value);
  const forbidden = new Set([
    '/',
    os.homedir(),
    '/Users',
    '/System',
    '/Library',
    '/Applications',
    '/private',
    '/etc',
    '/var',
    '/opt',
    '/usr',
    '/bin',
    '/sbin',
    '/tmp',
    '/home',
  ]);
  const isHomeRoot = /^\/(Users|home)\/[^/]+$/.test(resolved);
  if (forbidden.has(resolved) || isHomeRoot) {
    throw new InvalidWorkspaceError(
      `workspace_path resolves to ${resolved}, which is a filesystem/home root — pass the project directory explicitly`,
    );
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Prompt library parser — fence-aware state machine.
// Tolerates description lines between the heading and the ```text fence and
// never mistakes a "## " line inside a fenced block for a section heading.
// ---------------------------------------------------------------------------

const MAX_DESCRIPTION_LINES = 4;

export function parsePromptLibrary(libraryText: string): ParsedLibrary {
  const lines = libraryText.replace(/\r\n/g, '\n').split('\n');
  const prompts: PromptEntry[] = [];
  const warnings: string[] = [];

  let state: 'outside' | 'awaiting' | 'inside' = 'outside';
  let candidate: string | null = null;
  let descriptionLines = 0;
  let capture: string[] = [];

  const closeCandidate = () => {
    candidate = null;
    descriptionLines = 0;
  };

  for (const line of lines) {
    if (state === 'inside') {
      if (line.trimEnd() === '```') {
        const text = capture.join('\n').trim();
        if (candidate && text) {
          prompts.push({ name: candidate, slug: slugify(candidate), text });
        }
        capture = [];
        closeCandidate();
        state = 'outside';
      } else {
        capture.push(line);
      }
      continue;
    }

    const headingMatch = /^## (.+)$/.exec(line);
    if (headingMatch) {
      candidate = headingMatch[1].trim();
      descriptionLines = 0;
      state = 'awaiting';
      continue;
    }

    if (state === 'awaiting') {
      if (line.trim() === '') continue;
      if (line.trimEnd().startsWith('```text')) {
        state = 'inside';
        capture = [];
        continue;
      }
      descriptionLines += 1;
      if (descriptionLines > MAX_DESCRIPTION_LINES) {
        closeCandidate();
        state = 'outside';
      }
    }
  }

  if (state === 'inside' && candidate) {
    warnings.push(`Unbalanced \`\`\` fence: section "${candidate}" never closed; partial text kept`);
    const text = capture.join('\n').trim();
    if (text) prompts.push({ name: candidate, slug: slugify(candidate), text });
  }

  return { prompts, warnings };
}

export async function readPromptLibrary(libraryPath: string): Promise<ParsedLibrary> {
  if (!path.isAbsolute(libraryPath)) {
    throw new Error('library_path must be an absolute path');
  }
  const libraryText = await fs.readFile(libraryPath, 'utf8');
  return parsePromptLibrary(libraryText);
}

// ---------------------------------------------------------------------------
// Library source resolution (OPT-IN structured read-path).
//
// Default behavior is UNCHANGED: with no env var and no explicit override, the
// router reads the Brain monolith at defaultLibraryPath exactly as before.
// Structured mode is opt-in ONLY, gated on BOTH:
//   APEX_PROMPT_LIBRARY_MODE === 'structured'  AND  library/index.generated.md exists.
// An explicit caller-supplied path always wins (preserves tool/test overrides).
// ---------------------------------------------------------------------------

// library/ lives at the package root, one level up from dist/lib.js (and from
// src/lib.ts under ts-node-style resolution). Resolve relative to this module.
export function packageLibraryDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', 'library');
}

export function structuredLibraryPath(): string {
  return path.join(packageLibraryDir(), 'index.generated.md');
}

/**
 * Resolve which library file the router should read.
 * - explicitPath (a caller override) always wins.
 * - else structured mode (env + generated file present) -> index.generated.md.
 * - else the monolith default path (unchanged live behavior).
 */
export function resolveLibraryPath(defaultLibraryPath: string, explicitPath?: string): string {
  if (explicitPath) return explicitPath;
  const mode = process.env['APEX_PROMPT_LIBRARY_MODE'];
  if (mode === 'structured') {
    const generated = structuredLibraryPath();
    if (existsSync(generated)) return generated;
  }
  return defaultLibraryPath;
}

/**
 * Load the prompt library in structured mode:
 * 1. Parse index.generated.md for prompt text (byte-identical with monolith mode).
 * 2. Overlay `includes` from index.json onto matching prompt entries (by slug).
 * 3. Append loop block entries from library/loops/*.md so composition can resolve them.
 *
 * Loop blocks are tagged with a sentinel slug prefix matching `loops/<stem>` so
 * composePromptText can find them. They are NOT routable — resolveRoutes will list them
 * as unrouted, but they are in UNROUTED_ALLOWED by virtue of being loop fragments
 * (callers must filter them when listing user-facing prompts if desired).
 */
async function loadLibraryStructured(generatedPath: string): Promise<ParsedLibrary & { source_path: string }> {
  // Step 1: parse the generated markdown (monolith-equivalent)
  const parsed = await readPromptLibrary(generatedPath);

  // Step 2: load index.json to get includes metadata
  const libraryDir = path.dirname(generatedPath);
  const indexPath = path.join(libraryDir, 'index.json');
  let indexBySlug = new Map<string, string[]>();
  try {
    const raw = await fs.readFile(indexPath, 'utf8');
    const records = JSON.parse(raw) as Array<{ slug: string; includes: string[] }>;
    if (Array.isArray(records)) {
      for (const rec of records) {
        if (rec.slug && Array.isArray(rec.includes)) {
          indexBySlug.set(rec.slug, rec.includes);
        }
      }
    }
  } catch {
    // index.json absent or unreadable — proceed without includes overlay
  }

  // Overlay includes onto parsed prompt entries
  const enriched: PromptEntry[] = parsed.prompts.map((entry) => {
    const inc = indexBySlug.get(entry.slug);
    if (inc !== undefined && inc.length > 0) {
      return { ...entry, includes: inc };
    }
    return entry;
  });

  // Step 3: load loop blocks and append
  const loopBlocks = await loadLoopBlocks(libraryDir);
  const allPrompts = [...enriched, ...loopBlocks];

  return { prompts: allPrompts, warnings: parsed.warnings, source_path: generatedPath };
}

/**
 * Load the prompt library honoring the opt-in structured read-path. Returns the
 * parsed library plus the path actually read (for diagnostics/tests).
 *
 * In structured mode: overlay includes from index.json and append loop blocks so
 * composePromptText can resolve declarative includes.
 */
export async function loadLibrary(
  defaultLibraryPath: string,
  explicitPath?: string,
): Promise<ParsedLibrary & { source_path: string }> {
  const source = resolveLibraryPath(defaultLibraryPath, explicitPath);
  const mode = process.env['APEX_PROMPT_LIBRARY_MODE'];
  if (mode === 'structured' && source === structuredLibraryPath()) {
    return loadLibraryStructured(source);
  }
  const parsed = await readPromptLibrary(source);
  return { ...parsed, source_path: source };
}

export function findPrompt(prompts: PromptEntry[], requestedName: string): PromptEntry | null {
  const requested = requestedName.trim().toLowerCase();
  const requestedSlug = slugify(requestedName);
  return (
    prompts.find((prompt) => prompt.name.toLowerCase() === requested) ??
    prompts.find((prompt) => prompt.slug === requestedSlug) ??
    null
  );
}

// Reconcile the route table against the parsed library. A route whose prompt
// is missing is excluded from scoring (loudly) instead of failing at selection.
export function resolveRoutes(prompts: PromptEntry[]): RouteResolution {
  const names = new Set(prompts.map((prompt) => prompt.name));
  const routedNames = new Set(ROUTES.map((route) => route.promptName));
  const missing = ROUTES.filter((route) => !names.has(route.promptName)).map((route) => route.promptName);
  const unrouted = prompts
    .map((prompt) => prompt.name)
    .filter((name) => !routedNames.has(name) && !UNROUTED_ALLOWED.has(name));
  return {
    resolved: ROUTES.filter((route) => names.has(route.promptName)),
    missing_route_prompts: missing,
    unrouted_prompts: unrouted,
  };
}

// ---------------------------------------------------------------------------
// Keyword matchers — boundary-aware, whitespace/hyphen tolerant.
// "prod" must match "push to prod" but never "product"; "go to market" must
// also match "go-to-market".
// ---------------------------------------------------------------------------

const matcherCache = new Map<string, RegExp>();

export function keywordMatcher(keyword: string): RegExp {
  const cached = matcherCache.get(keyword);
  if (cached) return cached;

  const normalized = keyword.toLowerCase().trim().replace(/\s+/g, ' ');
  const tokens = normalized.split(' ');
  const escaped = tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const body = escaped.join('[\\s\\-]+');

  const first = normalized.charAt(0);
  const last = normalized.charAt(normalized.length - 1);
  const lead = /[a-z0-9]/.test(first) ? '(?<![a-z0-9])' : '';
  const tail = /[a-z0-9]/.test(last) ? '(?![a-z0-9])' : '';

  const regex = new RegExp(`${lead}${body}${tail}`, 'i');
  matcherCache.set(keyword, regex);
  return regex;
}

export function isPhrase(keyword: string): boolean {
  return keyword.trim().split(/\s+/).length > 1;
}

// ---------------------------------------------------------------------------
// Sensitive paths and important files
// ---------------------------------------------------------------------------

const EXCLUDED_DIRS = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  'dist',
  'build',
  '.next',
  'coverage',
  'vendor',
  '.venv',
  'venv',
  '__pycache__',
  '.turbo',
  '.cache',
  '.pytest_cache',
  '.mypy_cache',
]);

export const IMPORTANT_EXACT_PATHS = new Set([
  'readme.md',
  'agents.md',
  'claude.md',
  'agent.md',
  'package.json',
  'pyproject.toml',
  'requirements.txt',
  'go.mod',
  'cargo.toml',
  'tsconfig.json',
  'vite.config.ts',
  'next.config.js',
  'next.config.mjs',
  'astro.config.mjs',
  'docs/ops/lifecycle-state.md',
  'docs/ops/lifecycle-plan.md',
  'docs/gtm/readiness.md',
  'docs/debug/root-cause.md',
  'docs/release/release-plan.md',
  'docs/security/review.md',
  'docs/handoff/current.md',
  '.env.example',
]);

const IMPORTANT_BASENAMES = new Set([
  'readme.md',
  'agents.md',
  'claude.md',
  'agent.md',
  'package.json',
  'pyproject.toml',
  'requirements.txt',
  'go.mod',
  'cargo.toml',
  'tsconfig.json',
  '.env.example',
]);

const MAX_IMPORTANT_FILES = 12;

const SENSITIVE_NEEDLES = [
  'secret',
  'secrets',
  'token',
  'credential',
  'credentials',
  'private-key',
  'private_key',
  'id_rsa',
  'id_ed25519',
  'id_ecdsa',
  'id_dsa',
  'service-account',
  'serviceaccount',
  'firebase-adminsdk',
  'apikey',
  'api-key',
  'api_key',
];

const SENSITIVE_BASENAMES = new Set(['.npmrc', '.netrc', '.pgpass', '.htpasswd']);

const SENSITIVE_EXTENSIONS = ['.pem', '.key', '.p12', '.pfx', '.p8', '.jks', '.keystore'];

export function isSensitivePath(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  const base = path.basename(normalized);

  if (base === '.env.example') return false;
  if (base === '.env' || base.startsWith('.env.')) return true;
  if (SENSITIVE_BASENAMES.has(base)) return true;
  if (SENSITIVE_EXTENSIONS.some((ext) => base.endsWith(ext))) return true;

  return SENSITIVE_NEEDLES.some((needle) => normalized.includes(needle));
}

export function isImportantPath(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  return IMPORTANT_EXACT_PATHS.has(normalized) || IMPORTANT_BASENAMES.has(path.basename(normalized));
}

// ---------------------------------------------------------------------------
// Workspace scanner — two passes.
// Pass A reads the known important paths directly so the file-count cap can
// never starve routing of manifests. Pass B is the bounded walk.
// ---------------------------------------------------------------------------

async function readImportantFile(
  absolutePath: string,
  relativePath: string,
  maxReadBytes: number,
  warnings: string[],
): Promise<ImportantFile | null> {
  try {
    const fileStat = await fs.stat(absolutePath);
    if (!fileStat.isFile()) return null;
    if (fileStat.size > Math.max(maxReadBytes * 4, 65536)) {
      warnings.push(`Skipped large important file: ${relativePath}`);
      return null;
    }
    const raw = await fs.readFile(absolutePath, 'utf8');
    const text = raw.slice(0, maxReadBytes);
    return { path: relativePath, bytes: Buffer.byteLength(text), text };
  } catch (error) {
    warnings.push(`Could not read important file ${relativePath}: ${errorMessage(error)}`);
    return null;
  }
}

async function walkWorkspace(
  rootPath: string,
  currentPath: string,
  depth: number,
  maxDepth: number,
  maxFiles: number,
  files: FileRecord[],
  warnings: string[],
  flags: { capWarned: boolean; depthWarned: boolean },
): Promise<void> {
  if (depth > maxDepth) {
    if (!flags.depthWarned) {
      warnings.push(`Directory scan stopped at max_depth=${maxDepth}`);
      flags.depthWarned = true;
    }
    return;
  }
  if (files.length >= maxFiles) return;

  let entries;
  try {
    entries = await fs.readdir(currentPath, { withFileTypes: true });
  } catch (error) {
    warnings.push(`Could not read ${path.relative(rootPath, currentPath) || '.'}: ${errorMessage(error)}`);
    return;
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (files.length >= maxFiles) {
      if (!flags.capWarned) {
        warnings.push(`File scan stopped at max_files=${maxFiles}`);
        flags.capWarned = true;
      }
      return;
    }

    const absolutePath = path.join(currentPath, entry.name);
    const relativePath = path.relative(rootPath, absolutePath);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name) || isSensitivePath(relativePath)) continue;
      await walkWorkspace(rootPath, absolutePath, depth + 1, maxDepth, maxFiles, files, warnings, flags);
      continue;
    }

    if (!entry.isFile()) continue;
    if (isSensitivePath(relativePath)) continue;

    files.push({ absolutePath, relativePath: normalizeRelativePath(relativePath) });
  }
}

function extractLifecycleState(importantFiles: ImportantFile[]): {
  stage: string | null;
  complete: boolean;
} {
  const stateFile = importantFiles.find((file) => file.path === 'docs/ops/lifecycle-state.md');
  if (!stateFile) return { stage: null, complete: false };
  const lineMatch = /current stage:\s*([^\n]*)/i.exec(stateFile.text);
  if (!lineMatch) return { stage: null, complete: false };
  const line = lineMatch[1];
  const stageMatch = /\bS(\d{1,2})\b/i.exec(line);
  const stageNum = stageMatch ? Number(stageMatch[1]) : null;
  const complete = /complete|released|done/i.test(line) || (stageNum !== null && stageNum >= 11);
  return { stage: stageNum !== null ? `S${stageNum}` : null, complete };
}

function extractGtmDecision(importantFiles: ImportantFile[]): WorkspaceScan['gtm_decision'] {
  const readiness = importantFiles.find((file) => file.path === 'docs/gtm/readiness.md');
  if (!readiness) return null;
  const match = /gtm decision:?\s*\**\s*(go|conditional|no[_-]go)\b/i.exec(readiness.text);
  if (!match) return null;
  const value = match[1].toLowerCase().replace('-', '_');
  return value as WorkspaceScan['gtm_decision'];
}

export function detectStack(filePaths: string[], importantText = ''): string[] {
  const stack = new Set<string>();
  const names = new Set(filePaths.map((filePath) => path.basename(filePath)));
  const joined = `${filePaths.join('\n')}\n${importantText.toLowerCase()}`;

  if (names.has('package.json')) stack.add('node');
  if (
    names.has('tsconfig.json') ||
    filePaths.some((p) => p.startsWith('src/') || p.includes('/src/') || p.endsWith('.ts') || p.endsWith('.tsx'))
  ) {
    stack.add('typescript');
  }
  if (
    names.has('vite.config.ts') ||
    names.has('next.config.js') ||
    names.has('next.config.mjs') ||
    names.has('astro.config.mjs')
  ) {
    stack.add('frontend');
  }
  if (names.has('next.config.js') || names.has('next.config.mjs') || /"next"\s*:/.test(joined)) stack.add('nextjs');
  if (names.has('astro.config.mjs') || /"astro"\s*:/.test(joined)) stack.add('astro');
  if (names.has('vite.config.ts') || /"vite"\s*:/.test(joined)) stack.add('vite');
  if (/"react"\s*:/.test(joined)) stack.add('react');
  if (/"@react-three\/fiber"\s*:/.test(joined)) stack.add('react-three-fiber');
  if (/"three"\s*:/.test(joined)) stack.add('threejs');
  if (/"gsap"\s*:/.test(joined)) stack.add('gsap');
  if (/"tailwindcss"\s*:/.test(joined) || filePaths.some((p) => p.includes('tailwind.config.'))) stack.add('tailwind');
  if (/"@sanity\/client"\s*:/.test(joined) || /"sanity"\s*:/.test(joined)) stack.add('sanity');
  if (/"stripe"\s*:/.test(joined)) stack.add('stripe');
  if (/"prisma"\s*:/.test(joined) || filePaths.some((p) => p.startsWith('prisma/'))) stack.add('prisma');
  if (/"@supabase\/supabase-js"\s*:/.test(joined)) stack.add('supabase');
  if (/"redis"\s*:/.test(joined) || /"ioredis"\s*:/.test(joined)) stack.add('redis');
  if (/"vue"\s*:/.test(joined)) stack.add('vue');
  if (/"nuxt"\s*:/.test(joined)) stack.add('nuxt');
  if (/"@sveltejs\/kit"\s*:/.test(joined) || /"sveltekit"\s*:/.test(joined)) stack.add('sveltekit');
  if (joined.includes('webflow')) stack.add('webflow');
  if (joined.includes('custom js') || joined.includes('vanilla js') || joined.includes('vanilla javascript')) {
    stack.add('custom_js');
  }
  if (/"cloudinary"\s*:/.test(joined)) stack.add('cloudinary');
  if (joined.includes('postgres') || joined.includes('postgresql')) stack.add('postgresql');
  if (filePaths.some((p) => path.basename(p).toLowerCase().startsWith('dockerfile')) || joined.includes('docker')) {
    stack.add('docker');
  }
  if (joined.includes('kubernetes') || filePaths.some((p) => p.startsWith('k8s/') || p.startsWith('kubernetes/'))) {
    stack.add('kubernetes');
  }
  if (names.has('pyproject.toml') || names.has('requirements.txt')) stack.add('python');
  if (names.has('go.mod')) stack.add('go');
  if (names.has('cargo.toml')) stack.add('rust');
  if (joined.includes('mcp') || joined.includes('modelcontextprotocol')) stack.add('mcp');
  if (joined.includes('shopify') || joined.includes('.liquid')) stack.add('shopify');
  if (joined.includes('playwright')) stack.add('playwright');

  return Array.from(stack).sort();
}

const PRIMARY_SHELLS = [
  { key: 'astro', label: 'Astro', aliases: ['astro', 'astro site'] },
  { key: 'nextjs', label: 'Next.js', aliases: ['next', 'next.js', 'nextjs', 'next app'] },
  { key: 'nuxt', label: 'Nuxt', aliases: ['nuxt', 'nuxt.js', 'nuxtjs'] },
  { key: 'sveltekit', label: 'SvelteKit', aliases: ['sveltekit', 'svelte kit', 'svelte app'] },
  { key: 'webflow', label: 'Webflow', aliases: ['webflow'] },
  { key: 'vite', label: 'Vite', aliases: ['vite', 'vite app'] },
  { key: 'custom_js', label: 'Custom JS', aliases: ['custom js', 'vanilla js', 'vanilla javascript'] },
] as const;

const STACK_ALIASES = [
  { canonical: 'Astro', aliases: ['astro', 'astro site'] },
  { canonical: 'Next.js', aliases: ['next', 'next.js', 'nextjs', 'next app'] },
  { canonical: 'React', aliases: ['react'] },
  { canonical: 'React components', aliases: ['react components', 'react component'] },
  { canonical: 'React Three Fiber', aliases: ['react three fiber', 'react-three-fiber', 'r3f', '@react-three/fiber'] },
  { canonical: 'Three.js', aliases: ['three.js', 'threejs', 'three'] },
  { canonical: 'GSAP', aliases: ['gsap'] },
  { canonical: 'Tailwind', aliases: ['tailwind', 'tailwindcss', 'tailwind css'] },
  { canonical: 'CSS', aliases: ['css'] },
  { canonical: 'HTML', aliases: ['html'] },
  { canonical: 'JavaScript', aliases: ['javascript'] },
  { canonical: 'TypeScript', aliases: ['typescript'] },
  { canonical: 'Sanity CMS', aliases: ['sanity', 'sanity cms', '@sanity/client'] },
  { canonical: 'Stripe', aliases: ['stripe'] },
  { canonical: 'Prisma', aliases: ['prisma'] },
  { canonical: 'PostgreSQL', aliases: ['postgresql', 'postgres'] },
  { canonical: 'Vite', aliases: ['vite'] },
  { canonical: 'Nuxt', aliases: ['nuxt', 'nuxt.js', 'nuxtjs'] },
  { canonical: 'Vue', aliases: ['vue', 'vue.js', 'vuejs'] },
  { canonical: 'SvelteKit', aliases: ['sveltekit', 'svelte kit'] },
  { canonical: 'Webflow', aliases: ['webflow'] },
  { canonical: 'Custom JS', aliases: ['custom js', 'vanilla js', 'vanilla javascript'] },
  { canonical: 'Cloudinary', aliases: ['cloudinary'] },
  { canonical: 'Supabase', aliases: ['supabase', 'superbase'] },
  { canonical: 'Redis', aliases: ['redis', 'ioredis'] },
  { canonical: 'Docker', aliases: ['docker', 'dockerfile'] },
  { canonical: 'Kubernetes', aliases: ['kubernetes', 'k8s'] },
  { canonical: 'Netlify', aliases: ['netlify'] },
  { canonical: 'Vercel', aliases: ['vercel'] },
] as const;

const STACK_KEY_LABELS = new Map<string, string>([
  ['astro', 'Astro'],
  ['nextjs', 'Next.js'],
  ['vite', 'Vite'],
  ['react', 'React'],
  ['react-three-fiber', 'React Three Fiber'],
  ['threejs', 'Three.js'],
  ['gsap', 'GSAP'],
  ['tailwind', 'Tailwind'],
  ['sanity', 'Sanity CMS'],
  ['stripe', 'Stripe'],
  ['prisma', 'Prisma'],
  ['supabase', 'Supabase'],
  ['redis', 'Redis'],
  ['vue', 'Vue'],
  ['nuxt', 'Nuxt'],
  ['sveltekit', 'SvelteKit'],
  ['cloudinary', 'Cloudinary'],
  ['postgresql', 'PostgreSQL'],
  ['docker', 'Docker'],
  ['kubernetes', 'Kubernetes'],
  ['typescript', 'TypeScript'],
  ['node', 'Node.js'],
  ['shopify', 'Shopify'],
]);

const PUBLIC_SITE_CORE_STACK = [
  'Astro',
  'React',
  'React components',
  'React Three Fiber',
  'Three.js',
  'GSAP',
  'Tailwind',
  'CSS',
];

const APP_SAAS_CORE_STACK = [
  'Next.js',
  'React',
  'React Three Fiber',
  'Three.js',
  'GSAP',
  'Tailwind',
  'CSS',
  'Stripe',
];

const SHOPIFY_CORE_STACK = ['Shopify', 'Liquid', 'CSS', 'JavaScript'];

const PUBLIC_SITE_OPTIONAL = new Set(['Sanity CMS', 'Stripe', 'Cloudinary', 'Netlify', 'Vercel']);
const APP_SAAS_OPTIONAL = new Set([
  'TypeScript',
  'Prisma',
  'PostgreSQL',
  'Supabase',
  'Redis',
  'Docker',
  'Kubernetes',
  'Cloudinary',
  'Vercel',
]);

function hasKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => keywordMatcher(keyword).test(text));
}

function collectStackAliases(text: string, detectedStack: string[]): { technologies: string[]; aliases: string[] } {
  const technologies = new Set<string>();
  const aliases = new Set<string>();

  for (const stackKey of detectedStack) {
    const label = STACK_KEY_LABELS.get(stackKey);
    if (label) technologies.add(label);
  }

  for (const entry of STACK_ALIASES) {
    for (const alias of entry.aliases) {
      if (!keywordMatcher(alias).test(text)) continue;
      technologies.add(entry.canonical);
      aliases.add(alias);
    }
  }

  return {
    technologies: Array.from(technologies).sort(),
    aliases: Array.from(aliases).sort(),
  };
}

export function detectPrimaryShells(detectedStack: string[], text = ''): string[] {
  const shells = new Set<string>();
  const haystack = text.toLowerCase();

  for (const shell of PRIMARY_SHELLS) {
    if (detectedStack.includes(shell.key)) {
      shells.add(shell.label);
      continue;
    }
    if (hasKeyword(haystack, [...shell.aliases])) shells.add(shell.label);
  }

  return PRIMARY_SHELLS.map((shell) => shell.label).filter((label) => shells.has(label));
}

export function buildStackConflicts(detectedStack: string[], text = ''): StackConflict[] {
  const shells = detectPrimaryShells(detectedStack, text);
  if (shells.length <= 1) return [];
  return [
    {
      type: 'multiple_primary_shells',
      shells,
      recommendation:
        'Pick one primary shell before implementation. Use Astro for public/brand sites and Next.js for app/SaaS surfaces unless requirements justify another shell.',
    },
  ];
}

export function buildStackRecommendation(
  scan: WorkspaceScan,
  userGoal: string | undefined,
  sessionSummary: string | undefined,
  selectedTrigger: string,
): StackRecommendation {
  const primaryText = buildPrimaryText(userGoal, sessionSummary);
  const { technologies, aliases } = collectStackAliases(primaryText, scan.detected_stack);

  let siteType: StackSiteType = 'unknown';
  if (selectedTrigger === 'SHOPIFY_STOREFRONT_RUN' || technologies.includes('Shopify')) {
    siteType = 'commerce_storefront';
  } else if (
    selectedTrigger === 'WEB_BUILD' ||
    hasKeyword(primaryText, ['public site', 'public website', 'brand site', 'brand website', 'marketing site', 'landing page'])
  ) {
    siteType = 'public_brand_site';
  } else if (
    selectedTrigger === 'S0_BOOTSTRAP' ||
    hasKeyword(primaryText, ['app', 'saas', 'portal', 'dashboard', 'admin app', 'client portal'])
  ) {
    siteType = 'app_saas';
  }

  const requestedOptional = (allowed: Set<string>, core: string[]) =>
    technologies.filter((tech) => allowed.has(tech) && !core.includes(tech));

  const conflicts = buildStackConflicts(scan.detected_stack, primaryText);
  if (siteType === 'public_brand_site') {
    return {
      policy_version: STACK_POLICY_VERSION,
      site_type: siteType,
      primary_shell: 'Astro',
      core_stack: PUBLIC_SITE_CORE_STACK,
      optional_addons: requestedOptional(PUBLIC_SITE_OPTIONAL, PUBLIC_SITE_CORE_STACK),
      conflicts,
      aliases_matched: aliases,
      reason: 'Public/brand site work should use Astro as the shell and add heavier services only when the brief requires them.',
    };
  }

  if (siteType === 'app_saas') {
    return {
      policy_version: STACK_POLICY_VERSION,
      site_type: siteType,
      primary_shell: 'Next.js',
      core_stack: APP_SAAS_CORE_STACK,
      optional_addons: requestedOptional(APP_SAAS_OPTIONAL, APP_SAAS_CORE_STACK),
      conflicts,
      aliases_matched: aliases,
      reason: 'App/SaaS work should use Next.js as the shell with Stripe in the default commercial path.',
    };
  }

  if (siteType === 'commerce_storefront') {
    return {
      policy_version: STACK_POLICY_VERSION,
      site_type: siteType,
      primary_shell: 'Shopify',
      core_stack: SHOPIFY_CORE_STACK,
      optional_addons: requestedOptional(new Set(['Cloudinary']), SHOPIFY_CORE_STACK),
      conflicts,
      aliases_matched: aliases,
      reason: 'Shopify storefront work should stay on the Shopify/Liquid route unless the brief explicitly calls for a headless build.',
    };
  }

  const shells = detectPrimaryShells(scan.detected_stack, primaryText);
  return {
    policy_version: STACK_POLICY_VERSION,
    site_type: siteType,
    primary_shell: shells.length === 1 ? shells[0] : null,
    core_stack: [],
    optional_addons: technologies,
    conflicts,
    aliases_matched: aliases,
    reason: 'No public-site, app/SaaS, or commerce-storefront intent was strong enough to make a stack recommendation.',
  };
}

export function readGitStatus(workspacePath: string): string | null {
  const result = spawnSync('git', ['-C', workspacePath, 'status', '--short', '--branch'], {
    encoding: 'utf8',
    timeout: 5000,
  });
  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

export async function scanWorkspace(
  workspacePath: string,
  maxFiles: number,
  maxDepth: number,
  maxReadBytes: number,
): Promise<WorkspaceScan> {
  const resolved = assertSafeWorkspacePath(workspacePath);

  let stat;
  try {
    stat = await fs.stat(resolved);
  } catch (error) {
    throw new WorkspaceNotFoundError(
      `workspace_path does not exist: ${resolved} (${errorMessage(error)}) — fix the path before routing`,
    );
  }
  if (!stat.isDirectory()) {
    throw new InvalidWorkspaceError('workspace_path must point to a directory');
  }

  const warnings: string[] = [];
  const importantFiles: ImportantFile[] = [];
  const importantSeen = new Set<string>();

  // Pass A: targeted reads of known important paths — immune to the walk cap.
  for (const relPath of IMPORTANT_EXACT_PATHS) {
    const absolutePath = path.join(resolved, relPath);
    const file = await readImportantFile(absolutePath, relPath, maxReadBytes, []);
    if (file) {
      importantFiles.push(file);
      importantSeen.add(relPath);
    }
  }

  // Pass B: bounded walk for the general picture.
  const files: FileRecord[] = [];
  await walkWorkspace(resolved, resolved, 0, maxDepth, maxFiles, files, warnings, {
    capWarned: false,
    depthWarned: false,
  });

  // Nested important files discovered by the walk (e.g. packages/x/package.json).
  for (const file of files) {
    if (importantSeen.size >= MAX_IMPORTANT_FILES) {
      warnings.push(`Important-file reads capped at ${MAX_IMPORTANT_FILES}`);
      break;
    }
    if (importantSeen.has(file.relativePath) || !isImportantPath(file.relativePath)) continue;
    const read = await readImportantFile(file.absolutePath, file.relativePath, maxReadBytes, warnings);
    if (read) {
      importantFiles.push(read);
      importantSeen.add(file.relativePath);
    }
  }

  const walkedPaths = files.map((file) => file.relativePath);
  const filePaths = [...walkedPaths];
  for (const seen of importantSeen) {
    if (!filePaths.includes(seen)) filePaths.push(seen);
  }

  const lifecycle = extractLifecycleState(importantFiles);
  const detectedStack = detectStack(
    filePaths,
    importantFiles.map((file) => file.text).join('\n'),
  );
  for (const conflict of buildStackConflicts(detectedStack)) {
    warnings.push(`Stack shell conflict detected: ${conflict.shells.join(', ')}. ${conflict.recommendation}`);
  }

  return {
    workspace_path: resolved,
    exists: true,
    empty_workspace: filePaths.length === 0,
    file_count: filePaths.length,
    file_paths: filePaths,
    important_files: importantFiles,
    git_status: readGitStatus(resolved),
    detected_stack: detectedStack,
    lifecycle_stage: lifecycle.stage,
    lifecycle_complete: lifecycle.complete,
    gtm_decision: extractGtmDecision(importantFiles),
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export function buildPrimaryText(userGoal?: string, sessionSummary?: string): string {
  return [userGoal ?? '', sessionSummary ?? ''].join('\n').toLowerCase();
}

export function buildWorkspaceText(scan: WorkspaceScan): string {
  return [
    scan.file_paths.join('\n'),
    scan.detected_stack.join('\n'),
    scan.git_status ?? '',
    ...scan.important_files.map((file) => `${file.path}\n${file.text}`),
  ]
    .join('\n')
    .toLowerCase();
}

export function scoreRoutes(
  routes: RouteDefinition[],
  primaryText: string,
  workspaceText: string,
  scan: WorkspaceScan,
  context: { userGoalText?: string } = {},
): RouteScore[] {
  const hasPrimaryIntent = primaryText.trim().length > 0;
  const userGoalText = (context.userGoalText ?? '').toLowerCase();
  const hasExplicitUserGoal = userGoalText.trim().length > 0;
  const chainStateCanRoute =
    !hasExplicitUserGoal ||
    /\b(next[_\s-]?gate|exit gate|chain handoff|lifecycle|current stage|gtm decision|s\d{1,2})\b/i.test(
      userGoalText,
    );

  const scored = routes.map((route, index): RouteScore & { index: number } => {
    let score = 0;
    let bestQuality: Quality = QUALITY.PRIOR;
    const matchedSignals: string[] = [];
    let contentPoints = 0;
    let matchedPrimary = false;

    const bump = (points: number, quality: Quality, signal: string) => {
      score += points;
      if (quality > bestQuality) bestQuality = quality;
      matchedSignals.push(signal);
    };

    const unmatchedKeywords: string[] = [];
    for (const keyword of route.keywords) {
      if (hasPrimaryIntent && keywordMatcher(keyword).test(primaryText)) {
        matchedPrimary = true;
        if (isPhrase(keyword)) bump(WEIGHTS.PRIMARY_PHRASE, QUALITY.PRIMARY_PHRASE, keyword);
        else bump(WEIGHTS.PRIMARY_WORD, QUALITY.PRIMARY_WORD, keyword);
      } else {
        unmatchedKeywords.push(keyword);
      }
    }

    // Workspace-derived evidence (content keywords, file hints, stack hints)
    // counts only when the operator stated no goal, or this route also matched
    // that goal. Otherwise every repo's README/package.json would let generic
    // routes outvote the operator's explicit intent.
    const allowWorkspaceEvidence = !hasPrimaryIntent || matchedPrimary;

    if (allowWorkspaceEvidence) {
      for (const keyword of unmatchedKeywords) {
        if (!keywordMatcher(keyword).test(workspaceText)) continue;
        // Capped so a keyword-stuffed README can never command a route.
        if (contentPoints >= WEIGHTS.CONTENT_CAP) break;
        contentPoints += WEIGHTS.CONTENT;
        bump(WEIGHTS.CONTENT, QUALITY.CONTENT, `content:${keyword}`);
      }

      for (const hint of route.fileHints ?? []) {
        const normalizedHint = hint.toLowerCase();
        const present = scan.file_paths.some(
          (filePath) => filePath === normalizedHint || filePath.endsWith(`/${normalizedHint}`),
        );
        if (present) bump(WEIGHTS.FILE_HINT, QUALITY.FILE_HINT, `file:${hint}`);
      }

      for (const stackHint of route.stackHints ?? []) {
        if (scan.detected_stack.includes(stackHint)) {
          bump(WEIGHTS.STACK_HINT, QUALITY.FILE_HINT, `detected:${stackHint}`);
        }
      }
    }

    // Deterministic chain-state signals. They are authoritative only when the
    // operator did not state a fresh goal, or the fresh goal is itself asking
    // to continue the lifecycle/chain. Otherwise explicit intent wins.
    if (chainStateCanRoute && scan.lifecycle_stage && !scan.lifecycle_complete && route.trigger === 'S0_BOOTSTRAP') {
      bump(WEIGHTS.STATE, QUALITY.STATE, `lifecycle:${scan.lifecycle_stage}`);
    }
    if (chainStateCanRoute && scan.lifecycle_complete && route.trigger === 'GTM_READY' && scan.gtm_decision !== 'go') {
      bump(WEIGHTS.STATE, QUALITY.STATE, 'lifecycle:complete');
    }
    if (chainStateCanRoute && scan.gtm_decision === 'go' && route.trigger === 'ACCOUNT_GROWTH_RUN') {
      bump(WEIGHTS.STATE, QUALITY.STATE, 'gtm:go');
    }
    if (chainStateCanRoute && scan.gtm_decision && scan.gtm_decision !== 'go' && route.trigger === 'GTM_READY') {
      bump(WEIGHTS.STATE, QUALITY.STATE, `gtm:${scan.gtm_decision}`);
    }

    // Workspace-shape priors. Invariant: when the operator stated a goal, a
    // prior alone must never outrank a primary-intent keyword match.
    if (route.emptyWorkspace && scan.empty_workspace) {
      if (!hasPrimaryIntent) bump(WEIGHTS.EMPTY_DECISIVE, QUALITY.STATE, 'empty workspace');
      else if (matchedPrimary) bump(WEIGHTS.EMPTY_REINFORCE, QUALITY.STATE, 'empty workspace');
      else bump(WEIGHTS.EMPTY_FALLBACK, QUALITY.PRIOR, 'empty workspace');
    }
    if (route.existingWorkspace && scan.exists && !scan.empty_workspace) {
      bump(
        hasPrimaryIntent ? WEIGHTS.EXISTING_WITH_INTENT : WEIGHTS.EXISTING_NO_INTENT,
        QUALITY.PRIOR,
        'existing workspace',
      );
    }

    return {
      prompt_name: route.promptName,
      trigger: route.trigger,
      reason: route.reason,
      score,
      best_quality: bestQuality,
      matched_signals: Array.from(new Set(matchedSignals)).slice(0, 12),
      index,
    };
  });

  scored.sort((a, b) => b.score - a.score || b.best_quality - a.best_quality || a.index - b.index);
  return scored.map(({ index: _index, ...route }) => route);
}

// ---------------------------------------------------------------------------
// Selection + confidence (margin-based)
// ---------------------------------------------------------------------------

export function assessConfidence(
  top: RouteScore,
  second: RouteScore | undefined,
): { confidence: Selection['confidence']; confidence_score: number; margin: number } {
  const margin = top.score - (second?.score ?? 0);
  const hasIntent = top.best_quality >= QUALITY.PRIMARY_WORD;
  const hasState = top.best_quality >= QUALITY.STATE;
  const hasAnyEvidence = top.best_quality >= QUALITY.CONTENT;

  let confidence: Selection['confidence'];
  if (top.score <= 0) {
    confidence = 'low';
  } else if ((hasState && top.score >= 20) || (hasIntent && top.score >= 15 && margin >= 6)) {
    confidence = 'high';
  } else if (
    (hasIntent && top.score >= WEIGHTS.PRIMARY_WORD) ||
    (hasAnyEvidence && top.score >= 12 && margin >= 4)
  ) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  let confidence_score: number;
  if (confidence === 'high') confidence_score = Math.min(100, 80 + margin);
  else if (confidence === 'medium') confidence_score = Math.min(79, 55 + top.score);
  else confidence_score = top.score <= 0 ? 20 : Math.min(54, 25 + top.score * 3);

  return { confidence, confidence_score, margin };
}

export function selectRoute(scores: RouteScore[], scan: WorkspaceScan): Selection {
  const top = scores[0];

  if (top && top.score > 0) {
    const assessment = assessConfidence(top, scores[1]);
    let nextTrigger = top.trigger;
    // Resuming a staged lifecycle: hand the master prompt its own resume command.
    if (top.trigger === 'S0_BOOTSTRAP' && scan.lifecycle_stage && !scan.lifecycle_complete) {
      nextTrigger = 'NEXT_GATE';
    }
    return { route: top, ...assessment, next_trigger: nextTrigger, fallback: false };
  }

  const fallbackName = scan.empty_workspace
    ? 'Application Development Lifecycle Master Prompt'
    : 'Existing Codebase Onboarding Prompt';
  const fallbackRoute = ROUTES.find((route) => route.promptName === fallbackName);
  const route: RouteScore = {
    prompt_name: fallbackName,
    trigger: fallbackRoute?.trigger ?? 'ROUTE_FALLBACK',
    reason:
      fallbackRoute?.reason ?? 'Fallback route selected because no prompt-specific signals were found.',
    score: 0,
    best_quality: QUALITY.PRIOR,
    matched_signals: ['fallback'],
  };
  return {
    route,
    confidence: 'low',
    confidence_score: 20,
    margin: 0,
    next_trigger: route.trigger,
    fallback: true,
  };
}

// ---------------------------------------------------------------------------
// Composition + chain
// ---------------------------------------------------------------------------

export function needsIntakeContract(prompt: PromptEntry): boolean {
  if (prompt.name === INTAKE_CONTRACT_NAME) return false;
  return !prompt.text.includes(INTAKE_GATE_MARKER);
}

/**
 * Load loop block fragments from library/loops/*.md into PromptEntry objects.
 * Each file has a `## <Title>` heading + a single ```text fence (same format as
 * the monolith parser). Slug is derived from the filename stem (e.g. "loop-contract").
 * These entries are loop fragments — they are NOT routable and NOT linted as records.
 */
export async function loadLoopBlocks(libraryDir: string): Promise<PromptEntry[]> {
  const loopsDir = path.join(libraryDir, 'loops');
  let dirContents: string[];
  try {
    dirContents = await fs.readdir(loopsDir);
  } catch {
    return [];
  }
  const entries = dirContents.filter((name) => name.endsWith('.md'));
  const blocks: PromptEntry[] = [];
  for (const filename of entries) {
    const absPath = path.join(loopsDir, filename);
    const text = await fs.readFile(absPath, 'utf8');
    const parsed = parsePromptLibrary(text);
    if (parsed.prompts.length === 0) continue;
    const block = parsed.prompts[0]!;
    // Slug for loop blocks is derived from the filename stem, not the heading.
    // This ensures `loops/loop-contract` resolves even if the heading casing differs.
    const stem = filename.replace(/\.md$/, '');
    blocks.push({ name: block.name, slug: stem, text: block.text });
  }
  return blocks;
}

/**
 * Compose a prompt's final text, resolving `includes` if present (DECLARATIVE mode)
 * or applying the legacy auto-intake heuristic (LEGACY mode).
 *
 * DECLARATIVE mode: activated when `prompt.includes` is a non-empty array.
 *   Resolves each include ID in order:
 *   - `universal-intake-contract` → the Universal Intake Contract text (fills [SERVICE])
 *   - `loops/<slug>`              → the loop block with matching slug
 *   Unresolvable includes emit an HTML comment marker; they never throw.
 *   Assembles: resolvedBlocks.join('\n\n---\n\n') + '\n\n---\n\n' + prompt.text
 *
 * LEGACY mode: activated when `prompt.includes` is undefined or empty.
 *   Exactly preserves prior behavior: auto-prepend the Universal Intake Contract
 *   iff the prompt text does not contain `## Intake Gate`. No other changes.
 */
export function composePromptText(
  prompt: PromptEntry,
  prompts: PromptEntry[],
): { text: string; composition: string[] } {
  // DECLARATIVE mode: prompt.includes is explicitly set (may be populated by structured loader)
  if (prompt.includes !== undefined && prompt.includes.length > 0) {
    const resolvedBlocks: string[] = [];
    const compositionNames: string[] = [];
    const unresolved: string[] = [];

    for (const includeId of prompt.includes) {
      if (includeId === 'universal-intake-contract') {
        const contract = prompts.find((entry) => entry.name === INTAKE_CONTRACT_NAME);
        if (contract) {
          resolvedBlocks.push(contract.text.replaceAll('[SERVICE]', prompt.name));
          compositionNames.push(INTAKE_CONTRACT_NAME);
        } else {
          resolvedBlocks.push(`<!-- include unresolved: ${includeId} -->`);
          unresolved.push(includeId);
          compositionNames.push(`unresolved:${includeId}`);
        }
      } else if (includeId.startsWith('loops/')) {
        const loopSlug = includeId.slice('loops/'.length);
        const block = prompts.find((entry) => entry.slug === loopSlug);
        if (block) {
          resolvedBlocks.push(block.text);
          compositionNames.push(block.name);
        } else {
          resolvedBlocks.push(`<!-- include unresolved: ${includeId} -->`);
          unresolved.push(includeId);
          compositionNames.push(`unresolved:${includeId}`);
        }
      } else {
        // Unknown include format
        resolvedBlocks.push(`<!-- include unresolved: ${includeId} -->`);
        unresolved.push(includeId);
        compositionNames.push(`unresolved:${includeId}`);
      }
    }

    const assembled = [...resolvedBlocks, prompt.text].join('\n\n---\n\n');
    return {
      text: assembled,
      composition: [...compositionNames, prompt.name],
    };
  }

  // LEGACY mode: exact prior behavior — auto-prepend intake iff no ## Intake Gate marker
  if (!needsIntakeContract(prompt)) {
    return { text: prompt.text, composition: [prompt.name] };
  }
  const contract = prompts.find((entry) => entry.name === INTAKE_CONTRACT_NAME);
  if (!contract) {
    return { text: prompt.text, composition: [prompt.name] };
  }
  const filled = contract.text.replaceAll('[SERVICE]', prompt.name);
  return {
    text: `${filled}\n\n---\n\n${prompt.text}`,
    composition: [INTAKE_CONTRACT_NAME, prompt.name],
  };
}

export type OnComplete = {
  chain_complete: boolean;
  next_trigger: string | null;
  next_when: string | null;
  reroute_rule: string;
};

export function buildOnComplete(selectedTrigger: string): OnComplete {
  const route = ROUTES.find((entry) => entry.trigger === selectedTrigger);
  const chain = route?.chainNext ?? null;
  return {
    chain_complete: chain === null,
    next_trigger: chain?.trigger ?? null,
    next_when: chain?.when ?? null,
    reroute_rule:
      'When the selected prompt passes its exit gate and chain_complete is false, call route_prompt again with the same workspace_path and an updated session_summary, then activate the newly returned prompt. Repeat until chain_complete is true or a stop condition is reached.',
  };
}
