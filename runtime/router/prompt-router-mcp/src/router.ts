import { createRequire } from 'node:module';
import { dirname, extname } from 'node:path';

import {
  buildStackRecommendation,
  buildOnComplete,
  buildPrimaryText,
  buildWorkspaceText,
  composePromptText,
  findPrompt,
  assessConfidence,
  readPromptLibrary,
  resolveRoutes,
  scanWorkspace,
  scoreRoutes,
  selectRoute,
  QUALITY,
  STACK_POLICY_VERSION,
  type OnComplete,
  type RouteScore,
  type Selection,
  type StackRecommendation,
  type WorkspaceScan,
} from './lib.js';
import { buildProofReport, readCapabilityIndex, type PromptProofReport } from './prompt-os/build.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { name: string; version: string };

const ROUTE_RESPONSE_CONTRACT_VERSION = '0.4';

export type RoutePromptOptions = {
  workspacePath: string;
  libraryPath: string;
  userGoal?: string;
  sessionSummary?: string;
  maxFiles: number;
  maxDepth: number;
  maxReadBytes: number;
};

export type ExecutionContract = {
  mode: 'autonomous_loop';
  activation_required: boolean;
  operator_confirmation_required: boolean;
  next_trigger: string;
  on_complete: OnComplete;
  multi_prompt_required: boolean;
  selected_prompt_count: number;
  prompt_sequence: Array<{
    order: number;
    name: string;
    trigger: string;
    next_trigger: string;
    activation_rule: SelectedPromptSummary['activation_rule'];
    on_complete: OnComplete;
  }>;
  loop_rules: string[];
  stop_conditions: string[];
};

export type SelectedPromptSummary = {
  order: number;
  name: string;
  trigger: string;
  next_trigger: string;
  reason: string;
  confidence: Selection['confidence'];
  confidence_score: number;
  raw_signal_score: number;
  matched_signals: string[];
  composition: string[];
  activation_rule: 'activate_first' | 'activate_after_previous_exit_gate';
  on_complete: OnComplete;
};

type SelectedPromptInternal = SelectedPromptSummary & {
  prompt_text: string;
};

export type RoutePromptResponse = {
  status: 'ok';
  metadata: {
    router_name: string;
    package_version: string;
    response_contract_version: string;
    stack_policy_version: string;
  };
  selected_prompt: {
    name: string;
    trigger: string;
    next_trigger: string;
    reason: string;
    confidence: Selection['confidence'];
    confidence_score: number;
    score_scale: string;
    raw_signal_score: number;
    margin: number;
    matched_signals: string[];
    composition: string[];
    fallback: boolean;
  };
  selected_prompts: SelectedPromptSummary[];
  prompt_text: string;
  multi_prompt_text: string;
  activation_message: string;
  suggested_chat_message: string;
  execution_contract: ExecutionContract;
  alternatives: Array<{
    prompt_name: string;
    trigger: string;
    raw_signal_score: number;
    matched_signals: string[];
    reason: string;
  }>;
  alternatives_score_meaning: string;
  scan_summary: {
    workspace_path: string;
    empty_workspace: boolean;
    file_count: number;
    detected_stack: string[];
    git_status_present: boolean;
    lifecycle_stage: string | null;
    lifecycle_complete: boolean;
    gtm_decision: WorkspaceScan['gtm_decision'];
    important_files: string[];
  };
  stack_recommendation: StackRecommendation;
  warnings: string[];
};

const LOOP_RULES = [
  'Treat prompt_text as the operating procedure: run its stages in order and do not skip exit gates.',
  'When execution_contract.multi_prompt_required is true, treat multi_prompt_text as the operating procedure and run execution_contract.prompt_sequence in order.',
  'Write durable state to the files the prompt names (docs/ops/lifecycle-state.md, docs/gtm/readiness.md, plans, handoffs) so the chain survives session resets.',
  'Verify with real executions (build, tests, probes) before declaring any stage complete.',
  'When the prompt finishes or its exit gate passes, follow execution_contract.on_complete instead of stopping.',
];

const STOP_CONDITIONS = [
  'A destructive or irreversible operation is required (data deletion, force push, production drop, outbound communications).',
  'Required credentials or approvals are missing.',
  'The operator interrupts or the same failure repeats three times without a new root-cause hypothesis.',
];

