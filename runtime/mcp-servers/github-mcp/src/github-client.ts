/**
 * GitHub REST API client for apex-github-mcp.
 *
 * Centralizes all HTTP calls to the GitHub API with proper auth,
 * error handling, timeout, retry, and input validation helpers.
 */

import { execFileSync } from 'node:child_process';

const API_BASE = 'https://api.github.com';
const GH_TOKEN_TIMEOUT_MS = 2000;

// ---------------------------------------------------------------------------
// Error hierarchy
// ---------------------------------------------------------------------------

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly response?: unknown,
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

export class ValidationError extends GitHubApiError {
  constructor(message: string, status: number, response?: unknown) {
    super(message, status, response);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends GitHubApiError {
  constructor(resource: string) {
    super(`Resource not found: ${resource}`, 404, { message: `${resource} not found` });
    this.name = 'NotFoundError';
  }
}

export class AuthenticationError extends GitHubApiError {
  constructor(message = 'Authentication failed') {
    super(message, 401, { message });
    this.name = 'AuthenticationError';
  }
}

export class PermissionError extends GitHubApiError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, { message });
    this.name = 'PermissionError';
  }
}

export class RateLimitError extends GitHubApiError {
  public readonly resetAt: Date;
  constructor(message = 'Rate limit exceeded', resetAt: Date) {
    super(message, 429, { message, reset_at: resetAt.toISOString() });
    this.resetAt = resetAt;
    this.name = 'RateLimitError';
  }
}

export class ConflictError extends GitHubApiError {
  constructor(message: string) {
    super(message, 409, { message });
    this.name = 'ConflictError';
  }
}

export function isGitHubApiError(err: unknown): err is GitHubApiError {
  return err instanceof GitHubApiError;
}

// ---------------------------------------------------------------------------
// Error factory — maps HTTP status codes to typed errors
// ---------------------------------------------------------------------------

function createApiError(
  status: number,
  body: Record<string, unknown>,
  headers?: Headers,
): GitHubApiError {
  const msg = (body?.message as string) ?? 'GitHub API error';
  switch (status) {
    case 401:
      return new AuthenticationError(msg);
    case 403:
      return new PermissionError(msg);
    case 404:
      return new NotFoundError(msg);
    case 409:
      return new ConflictError(msg);
    case 422:
      return new ValidationError(msg, status, body);
    case 429: {
      const resetEpoch = headers?.get('x-ratelimit-reset');
      const resetDate = resetEpoch
        ? new Date(Number(resetEpoch) * 1000)
        : new Date(Date.now() + 60_000);
      return new RateLimitError(msg, resetDate);
    }
    default:
      return new GitHubApiError(msg, status, body);
  }
}

// ---------------------------------------------------------------------------
// Format error for tool output
// ---------------------------------------------------------------------------

export function formatApiError(error: GitHubApiError): string {
  if (error instanceof ValidationError) {
    let msg = `Validation Error: ${error.message}`;
    if (error.response) msg += `\nDetails: ${JSON.stringify(error.response)}`;
    return msg;
  }
  if (error instanceof NotFoundError) return `Not Found: ${error.message}`;
  if (error instanceof AuthenticationError) return `Authentication Failed: ${error.message}`;
  if (error instanceof PermissionError) return `Permission Denied: ${error.message}`;
  if (error instanceof RateLimitError) return `Rate Limit Exceeded: ${error.message}\nResets at: ${error.resetAt.toISOString()}`;
  if (error instanceof ConflictError) return `Conflict: ${error.message}`;
  return `GitHub API Error: ${error.message}`;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

interface AuthCandidate {
  source: string;
  token: string;
}

let cachedGhToken: string | undefined;
let checkedGhToken = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseBody(res: Response): Promise<unknown> {
  const ct = res.headers.get('content-type');
  if (ct?.includes('application/json')) return res.json();
  return res.text();
}

function toErrorBody(body: unknown): Record<string, unknown> {
  return (body && typeof body === 'object' ? body : { message: String(body) }) as Record<string, unknown>;
}

function getGhCliToken(): string | undefined {
  if (checkedGhToken) return cachedGhToken;
  checkedGhToken = true;
  try {
    cachedGhToken = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: GH_TOKEN_TIMEOUT_MS,
    }).trim();
  } catch {
    cachedGhToken = undefined;
  }
  return cachedGhToken;
}

