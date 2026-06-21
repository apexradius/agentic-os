/**
 * Canva Connect OAuth2 token manager.
 *
 * - Authorization-code-with-PKCE flow (see login-cli.ts for the initial dance).
 * - Access tokens expire in 4h; refresh tokens rotate on each use.
 * - Persists the latest refresh token to CANVA_TOKEN_FILE (default ~/.apex-canva-mcp/token.json)
 *   so long-lived MCP sessions survive restarts.
 */
import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const CANVA_AUTHORIZE_URL = 'https://www.canva.com/api/oauth/authorize';
export const CANVA_TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token';
export const CANVA_API_BASE = 'https://api.canva.com/rest/v1';

export const DEFAULT_SCOPES = [
  'design:content:read',
  'design:content:write',
  'design:meta:read',
  'design:permission:read',
  'design:permission:write',
  'asset:read',
  'asset:write',
  'brandtemplate:meta:read',
  'brandtemplate:content:read',
  'folder:read',
  'folder:write',
  'comment:read',
  'comment:write',
  'profile:read',
].join(' ');

export interface StoredToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  obtainedAt: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

function tokenPath(): string {
  return process.env['CANVA_TOKEN_FILE'] ?? join(homedir(), '.apex-canva-mcp', 'token.json');
}

function clientId(): string {
  const id = process.env['CANVA_CLIENT_ID'];
  if (!id) throw new Error('CANVA_CLIENT_ID is not set');
  return id;
}

function clientSecret(): string {
  const s = process.env['CANVA_CLIENT_SECRET'];
  if (!s) throw new Error('CANVA_CLIENT_SECRET is not set');
  return s;
}

function basicAuthHeader(): string {
  return 'Basic ' + Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64');
}

export async function loadToken(): Promise<StoredToken | null> {
  try {
    const raw = await fs.readFile(tokenPath(), 'utf8');
    return JSON.parse(raw) as StoredToken;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}

export async function saveToken(token: StoredToken): Promise<void> {
  const p = tokenPath();
  await fs.mkdir(dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(token, null, 2), { mode: 0o600 });
}

function fromResponse(r: TokenResponse): StoredToken {
  const now = Date.now();
  return {
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    expiresAt: now + r.expires_in * 1000,
    scope: r.scope,
    obtainedAt: now,
  };
}

export async function exchangeCodeForToken(args: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<StoredToken> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: args.code,
    code_verifier: args.codeVerifier,
    redirect_uri: args.redirectUri,
  });
  const res = await fetch(CANVA_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Canva token exchange failed: ${res.status} ${await res.text()}`);
  }
  const tok = fromResponse((await res.json()) as TokenResponse);
  await saveToken(tok);
  return tok;
}

async function refreshToken(rt: string): Promise<StoredToken> {
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: rt });
  const res = await fetch(CANVA_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Canva refresh failed: ${res.status} ${await res.text()}`);
  }
  const tok = fromResponse((await res.json()) as TokenResponse);
  await saveToken(tok);
  return tok;
}

let cached: StoredToken | null = null;

export async function getAccessToken(): Promise<string> {
  if (!cached) cached = await loadToken();
  if (!cached) {
    throw new Error(
      'No Canva token found. Run `apex-canva-login` once to authorize, or set CANVA_TOKEN_FILE.',
    );
  }
  if (Date.now() >= cached.expiresAt - 60_000) {
    cached = await refreshToken(cached.refreshToken);
  }
  return cached.accessToken;
}

export function invalidateCache(): void {
  cached = null;
}