function buildExecutionContract(selection: Selection, selectedPrompts: SelectedPromptSummary[]): ExecutionContract {
  const finalSelectedPrompt = selectedPrompts[selectedPrompts.length - 1];
  const chainOnComplete = finalSelectedPrompt
    ? buildOnComplete(finalSelectedPrompt.trigger)
    : buildOnComplete(selection.route.trigger);

  return {
    mode: 'autonomous_loop',
    activation_required: selection.confidence !== 'low',
    operator_confirmation_required: selection.confidence === 'low',
    next_trigger: selection.next_trigger,
    on_complete: chainOnComplete,
    multi_prompt_required: selectedPrompts.length > 1,
    selected_prompt_count: selectedPrompts.length,
    prompt_sequence: selectedPrompts.map((prompt) => ({
      order: prompt.order,
      name: prompt.name,
      trigger: prompt.trigger,
      next_trigger: prompt.next_trigger,
      activation_rule: prompt.activation_rule,
      on_complete: prompt.on_complete,
    })),
    loop_rules: LOOP_RULES,
    stop_conditions: STOP_CONDITIONS,
  };
}

function describeChain(onComplete: OnComplete): string {
  if (onComplete.chain_complete) {
    return 'Chain: this prompt completes the chain — report final state when its exit gate passes.';
  }
  return `Chain: when this prompt passes its exit gate (${onComplete.next_when ?? 'on completion'}), re-call route_prompt — expected next trigger ${onComplete.next_trigger}.`;
}

function composeActivationMessage(
  selection: Selection,
  contract: ExecutionContract,
  alternatives: RouteScore[],
  scan: WorkspaceScan,
  selectedPrompts: SelectedPromptSummary[],
): string {
  const lines: string[] = [];
  const composedNote = selection.confidence === 'low' ? ' (confirmation required)' : '';
  lines.push(
    `Route selected: ${selection.route.prompt_name} — trigger ${selection.next_trigger}, confidence ${selection.confidence} ${selection.confidence_score}/100${composedNote}.`,
  );
  lines.push(`Why: ${selection.route.reason}`);
  if (selection.route.matched_signals.length > 0) {
    lines.push(`Signals: ${selection.route.matched_signals.join(', ')}`);
  }
  if (scan.lifecycle_stage) {
    lines.push(
      `Lifecycle state: ${scan.lifecycle_stage}${scan.lifecycle_complete ? ' (complete)' : ' (in progress)'}${scan.gtm_decision ? `, GTM decision ${scan.gtm_decision}` : ''}.`,
    );
  } else if (scan.gtm_decision) {
    lines.push(`GTM decision on file: ${scan.gtm_decision}.`);
  }
  if (selectedPrompts.length > 1) {
    lines.push(
      `Multi-prompt chain selected (${selectedPrompts.length}): ${selectedPrompts
        .map((prompt) => `${prompt.order}. ${prompt.name}`)
        .join(' -> ')}.`,
    );
    lines.push('Use multi_prompt_text as the active operating prompt; it contains each selected prompt in execution order.');
    const finalPrompt = selectedPrompts[selectedPrompts.length - 1]!;
    lines.push(
      `Chain: follow execution_contract.prompt_sequence through prompt ${finalPrompt.order}; after "${finalPrompt.name}" passes its exit gate, use that prompt's on_complete hand-off or report final state if complete.`,
    );
  } else {
    lines.push(describeChain(contract.on_complete));
  }
  if (contract.operator_confirmation_required) {
    const options = [selection.route, ...alternatives.slice(0, 3)]
      .map((route, index) => `${index + 1}. ${route.prompt_name} (raw ${route.score})`)
      .join(' ');
    lines.push(`Low confidence — confirm before activation. Candidates: ${options}`);
  } else {
    lines.push(
      selectedPrompts.length > 1
        ? 'Activate now: execute multi_prompt_text as a sequential autonomous loop per execution_contract.prompt_sequence.'
        : 'Activate now: execute prompt_text as an autonomous loop per execution_contract.',
    );
  }
  return lines.join('\n');
}

