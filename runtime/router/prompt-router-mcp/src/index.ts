#!/usr/bin/env node
import { join } from 'node:path';
import { createRequire } from 'node:module';
import process from 'node:process';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import express from 'express';
import { z } from 'zod';

import {
  composePromptText,
  errorMessage,
  findPrompt,
  loadLibrary,
  packageLibraryDir,
  resolveLibraryPath,
  resolveRoutes,
  ROUTES,
} from './lib.js';
import { readIndex } from './prompt-os/build.js';
import type { IndexRecord } from './prompt-os/build.js';
import { buildHealthReport, routePromptCore } from './router.js';
import { logRoutingDecision } from './prompt-os/telemetry.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { name: string; version: string };

const MCP_NAME = 'apex-prompt-router-mcp';
const MCP_VERSION = pkg.version;

// No portable default exists — the prompt library is instance content stored
// outside this package (it differs per deployment). Set APEX_PROMPT_LIBRARY_PATH
// to point the router at your library; absent that, fall back to a
// workspace-local `prompt-library.md`.
const DEFAULT_LIBRARY_PATH =
  process.env['APEX_PROMPT_LIBRARY_PATH'] ??
  join(process.cwd(), 'prompt-library.md');
const DEFAULT_WORKSPACE_PATH = process.env['APEX_PROMPT_ROUTER_WORKSPACE'] ?? process.cwd();

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

function textResult(payload: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function errorResult(message: string, code: string, retryable = false): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message, code, retryable }, null, 2) }],
    isError: true,
  };
}

function errorCode(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    const code = error.code;
    if (code === 'WORKSPACE_NOT_FOUND' || code === 'INVALID_WORKSPACE') return code;
    if (code === 'ENOENT') return 'LIBRARY_NOT_FOUND';
  }
  return fallback;
}

async function reportStartupReconciliation(): Promise<void> {
  try {
    const { prompts, warnings, source_path } = await loadLibrary(DEFAULT_LIBRARY_PATH);
    const resolution = resolveRoutes(prompts);
    const mode = source_path === DEFAULT_LIBRARY_PATH ? 'monolith' : 'structured';
    process.stderr.write(
      `${MCP_NAME} v${MCP_VERSION}: library ok [${mode}] (${prompts.length} prompts, ${resolution.resolved.length}/${ROUTES.length} routes resolved)\n`,
    );
    for (const warning of warnings) {
      process.stderr.write(`${MCP_NAME} parser warning: ${warning}\n`);
    }
    if (resolution.missing_route_prompts.length > 0) {
      process.stderr.write(
        `${MCP_NAME} WARNING missing route prompts: ${resolution.missing_route_prompts.join('; ')}\n`,
      );
    }
    if (resolution.unrouted_prompts.length > 0) {
      process.stderr.write(
        `${MCP_NAME} WARNING unrouted prompts: ${resolution.unrouted_prompts.join('; ')}\n`,
      );
    }
  } catch (error) {
    process.stderr.write(
      `${MCP_NAME} WARNING library unreadable at startup (${DEFAULT_LIBRARY_PATH}): ${errorMessage(error)}\n`,
    );
  }
}

