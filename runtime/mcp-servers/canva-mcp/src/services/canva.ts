/**
 * Canva Connect API service — programmatic design creation, brand-template autofill,
 * and export via the REST v1 API.
 *
 * Auth: OAuth2 (see ../auth/oauth.ts). If no token is available, no tools register.
 * Rate limiting: Canva's documented production limit is generous but undeclared per
 * endpoint; a conservative sliding-window (60 req/min) is applied globally.
 * No npm deps beyond zod + shared — uses native fetch() (Node 20+).
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { log, type UnifiedErrorHandler } from '@framework/mcp-shared';
import { CANVA_API_BASE, getAccessToken, loadToken } from '../auth/oauth.js';

const MCP_NAME = 'apex-canva-mcp';
const SERVICE = 'canva';

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 60;
const requestTimestamps: number[] = [];

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  while (requestTimestamps.length > 0 && requestTimestamps[0]! < now - RATE_WINDOW_MS) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= RATE_LIMIT) {
    const oldest = requestTimestamps[0]!;
    const waitMs = oldest + RATE_WINDOW_MS - now + 50;
    log.debug(MCP_NAME, SERVICE, 'rate-limit', `Throttling ${waitMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return waitForRateLimit();
  }
  requestTimestamps.push(Date.now());
}

interface CanvaError {
  _error: true;
  error: string;
  code: string;
  retryable: boolean;
  latencyMs: number;
}

type CanvaResponse = Record<string, any> & { _latencyMs?: number };

async function canvaFetch(
  method: string,
  path: string,
  opts?: { query?: Record<string, unknown>; body?: unknown; raw?: boolean },
): Promise<CanvaResponse | CanvaError> {
  await waitForRateLimit();
  const url = new URL(`${CANVA_API_BASE}${path}`);
  if (opts?.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const token = await getAccessToken();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  let body: BodyInit | undefined;
  if (opts?.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const start = Date.now();
  const res = await fetch(url.toString(), { method, headers, body });
  const latencyMs = Date.now() - start;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return {
      _error: true,
      error: `Canva API ${res.status}: ${text || res.statusText}`,
      code: `CANVA_${res.status}`,
      retryable: res.status === 429 || res.status >= 500,
      latencyMs,
    };
  }
  if (res.status === 204) return { _latencyMs: latencyMs };
  const data = (await res.json()) as CanvaResponse;
  data._latencyMs = latencyMs;
  return data;
}

function isError(data: any): data is CanvaError {
  return data && data._error === true;
}

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(data: any) {
  const { _error, ...rest } = data;
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(rest, null, 2) }],
    isError: true,
  };
}

async function pollExportJob(
  jobId: string,
  errorHandler: UnifiedErrorHandler,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<CanvaResponse | CanvaError> {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const intervalMs = opts.intervalMs ?? 2_000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await errorHandler.executeWithRetry(SERVICE, 'export_poll', async () => {
      const r = await canvaFetch('GET', `/exports/${jobId}`);
      if (isError(r)) throw Object.assign(new Error(r.error), r);
      return r;
    });
    const status = res?.job?.status;
    if (status === 'success' || status === 'failed') return res;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return {
    _error: true,
    error: `Export job ${jobId} did not complete within ${timeoutMs}ms`,
    code: 'CANVA_EXPORT_TIMEOUT',
    retryable: false,
    latencyMs: 0,
  };
}

export async function canvaHealth(): Promise<string | null> {
  const tok = await loadToken();
  if (!tok) return 'No token — run apex-canva-login';
  if (Date.now() >= tok.expiresAt - 60_000) return 'Token near/expired — will refresh on next call';
  return null;
}

export function registerCanvaTools(server: McpServer, errorHandler: UnifiedErrorHandler): number {
  if (!process.env['CANVA_CLIENT_ID'] || !process.env['CANVA_CLIENT_SECRET']) {
    log.warn(
      MCP_NAME,
      SERVICE,
      'startup',
      'CANVA_CLIENT_ID / CANVA_CLIENT_SECRET not set — Canva tools unavailable',
    );
    return 0;
  }

  let registered = 0;

  server.tool(
    'canva_list_brand_templates',
    'List brand templates available to the authorized Canva account.',
    {
      query: z.string().optional().describe('Filter by name'),
      limit: z.number().int().min(1).max(100).optional(),
      continuation: z.string().optional().describe('Pagination token from prior call'),
    },
    async ({ query, limit, continuation }) => {
      const data = await errorHandler.executeWithRetry(SERVICE, 'list_brand_templates', async () => {
        const r = await canvaFetch('GET', '/brand-templates', {
          query: { query, limit, continuation },
        });
        if (isError(r)) throw Object.assign(new Error(r.error), r);
        return r;
      });
      return textResult({
        results: data.items ?? [],
        continuation: data.continuation ?? null,
        totalCount: (data.items ?? []).length,
      });
    },
  );
  registered++;

  server.tool(
    'canva_get_brand_template',
    'Get a brand template and its autofillable dataset fields.',
    { brandTemplateId: z.string() },
    async ({ brandTemplateId }) => {
      const data = await errorHandler.executeWithRetry(SERVICE, 'get_brand_template', async () => {
        const r = await canvaFetch('GET', `/brand-templates/${brandTemplateId}/dataset`);
        if (isError(r)) throw Object.assign(new Error(r.error), r);
        return r;
      });
      return textResult(data);
    },
  );
  registered++;

  server.tool(
    'canva_create_design',
    'Create a new blank design. Use design_type for preset sizes (e.g. "presentation", "doc") or provide custom dimensions.',
    {
      designType: z.string().optional().describe('Preset type name (e.g. "presentation", "instagram-post")'),
      width: z.number().int().positive().optional().describe('Custom width in px (with height)'),
      height: z.number().int().positive().optional().describe('Custom height in px (with width)'),
      title: z.string().optional().describe('Design title'),
      assetId: z.string().optional().describe('Asset ID to use as the initial design content'),
    },
    async ({ designType, width, height, title, assetId }) => {
      const body: any = {};
      if (designType) body.design_type = { type: 'preset', name: designType };
      if (width && height) body.design_type = { type: 'custom', width, height };
      if (title) body.title = title;
      if (assetId) body.asset_id = assetId;
      const data = await errorHandler.executeWithRetry(SERVICE, 'create_design', async () => {
        const r = await canvaFetch('POST', '/designs', { body });
        if (isError(r)) throw Object.assign(new Error(r.error), r);
        return r;
      });
      return textResult(data);
    },
  );
  registered++;

  server.tool(
    'canva_autofill_brand_template',
    'Create a new design from a brand template with data-autofilled fields. Returns an async job — poll with canva_get_autofill_job.',
    {
      brandTemplateId: z.string(),
      data: z
        .record(
          z.union([
            z.object({ type: z.literal('text'), text: z.string() }),
            z.object({ type: z.literal('image'), asset_id: z.string() }),
            z.object({ type: z.literal('chart'), chart_data: z.any() }),
          ]),
        )
        .describe('Field-name → value map. Values are { type: "text"|"image"|"chart", ... }'),
      title: z.string().optional(),
    },
    async ({ brandTemplateId, data, title }) => {
      const body: any = { brand_template_id: brandTemplateId, data };
      if (title) body.title = title;
      const res = await errorHandler.executeWithRetry(SERVICE, 'autofill', async () => {
        const r = await canvaFetch('POST', '/autofills', { body });
        if (isError(r)) throw Object.assign(new Error(r.error), r);
        return r;
      });
      return textResult(res);
    },
  );
  registered++;

  server.tool(
    'canva_get_autofill_job',
    'Get the status of an autofill job. Status is one of: in_progress, success, failed.',
    { jobId: z.string() },
    async ({ jobId }) => {
      const data = await errorHandler.executeWithRetry(SERVICE, 'get_autofill_job', async () => {
        const r = await canvaFetch('GET', `/autofills/${jobId}`);
        if (isError(r)) throw Object.assign(new Error(r.error), r);
        return r;
      });
      return textResult(data);
    },
  );
  registered++;

  server.tool(
    'canva_get_design',
    'Get a design by ID, including URLs and thumbnail.',
    { designId: z.string() },
    async ({ designId }) => {
      const data = await errorHandler.executeWithRetry(SERVICE, 'get_design', async () => {
        const r = await canvaFetch('GET', `/designs/${designId}`);
        if (isError(r)) throw Object.assign(new Error(r.error), r);
        return r;
      });
      return textResult(data);
    },
  );
  registered++;

  server.tool(
    'canva_list_designs',
    'List designs owned by the authorized account.',
    {
      query: z.string().optional(),
      continuation: z.string().optional(),
      ownership: z.enum(['any', 'owned', 'shared']).optional(),
      sortBy: z.enum(['relevance', 'modified_descending', 'modified_ascending', 'title_descending', 'title_ascending']).optional(),
    },
    async ({ query, continuation, ownership, sortBy }) => {
      const data = await errorHandler.executeWithRetry(SERVICE, 'list_designs', async () => {
        const r = await canvaFetch('GET', '/designs', {
          query: { query, continuation, ownership, sort_by: sortBy },
        });
        if (isError(r)) throw Object.assign(new Error(r.error), r);
        return r;
      });
      return textResult({
        results: data.items ?? [],
        continuation: data.continuation ?? null,
        totalCount: (data.items ?? []).length,
      });
    },
  );
  registered++;

  server.tool(
    'canva_export_design',
    'Export a design as PDF, PNG, JPG, GIF, PPTX, or MP4. Starts an async job and polls until done (default 120s timeout).',
    {
      designId: z.string(),
      format: z.enum(['pdf', 'png', 'jpg', 'gif', 'pptx', 'mp4']).default('png'),
      pages: z.array(z.number().int().positive()).optional().describe('Pages to export (1-indexed). Omit for all pages.'),
      quality: z.enum(['regular', 'pro']).optional().describe('PDF quality — "pro" is Canva Pro only'),
      size: z.enum(['thumbnail', 'small', 'medium', 'large']).optional().describe('PNG/JPG size'),
      timeoutMs: z.number().int().positive().optional(),
      pollIntervalMs: z.number().int().positive().optional(),
    },
    async ({ designId, format, pages, quality, size, timeoutMs, pollIntervalMs }) => {
      const formatObj: any = { type: format };
      if (pages) formatObj.pages = pages;
      if (format === 'pdf' && quality) formatObj.export_quality = quality;
      if ((format === 'png' || format === 'jpg') && size) formatObj.size = size;
      const create = await errorHandler.executeWithRetry(SERVICE, 'export_create', async () => {
        const r = await canvaFetch('POST', '/exports', {
          body: { design_id: designId, format: formatObj },
        });
        if (isError(r)) throw Object.assign(new Error(r.error), r);
        return r;
      });
      const jobId = create?.job?.id;
      if (!jobId) return textResult(create);
      const final = await pollExportJob(jobId, errorHandler, { timeoutMs, intervalMs: pollIntervalMs });
      if (isError(final)) return errorResult(final);
      return textResult(final);
    },
  );
  registered++;

  server.tool(
    'canva_upload_asset_from_url',
    'Upload an asset to the authorized user\'s Canva account by URL. Returns asset metadata including asset_id.',
    {
      url: z.string().url(),
      name: z.string().optional(),
    },
    async ({ url, name }) => {
      const fetched = await fetch(url);
      if (!fetched.ok) {
        return errorResult({
          _error: true,
          error: `Failed to fetch source URL: ${fetched.status}`,
          code: 'CANVA_UPLOAD_SOURCE_FETCH_FAILED',
          retryable: true,
          latencyMs: 0,
        });
      }
      const buf = Buffer.from(await fetched.arrayBuffer());
      const token = await getAccessToken();
      const meta = {
        name_base64: Buffer.from(name ?? url.split('/').pop() ?? 'upload').toString('base64'),
      };
      await waitForRateLimit();
      const start = Date.now();
      const res = await fetch(`${CANVA_API_BASE}/asset-uploads`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
          'Asset-Upload-Metadata': JSON.stringify(meta),
        },
        body: buf,
      });
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        return errorResult({
          _error: true,
          error: `Canva API ${res.status}: ${await res.text()}`,
          code: `CANVA_${res.status}`,
          retryable: res.status === 429 || res.status >= 500,
          latencyMs,
        });
      }
      const data = (await res.json()) as CanvaResponse;
      return textResult(data);
    },
  );
  registered++;

  server.tool(
    'canva_list_folders',
    'List folders in the authorized user\'s account.',
    {
      continuation: z.string().optional(),
    },
    async ({ continuation }) => {
      const data = await errorHandler.executeWithRetry(SERVICE, 'list_folders', async () => {
        const r = await canvaFetch('GET', '/folders', { query: { continuation } });
        if (isError(r)) throw Object.assign(new Error(r.error), r);
        return r;
      });
      return textResult({
        results: data.items ?? [],
        continuation: data.continuation ?? null,
        totalCount: (data.items ?? []).length,
      });
    },
  );
  registered++;

  log.info(MCP_NAME, SERVICE, 'startup', `Registered ${registered} Canva tools`);
  return registered;
}