function composeSuggestedChatMessage(
  selection: Selection,
  contract: ExecutionContract,
  selectedPrompts: SelectedPromptSummary[],
): string {
  if (contract.operator_confirmation_required) {
    return `Routing confidence is low (${selection.confidence_score}/100). Confirm the target prompt before activation — top candidate: ${selection.route.prompt_name} (${selection.next_trigger}).`;
  }
  if (selectedPrompts.length > 1) {
    const chain = selectedPrompts.map((prompt) => `${prompt.order}. ${prompt.name}`).join(' -> ');
    return [
      `Activate multi-prompt chain (${selectedPrompts.length} prompts, primary ${selection.route.prompt_name}, confidence ${selection.confidence} ${selection.confidence_score}/100).`,
      `Execution order: ${chain}.`,
      'Execute multi_prompt_text as one sequential autonomous loop: complete each prompt exit gate, pass durable state forward, and continue until the final prompt or stop condition.',
    ].join(' ');
  }
  const chain = contract.on_complete.chain_complete
    ? 'This prompt completes the chain; report final state at its exit gate.'
    : `At the exit gate, call route_prompt again with an updated session_summary (expected next: ${contract.on_complete.next_trigger}).`;
  return [
    `Activate ${selection.route.prompt_name} (${selection.next_trigger}, confidence ${selection.confidence} ${selection.confidence_score}/100).`,
    'Execute the prompt text below as an autonomous loop: run every stage, verify every exit gate, write state files as instructed, and do not stop for permission between stages.',
    chain,
  ].join(' ');
}

const MULTI_PROMPT_MIN_SCORE = 9;
const MULTI_PROMPT_MAX_PROMPTS = 5;

const PHASE_ORDER = new Map<string, number>([
  ['INCIDENT_RUN', 0],
  ['ONBOARD_REPO', 10],
  ['HANDOFF_RESUME', 12],
  ['DEBUG_LOOP', 15],
  ['S0_BOOTSTRAP', 20],
  ['BRAND_SYSTEM', 30],
  ['DESIGN_RESEARCH_MOCKUP', 35],
  ['WEB_BUILD', 40],
  ['SHOPIFY_STOREFRONT_RUN', 40],
  ['BUILD_SLICE', 45],
  ['MCP_TOOL_RUN', 45],
  ['MIGRATION_RUN', 50],
  ['SECURITY_REVIEW', 55],
  ['QA_PLAN', 60],
  ['RELEASE_RUN', 70],
  ['GTM_READY', 80],
  ['PROPOSAL_SCOPE_RUN', 85],
  ['ENGAGEMENT_MODEL', 86],
  ['PAID_ADS_PLAN', 90],
  ['SEO_CONTENT_PLAN', 90],
  ['SOCIAL_RUN', 90],
  ['REPUTATION_RUN', 90],
  ['AUTOMATION_RUN', 90],
  ['ANALYTICS_RUN', 90],
  ['LEAD_FUNNEL_RUN', 90],
  ['GROWTH_OPS_RUN', 90],
  ['VOICE_AGENT_RUN', 90],
  ['ACCOUNT_GROWTH_RUN', 95],
]);

function nextTriggerForRoute(score: RouteScore, scan: WorkspaceScan): string {
  if (score.trigger === 'S0_BOOTSTRAP' && scan.lifecycle_stage && !scan.lifecycle_complete) {
    return 'NEXT_GATE';
  }
  return score.trigger;
}

function phaseOrder(trigger: string): number {
  return PHASE_ORDER.get(trigger) ?? 75;
}

function buildSelectedPromptChain(
  selection: Selection,
  scores: RouteScore[],
  prompts: Awaited<ReturnType<typeof readPromptLibrary>>['prompts'],
  scan: WorkspaceScan,
): SelectedPromptInternal[] {
  const candidates = scores.filter((score) => {
    if (score.prompt_name === selection.route.prompt_name) return true;
    if (selection.confidence === 'low') return false;
    if (score.score < MULTI_PROMPT_MIN_SCORE) return false;
    return score.best_quality >= QUALITY.PRIMARY_WORD;
  });

  const unique = new Map<string, RouteScore>();
  for (const candidate of candidates) {
    if (!unique.has(candidate.prompt_name)) unique.set(candidate.prompt_name, candidate);
  }

  const ordered = Array.from(unique.values())
    .sort((a, b) => {
      const phaseDelta = phaseOrder(a.trigger) - phaseOrder(b.trigger);
      if (phaseDelta !== 0) return phaseDelta;
      if (a.prompt_name === selection.route.prompt_name) return -1;
      if (b.prompt_name === selection.route.prompt_name) return 1;
      return b.score - a.score;
    })
    .slice(0, MULTI_PROMPT_MAX_PROMPTS);

  return ordered.flatMap((score, index): SelectedPromptInternal[] => {
    const prompt = findPrompt(prompts, score.prompt_name);
    if (!prompt) return [];
    const composed = composePromptText(prompt, prompts);
    const confidence =
      score.prompt_name === selection.route.prompt_name
        ? {
            confidence: selection.confidence,
            confidence_score: selection.confidence_score,
          }
        : assessConfidence(score, undefined);
    return [
      {
        order: index + 1,
        name: score.prompt_name,
        trigger: score.trigger,
        next_trigger: nextTriggerForRoute(score, scan),
        reason: score.reason,
        confidence: confidence.confidence,
        confidence_score: confidence.confidence_score,
        raw_signal_score: score.score,
        matched_signals: score.matched_signals,
        composition: composed.composition,
        activation_rule: index === 0 ? 'activate_first' : 'activate_after_previous_exit_gate',
        on_complete: buildOnComplete(score.trigger),
        prompt_text: composed.text,
      },
    ];
  });
}