function getAuthCandidates(): AuthCandidate[] {
  const candidates: AuthCandidate[] = [];
  const seen = new Set<string>();
  const add = (source: string, token: string | undefined) => {
    const trimmed = token?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    candidates.push({ source, token: trimmed });
  };

  add('GITHUB_TOKEN', process.env['GITHUB_TOKEN']);
  add('GH_TOKEN', process.env['GH_TOKEN']);
  add('GITHUB_PERSONAL_ACCESS_TOKEN', process.env['GITHUB_PERSONAL_ACCESS_TOKEN']);
  add('gh', getGhCliToken());

  return candidates;
}

function buildHeaders(options: RequestOptions, auth?: AuthCandidate): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'apex-github-mcp/1.0.0',
    ...options.headers,
  };

  if (auth) headers['Authorization'] = `Bearer ${auth.token}`;
  return headers;
}

export function hasGitHubAuthCandidate(): boolean {
  return getAuthCandidates().length > 0;
}

export async function githubRequest<T = unknown>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const authCandidates = getAuthCandidates();
  let authIndex = authCandidates.length > 0 ? 0 : -1;

  const maxRetries = 2;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    let res: Response;
    try {
      res = await fetch(url, {
        method: options.method ?? 'GET',
        headers: buildHeaders(options, authCandidates[authIndex]),
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (attempt < maxRetries) {
        lastError = err instanceof Error ? err : new Error(String(err));
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new GitHubApiError('Request timed out after 10s', 0);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    const body = await parseBody(res);

    if (res.ok) {
      return body as T;
    }

    // If one configured token is stale, try the next available token source.
    if (res.status === 401 && authIndex >= 0 && authIndex < authCandidates.length - 1) {
      authIndex += 1;
      attempt = -1;
      continue;
    }

    // 429 — rate limit: wait for reset, retry once
    if (res.status === 429 && attempt < maxRetries) {
      const resetEpoch = res.headers.get('x-ratelimit-reset');
      if (resetEpoch) {
        const waitMs = Math.max(0, Number(resetEpoch) * 1000 - Date.now()) + 1000;
        await sleep(Math.min(waitMs, 60_000));
        continue;
      }
    }

    // 5xx — server error: retry with backoff
    if (res.status >= 500 && attempt < maxRetries) {
      lastError = createApiError(res.status, toErrorBody(body), res.headers);
      await sleep(1000 * 2 ** attempt);
      continue;
    }

    // 4xx or final attempt — throw
    throw createApiError(res.status, toErrorBody(body), res.headers);
  }

  throw lastError ?? new GitHubApiError('Request failed after retries', 0);
}

// ---------------------------------------------------------------------------
// URL builder — appends non-undefined params
// ---------------------------------------------------------------------------

export function buildUrl(base: string, params: Record<string, string | undefined>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.append(key, value);
  }
  return url.toString();
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export function validateBranchName(branch: string): string {
  const s = branch.trim();
  if (!s) throw new Error('Branch name cannot be empty');
  if (s.includes('..')) throw new Error("Branch name cannot contain '..'");
  if (/[\s~^:?*[\\\]]/.test(s)) throw new Error('Branch name contains invalid characters');
  if (s.startsWith('/') || s.endsWith('/')) throw new Error("Branch name cannot start or end with '/'");
  if (s.endsWith('.lock')) throw new Error("Branch name cannot end with '.lock'");
  return s;
}

export function validateRepoName(name: string): string {
  const s = name.trim().toLowerCase();
  if (!s) throw new Error('Repository name cannot be empty');
  if (!/^[a-z0-9_.-]+$/.test(s)) throw new Error('Repository name can only contain lowercase letters, numbers, hyphens, periods, and underscores');
  if (s.startsWith('.') || s.endsWith('.')) throw new Error('Repository name cannot start or end with a period');
  return s;
}

export function validateOwnerName(owner: string): string {
  const s = owner.trim().toLowerCase();
  if (!s) throw new Error('Owner name cannot be empty');
  if (!/^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/.test(s)) throw new Error('Owner name must start with a letter or number and can contain up to 39 characters');
  return s;
}

export async function branchExists(owner: string, repo: string, branch: string): Promise<boolean> {
  try {
    await githubRequest(`${API_BASE}/repos/${owner}/${repo}/branches/${branch}`);
    return true;
  } catch (err) {
    if (err instanceof GitHubApiError && err.status === 404) return false;
    throw err;
  }
}

export async function userExists(username: string): Promise<boolean> {
  try {
    await githubRequest(`${API_BASE}/users/${username}`);
    return true;
  } catch (err) {
    if (err instanceof GitHubApiError && err.status === 404) return false;
    throw err;
  }
}