function createServer(): McpServer {
  const server = new McpServer({ name: MCP_NAME, version: MCP_VERSION });

  server.registerTool(
    'route_prompt',
    {
      title: 'Route to the best Apex prompt',
      description:
        'Scan the workspace, score the Apex prompt routes deterministically, and return the selected prompt plus an optional multi-prompt execution chain, activation contract, chain hand-off (on_complete), and alternatives. Read-only.',
      inputSchema: {
        workspace_path: z
          .string()
          .min(1)
          .optional()
          .describe('Absolute path to the project workspace (defaults to the server workspace)'),
        user_goal: z.string().max(4000).optional().describe('What the operator wants to accomplish'),
        session_summary: z
          .string()
          .max(8000)
          .optional()
          .describe('Recent session context, e.g. last exit gate passed'),
        library_path: z.string().min(1).optional().describe('Absolute path to the prompt library markdown'),
        max_files: z.number().int().min(20).max(1000).default(300),
        max_depth: z.number().int().min(1).max(10).default(5),
        max_read_bytes: z.number().int().min(1000).max(50000).default(12000),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const response = await routePromptCore({
          workspacePath: args.workspace_path ?? DEFAULT_WORKSPACE_PATH,
          libraryPath: resolveLibraryPath(DEFAULT_LIBRARY_PATH, args.library_path),
          userGoal: args.user_goal,
          sessionSummary: args.session_summary,
          maxFiles: args.max_files,
          maxDepth: args.max_depth,
          maxReadBytes: args.max_read_bytes,
        });

        // Phase 4: best-effort decision log. Fire-and-forget; never awaited on
        // the hot path so it cannot delay the tool response. APEX_PROMPT_TELEMETRY
        // must be set for any write to occur — default is a no-op.
        const selected = response.selected_prompt;
        void logRoutingDecision({
          ts: new Date().toISOString(),
          input: [args.user_goal, args.session_summary].filter(Boolean).join(' | '),
          selected: selected
            ? { slug: selected.trigger.toLowerCase().replace(/_/g, '-'), name: selected.name }
            : null,
          confidence: selected?.confidence_score ?? null,
          margin: selected?.margin ?? null,
          runner_up: response.alternatives?.[0]?.prompt_name ?? null,
          fallback: selected?.fallback ?? false,
          mode: process.env['APEX_PROMPT_LIBRARY_MODE'] === 'structured' ? 'structured' : 'monolith',
        });

        return textResult(response);
      } catch (error) {
        return errorResult(errorMessage(error), errorCode(error, 'ROUTE_PROMPT_FAILED'));
      }
    },
  );

  server.registerTool(
    'get_prompt',
    {
      title: 'Get one Apex prompt by name',
      description:
        'Fetch a single prompt from the library by exact name or slug. Set composed=true to prepend the Universal Intake Contract when the prompt has no Intake Gate of its own. Read-only.',
      inputSchema: {
        name: z.string().min(1).describe('Prompt name or slug as returned by list_prompts'),
        library_path: z.string().min(1).optional(),
        composed: z
          .boolean()
          .default(false)
          .describe('Prepend the Universal Intake Contract when the prompt lacks an Intake Gate'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const { prompts, warnings } = await loadLibrary(DEFAULT_LIBRARY_PATH, args.library_path);
        const prompt = findPrompt(prompts, args.name);
        if (!prompt) {
          return errorResult(
            `Prompt not found: "${args.name}". Call list_prompts for the available names.`,
            'PROMPT_NOT_FOUND',
          );
        }
        const composed = args.composed
          ? composePromptText(prompt, prompts)
          : { text: prompt.text, composition: [prompt.name] };
        return textResult({
          name: prompt.name,
          slug: prompt.slug,
          composition: composed.composition,
          text: composed.text,
          warnings,
        });
      } catch (error) {
        return errorResult(errorMessage(error), errorCode(error, 'GET_PROMPT_FAILED'));
      }
    },
  );

  server.registerTool(
    'list_prompts',
    {
      title: 'List Apex prompts',
      description:
        'List every prompt parsed from the library with its routing trigger (if routed). Read-only.',
      inputSchema: {
        library_path: z.string().min(1).optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const { prompts, warnings, source_path } = await loadLibrary(DEFAULT_LIBRARY_PATH, args.library_path);
        const routedBy = new Map(ROUTES.map((route) => [route.promptName, route.trigger]));
        return textResult({
          library_path: source_path,
          prompt_count: prompts.length,
          prompts: prompts.map((prompt) => ({
            name: prompt.name,
            slug: prompt.slug,
            routed_by: routedBy.get(prompt.name) ?? null,
          })),
          warnings,
        });
      } catch (error) {
        return errorResult(errorMessage(error), errorCode(error, 'LIST_PROMPTS_FAILED'));
      }
    },
  );

  server.registerTool(
    'prompt_router_health',
    {
      title: 'Prompt router health',
      description:
        'Library readability, prompt count, ROUTES↔library reconciliation (missing/unrouted prompts), and parser warnings. Read-only.',
      inputSchema: {
        library_path: z.string().min(1).optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      const report = await buildHealthReport(
        MCP_NAME,
        MCP_VERSION,
        resolveLibraryPath(DEFAULT_LIBRARY_PATH, args.library_path),
        DEFAULT_WORKSPACE_PATH,
        ROUTES.length,
      );
      return textResult(report);
    },
  );

  // ---------------------------------------------------------------------------
  // Structured sidecar tools (additive). These read library/index.json. They are
  // independent of APEX_PROMPT_LIBRARY_MODE and never throw on a missing index —
  // they return a clean empty result with a note so a fresh checkout degrades
  // gracefully.
  // ---------------------------------------------------------------------------

  const INDEX_ABSENT_NOTE =
    'library/index.json not found — run "npm run prompt-os:build" to generate the structured sidecar.';

  const contractFields = (record: IndexRecord) => ({
    id: record.id,
    name: record.name,
    slug: record.slug,
    domain: record.domain,
    status: record.status,
    version: record.version,
    file: record.file,
    sections: record.sections,
    eval_refs: record.eval_refs,
    includes: record.includes,
  });

  server.registerTool(
    'get_prompt_contract',
    {
      title: 'Get a prompt record contract',
      description:
        'Return the contract fields (domain, status, version, sections, eval_refs, includes, file) for one prompt record from library/index.json, looked up by slug. Read-only. Returns a clean note if the sidecar is absent.',
      inputSchema: {
        slug: z.string().min(1).describe('Record slug (kebab-case id) as listed in index.json'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      const index = await readIndex(packageLibraryDir());
      if (index === null) {
        return textResult({ found: false, slug: args.slug, contract: null, note: INDEX_ABSENT_NOTE });
      }
      const record = index.find((r) => r.slug === args.slug || r.id === args.slug);
      if (!record) {
        return textResult({
          found: false,
          slug: args.slug,
          contract: null,
          note: `No record with slug "${args.slug}" in index.json.`,
        });
      }
      return textResult({ found: true, slug: record.slug, contract: contractFields(record) });
    },
  );

  server.registerTool(
    'search_prompts_by_section',
    {
      title: 'Search prompt records by section',
      description:
        'Return every prompt record (from library/index.json) whose body contains the given XML section tag (e.g. "verify", "intake_gate"). Read-only. Returns a clean note if the sidecar is absent.',
      inputSchema: {
        section: z.string().min(1).describe('XML section tag name, without angle brackets (e.g. "verify")'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      const index = await readIndex(packageLibraryDir());
      if (index === null) {
        return textResult({ section: args.section, count: 0, matches: [], note: INDEX_ABSENT_NOTE });
      }
      const needle = args.section.replace(/^<|>$/g, '');
      const matches = index
        .filter((r) => r.sections.includes(needle))
        .map((r) => contractFields(r));
      return textResult({ section: needle, count: matches.length, matches });
    },
  );

  server.registerTool(
    'search_prompts_by_eval_status',
    {
      title: 'Search prompt records by status',
      description:
        'Return every prompt record (from library/index.json) whose lifecycle status matches the requested value (draft, in_review, published, deprecated). Read-only. Returns a clean note if the sidecar is absent.',
      inputSchema: {
        status: z
          .enum(['draft', 'in_review', 'published', 'deprecated'])
          .describe('Lifecycle status to match'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => {
      const index = await readIndex(packageLibraryDir());
      if (index === null) {
        return textResult({ status: args.status, count: 0, matches: [], note: INDEX_ABSENT_NOTE });
      }
      const matches = index.filter((r) => r.status === args.status).map((r) => contractFields(r));
      return textResult({ status: args.status, count: matches.length, matches });
    },
  );

  return server;
}

function argVal(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function serveHttp(host: string, port: number): Promise<void> {
  const app = createMcpExpressApp({ host });
  app.use(express.json());
  app.get('/health', (_req, res) => {
    res.json({ ok: true, name: MCP_NAME, version: MCP_VERSION });
  });
  app.all('/mcp', async (req, res) => {
    // Stateless: a fresh server + transport per request. The router is read-only, so no
    // session state is needed and concurrent clients are isolated by construction.
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req as never, res as never, (req as { body?: unknown }).body);
  });
  await new Promise<void>((resolve) => {
    app.listen(port, host, () => {
      process.stderr.write(`${MCP_NAME} http transport on http://${host}:${port}/mcp\n`);
      resolve();
    });
  });
}

async function main(): Promise<void> {
  await reportStartupReconciliation();
  const httpMode =
    process.argv.includes('--http') ||
    process.argv.includes('--sse') ||
    Boolean(process.env.APEX_PROMPT_ROUTER_HTTP);
  if (httpMode) {
    const host = process.env.HOST ?? argVal('--host') ?? '127.0.0.1';
    const port = Number(process.env.PORT ?? argVal('--port') ?? 3003);
    await serveHttp(host, port);
  } else {
    const server = createServer();
    await server.connect(new StdioServerTransport());
  }
}

main().catch((error) => {
  process.stderr.write(`${MCP_NAME} fatal: ${errorMessage(error)}\n`);
  process.exit(1);
});