function publicSelectedPrompts(selectedPrompts: SelectedPromptInternal[]): SelectedPromptSummary[] {
  return selectedPrompts.map(({ prompt_text: _promptText, ...summary }) => summary);
}

function composeMultiPromptText(selectedPrompts: SelectedPromptInternal[]): string {
  if (selectedPrompts.length === 1) return selectedPrompts[0]!.prompt_text;

  const lines: string[] = [
    '# Apex Multi-Prompt Execution Chain',
    '',
    'Run these selected prompts in order as one sequential autonomous loop.',
    'For each prompt: activate the prompt text, execute every required phase, satisfy the exit gate, write durable state, pass the output into the next prompt, and continue without asking for another prompt unless a stop condition fires.',
    '',
    '## Selected Prompt Order',
    ...selectedPrompts.map(
      (prompt) =>
        `${prompt.order}. ${prompt.name} (${prompt.trigger}, confidence ${prompt.confidence} ${prompt.confidence_score}/100)`,
    ),
    '',
  ];

  for (const prompt of selectedPrompts) {
    lines.push(
      `## Prompt ${prompt.order}: ${prompt.name}`,
      `Trigger: ${prompt.trigger}`,
      `Activation rule: ${prompt.activation_rule}`,
      `Reason: ${prompt.reason}`,
      `Signals: ${prompt.matched_signals.length > 0 ? prompt.matched_signals.join(', ') : 'none'}`,
      '',
      prompt.prompt_text,
      '',
      '---',
      '',
    );
  }

  return lines.join('\n').trim();
}

export async function routePromptCore(options: RoutePromptOptions): Promise<RoutePromptResponse> {
  const { prompts, warnings: parserWarnings } = await readPromptLibrary(options.libraryPath);
  const resolution = resolveRoutes(prompts);
  const scan = await scanWorkspace(options.workspacePath, options.maxFiles, options.maxDepth, options.maxReadBytes);

  const primaryText = buildPrimaryText(options.userGoal, options.sessionSummary);
  const workspaceText = buildWorkspaceText(scan);
  const scores = scoreRoutes(resolution.resolved, primaryText, workspaceText, scan, {
    userGoalText: options.userGoal,
  });
  const selection = selectRoute(scores, scan);

  const prompt = findPrompt(prompts, selection.route.prompt_name);
  if (!prompt) {
    throw new Error(
      `Selected prompt "${selection.route.prompt_name}" is missing from the library — run prompt_router_health and reconcile the route table`,
    );
  }
  const composed = composePromptText(prompt, prompts);
  const selectedPromptsInternal = buildSelectedPromptChain(selection, scores, prompts, scan);
  const selectedPrompts = publicSelectedPrompts(selectedPromptsInternal);
  const multiPromptText = composeMultiPromptText(selectedPromptsInternal);
  const contract = buildExecutionContract(selection, selectedPrompts);
  const stackRecommendation = buildStackRecommendation(
    scan,
    options.userGoal,
    options.sessionSummary,
    selection.route.trigger,
  );
  const alternatives = scores.filter((score) => score.prompt_name !== selection.route.prompt_name).slice(0, 3);
  const alternativeSummaries = alternatives.map((route) => ({
    prompt_name: route.prompt_name,
    trigger: route.trigger,
    raw_signal_score: route.score,
    matched_signals: route.matched_signals,
    reason: route.reason,
  }));

  const warnings = [...scan.warnings, ...parserWarnings];
  if (resolution.missing_route_prompts.length > 0) {
    warnings.push(
      `Routes excluded (prompt missing from library): ${resolution.missing_route_prompts.join('; ')}`,
    );
  }

  return {
    status: 'ok',
    metadata: {
      router_name: pkg.name,
      package_version: pkg.version,
      response_contract_version: ROUTE_RESPONSE_CONTRACT_VERSION,
      stack_policy_version: STACK_POLICY_VERSION,
    },
    selected_prompt: {
      name: selection.route.prompt_name,
      trigger: selection.route.trigger,
      next_trigger: selection.next_trigger,
      reason: selection.route.reason,
      confidence: selection.confidence,
      confidence_score: selection.confidence_score,
      score_scale:
        'confidence_score is 0-100 (margin- and evidence-based); raw_signal_score is the unnormalized signal sum',
      raw_signal_score: selection.route.score,
      margin: selection.margin,
      matched_signals: selection.route.matched_signals,
      composition: composed.composition,
      fallback: selection.fallback,
    },
    selected_prompts: selectedPrompts,
    prompt_text: composed.text,
    multi_prompt_text: multiPromptText,
    activation_message: composeActivationMessage(selection, contract, alternatives, scan, selectedPrompts),
    suggested_chat_message: composeSuggestedChatMessage(selection, contract, selectedPrompts),
    execution_contract: contract,
    alternatives: alternativeSummaries,
    alternatives_score_meaning:
      'Alternative scores are raw signal sums on the same scale as selected_prompt.raw_signal_score, not 0-100 confidence.',
    scan_summary: {
      workspace_path: scan.workspace_path,
      empty_workspace: scan.empty_workspace,
      file_count: scan.file_count,
      detected_stack: scan.detected_stack,
      git_status_present: scan.git_status !== null,
      lifecycle_stage: scan.lifecycle_stage,
      lifecycle_complete: scan.lifecycle_complete,
      gtm_decision: scan.gtm_decision,
      important_files: scan.important_files.map((file) => file.path),
    },
    stack_recommendation: stackRecommendation,
    warnings,
  };
}

export type HealthReport = {
  ok: boolean;
  server: { name: string; version: string };
  library: {
    path: string;
    readable: boolean;
    prompt_count: number;
    parser_warnings: string[];
  };
  routing: {
    routes_total: number;
    routes_resolved: number;
    missing_route_prompts: string[];
    unrouted_prompts: string[];
  };
  prompt_os: {
    library_dir: string;
    capability_index_readable: boolean;
    proof_summary: PromptProofReport['summary'] | null;
    proof_missing: string[];
  };
  default_workspace_path: string;
  error?: string;
};

function promptOsLibraryDir(libraryPath: string): string {
  return extname(libraryPath) ? dirname(libraryPath) : libraryPath;
}

export async function buildHealthReport(
  serverName: string,
  serverVersion: string,
  libraryPath: string,
  defaultWorkspacePath: string,
  routesTotal: number,
): Promise<HealthReport> {
  try {
    const { prompts, warnings } = await readPromptLibrary(libraryPath);
    const resolution = resolveRoutes(prompts);
    const promptOsDir = promptOsLibraryDir(libraryPath);
    const capabilityIndex = await readCapabilityIndex(promptOsDir);
    const proofReport = capabilityIndex ? buildProofReport(capabilityIndex) : null;
    return {
      ok: resolution.missing_route_prompts.length === 0 && warnings.length === 0,
      server: { name: serverName, version: serverVersion },
      library: {
        path: libraryPath,
        readable: true,
        prompt_count: prompts.length,
        parser_warnings: warnings,
      },
      routing: {
        routes_total: routesTotal,
        routes_resolved: resolution.resolved.length,
        missing_route_prompts: resolution.missing_route_prompts,
        unrouted_prompts: resolution.unrouted_prompts,
      },
      prompt_os: {
        library_dir: promptOsDir,
        capability_index_readable: capabilityIndex !== null,
        proof_summary: proofReport?.summary ?? null,
        proof_missing: proofReport?.missing.map((record) => record.slug) ?? [],
      },
      default_workspace_path: defaultWorkspacePath,
    };
  } catch (error) {
    const promptOsDir = promptOsLibraryDir(libraryPath);
    return {
      ok: false,
      server: { name: serverName, version: serverVersion },
      library: { path: libraryPath, readable: false, prompt_count: 0, parser_warnings: [] },
      routing: {
        routes_total: routesTotal,
        routes_resolved: 0,
        missing_route_prompts: [],
        unrouted_prompts: [],
      },
      prompt_os: {
        library_dir: promptOsDir,
        capability_index_readable: false,
        proof_summary: null,
        proof_missing: [],
      },
      default_workspace_path: defaultWorkspacePath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
