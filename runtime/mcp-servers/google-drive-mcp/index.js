#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const STORE_DIR = path.join(os.homedir(), '.multi-gmail-mcp');
const STORE_FILE = path.join(STORE_DIR, 'tokens.enc');
const KEY_FILE = path.join(STORE_DIR, '.gmail-mcp-key');
const ALGORITHM = 'aes-256-gcm';

const DEFAULT_ACCOUNT = process.env.APEX_GOOGLE_DEFAULT_ACCOUNT || '';
// Account label -> email map. Supplied per-install via MCP_GDRIVE_ACCOUNT_MAP,
// which is either an inline JSON object or a path to a JSON file. Empty by default.
const ACCOUNT_ALIASES = (() => {
  const raw = process.env.MCP_GDRIVE_ACCOUNT_MAP;
  if (!raw) return {};
  try {
    const text = raw.trim().startsWith('{') ? raw : fs.readFileSync(raw, 'utf8');
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.error(`[gdrive] Failed to parse MCP_GDRIVE_ACCOUNT_MAP: ${err.message}`);
    return {};
  }
})();

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const DRIVE_METADATA_SCOPE = 'https://www.googleapis.com/auth/drive.metadata.readonly';
const DEFAULT_FIELDS = [
  'id',
  'name',
  'mimeType',
  'modifiedTime',
  'size',
  'webViewLink',
  'parents',
  'driveId',
].join(',');

function jsonRpc(id, payload) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, ...payload }) + '\n');
}

function textResult(value) {
  return {
    content: [
      {
        type: 'text',
        text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(message) {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  };
}

function readStoreKey() {
  if (!fs.existsSync(KEY_FILE)) {
    throw new Error(`Google token key not found at ${KEY_FILE}`);
  }
  const key = fs.readFileSync(KEY_FILE);
  if (key.length !== 32) {
    throw new Error(`Google token key is ${key.length} bytes; expected 32`);
  }
  return key;
}

function decrypt(ciphertext, key) {
  const [ivHex, tagHex, dataHex] = String(ciphertext || '').trim().split(':');
  if (!ivHex || !tagHex || !dataHex) throw new Error('Invalid token store format');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(dataHex, 'hex'), undefined, 'utf8') + decipher.final('utf8');
}

function encrypt(plaintext, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function readStore() {
  if (!fs.existsSync(STORE_FILE)) {
    return { accounts: [], tokens: {} };
  }
  const key = readStoreKey();
  const raw = fs.readFileSync(STORE_FILE, 'utf8');
  return JSON.parse(decrypt(raw, key));
}

function writeStore(store) {
  const key = readStoreKey();
  fs.writeFileSync(STORE_FILE, encrypt(JSON.stringify(store), key), { mode: 0o600 });
}

function normalizeEmail(account = DEFAULT_ACCOUNT, store = null) {
  const key = String(account || DEFAULT_ACCOUNT).trim().toLowerCase();
  if (key.includes('@')) return key;
  if (ACCOUNT_ALIASES[key]) return ACCOUNT_ALIASES[key];
  const currentStore = store || readStore();
  const match = currentStore.accounts.find((entry) => String(entry.label || '').toLowerCase() === key);
  if (match) return String(match.email).toLowerCase();
  throw new Error(`Unknown Google account '${account}'. Use an email or one of: ${Object.keys(ACCOUNT_ALIASES).join(', ')}`);
}

function hasDriveScope(scope = '') {
  const scopes = String(scope || '').split(/\s+/);
  return scopes.includes(DRIVE_SCOPE) || scopes.includes(DRIVE_METADATA_SCOPE);
}

function getClientEnv() {
  const candidates = [
    {
      source: 'apex',
      clientId: process.env.APEX_GOOGLE_CLIENT_ID,
      clientSecret: process.env.APEX_GOOGLE_CLIENT_SECRET,
    },
    {
      source: 'google',
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    {
      source: 'gmail_legacy',
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
    },
  ];
  const selected = candidates.find((candidate) => candidate.clientId || candidate.clientSecret);
  if (!selected) return { source: 'missing' };
  return selected;
}

function requireClientEnv() {
  const { clientId, clientSecret } = getClientEnv();
  if (!clientId || !clientSecret) {
    throw new Error('Missing Google OAuth credentials. Set APEX_GOOGLE_CLIENT_ID/APEX_GOOGLE_CLIENT_SECRET in the environment.');
  }
  return { clientId, clientSecret };
}

async function refreshAccessToken(email, store) {
  const tokens = store.tokens[email];
  if (!tokens || !tokens.refresh_token) {
    throw new Error(`No refresh token stored for ${email}`);
  }
  if (!hasDriveScope(tokens.scope)) {
    throw new Error(`${email} is authenticated, but missing Google Drive readonly scope. Reauth is required.`);
  }
  if (tokens.access_token && Number(tokens.expiry_date || 0) > Date.now() + 60_000) {
    return tokens.access_token;
  }

  const { clientId, clientSecret } = requireClientEnv();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Google token refresh failed for ${email}: ${body.error_description || body.error || res.status}`);
  }

  store.tokens[email] = {
    ...tokens,
    access_token: body.access_token,
    token_type: body.token_type || tokens.token_type || 'Bearer',
    expiry_date: Date.now() + Number(body.expires_in || 3600) * 1000,
    scope: body.scope || tokens.scope,
  };
  writeStore(store);
  return store.tokens[email].access_token;
}

function qs(params) {
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') urlParams.set(key, String(value));
  }
  return urlParams.toString();
}

async function driveRequest(email, endpoint, params = {}, options = {}) {
  const store = readStore();
  const accessToken = await refreshAccessToken(email, store);
  const query = qs(params);
  const url = `https://www.googleapis.com/drive/v3/${endpoint}${query ? `?${query}` : ''}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });
  if (options.raw) return res;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Google Drive API failed (${res.status}) for ${endpoint}: ${body.error?.message || res.statusText}`);
  }
  return body;
}

function escapeDriveQuery(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function clamp(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.trunc(number), min), max);
}

function formatFile(file) {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime,
    size: file.size ? Number(file.size) : undefined,
    webViewLink: file.webViewLink,
    parents: file.parents,
    driveId: file.driveId,
  };
}

async function status({ probe = false } = {}) {
  const storeExists = fs.existsSync(STORE_FILE);
  const keyExists = fs.existsSync(KEY_FILE);
  const clientEnv = getClientEnv();
  const env = {
    hasClientId: Boolean(clientEnv.clientId),
    hasClientSecret: Boolean(clientEnv.clientSecret),
    source: clientEnv.source,
  };
  const result = {
    backend: 'google-drive-api',
    tokenStore: STORE_FILE,
    storeExists,
    keyExists,
    env,
    accounts: [],
  };

  if (!storeExists || !keyExists) return result;

  const store = readStore();
  for (const account of store.accounts) {
    const email = String(account.email || '').toLowerCase();
    const tokens = store.tokens[email];
    const entry = {
      email,
      label: account.label,
      addedAt: account.addedAt,
      hasToken: Boolean(tokens),
      hasRefreshToken: Boolean(tokens?.refresh_token),
      hasDriveScope: hasDriveScope(tokens?.scope),
      scopeCount: tokens?.scope ? tokens.scope.split(/\s+/).filter(Boolean).length : 0,
    };
    if (probe && entry.hasRefreshToken && entry.hasDriveScope && env.hasClientId && env.hasClientSecret) {
      try {
        const about = await driveRequest(email, 'about', {
          fields: 'user(emailAddress,displayName),storageQuota(limit,usage,usageInDrive)',
        });
        entry.probe = { ok: true, user: about.user, storageQuota: about.storageQuota };
      } catch (error) {
        entry.probe = { ok: false, error: error.message };
      }
    }
    result.accounts.push(entry);
  }
  return result;
}

async function list({ account = DEFAULT_ACCOUNT, folderId = 'root', limit = 100, pageToken, driveId, query } = {}) {
  const store = readStore();
  const email = normalizeEmail(account, store);
  const pageSize = clamp(limit, 100, 1, 1000);
  const q = query || `'${escapeDriveQuery(folderId)}' in parents and trashed = false`;
  const body = await driveRequest(email, 'files', {
    q,
    pageSize,
    pageToken,
    driveId,
    corpora: driveId ? 'drive' : undefined,
    includeItemsFromAllDrives: 'true',
    supportsAllDrives: 'true',
    orderBy: 'folder,name_natural',
    fields: `nextPageToken,files(${DEFAULT_FIELDS})`,
  });
  return {
    account,
    email,
    folderId,
    query: q,
    nextPageToken: body.nextPageToken,
    files: (body.files || []).map(formatFile),
  };
}

async function search({ account = DEFAULT_ACCOUNT, query, limit = 50, pageToken, driveId } = {}) {
  if (!query) throw new Error('query is required');
  const store = readStore();
  const email = normalizeEmail(account, store);
  const pageSize = clamp(limit, 50, 1, 1000);
  const q = `name contains '${escapeDriveQuery(query)}' and trashed = false`;
  const body = await driveRequest(email, 'files', {
    q,
    pageSize,
    pageToken,
    driveId,
    corpora: driveId ? 'drive' : undefined,
    includeItemsFromAllDrives: 'true',
    supportsAllDrives: 'true',
    orderBy: 'modifiedTime desc',
    fields: `nextPageToken,files(${DEFAULT_FIELDS})`,
  });
  return {
    account,
    email,
    query,
    nextPageToken: body.nextPageToken,
    files: (body.files || []).map(formatFile),
  };
}

async function stat({ account = DEFAULT_ACCOUNT, fileId } = {}) {
  if (!fileId) throw new Error('fileId is required');
  const store = readStore();
  const email = normalizeEmail(account, store);
  const file = await driveRequest(email, `files/${encodeURIComponent(fileId)}`, {
    supportsAllDrives: 'true',
    fields: DEFAULT_FIELDS,
  });
  return { account, email, file: formatFile(file) };
}

async function listSharedDrives({ account = DEFAULT_ACCOUNT, limit = 100, pageToken } = {}) {
  const store = readStore();
  const email = normalizeEmail(account, store);
  const body = await driveRequest(email, 'drives', {
    pageSize: clamp(limit, 100, 1, 100),
    pageToken,
    fields: 'nextPageToken,drives(id,name,kind)',
  });
  return {
    account,
    email,
    nextPageToken: body.nextPageToken,
    drives: body.drives || [],
  };
}

function exportMimeType(mimeType) {
  if (mimeType === 'application/vnd.google-apps.document') return 'text/plain';
  if (mimeType === 'application/vnd.google-apps.presentation') return 'text/plain';
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'text/csv';
  return null;
}

async function readText({ account = DEFAULT_ACCOUNT, fileId, maxBytes = 65536 } = {}) {
  if (!fileId) throw new Error('fileId is required');
  const store = readStore();
  const email = normalizeEmail(account, store);
  const cap = clamp(maxBytes, 65536, 1, 1024 * 1024);
  const metadata = await driveRequest(email, `files/${encodeURIComponent(fileId)}`, {
    supportsAllDrives: 'true',
    fields: DEFAULT_FIELDS,
  });
  if (metadata.mimeType === 'application/vnd.google-apps.folder') {
    throw new Error('fileId points to a folder');
  }

  const exportType = exportMimeType(metadata.mimeType);
  let res;
  if (exportType) {
    res = await driveRequest(email, `files/${encodeURIComponent(fileId)}/export`, { mimeType: exportType }, { raw: true });
  } else {
    res = await driveRequest(
      email,
      `files/${encodeURIComponent(fileId)}`,
      { alt: 'media', supportsAllDrives: 'true' },
      { raw: true, headers: { Range: `bytes=0-${cap - 1}` } }
    );
  }

  if (!res.ok && res.status !== 206) {
    const message = await res.text().catch(() => res.statusText);
    throw new Error(`Google Drive read failed (${res.status}) for ${fileId}: ${message}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const clipped = buffer.subarray(0, cap);
  return {
    account,
    email,
    file: formatFile(metadata),
    exportMimeType: exportType,
    maxBytes: cap,
    truncated: buffer.length > cap || res.status === 206,
    text: clipped.toString('utf8'),
  };
}

const tools = [
  {
    name: 'status',
    description: 'Check Google Drive API connectivity using the encrypted multi-gmail token store.',
    inputSchema: {
      type: 'object',
      properties: {
        probe: { type: 'boolean', default: false },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'list',
    description: 'List files in a Google Drive folder by folderId. Defaults to the configured Google account root.',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string', default: DEFAULT_ACCOUNT },
        folderId: { type: 'string', default: 'root' },
        driveId: { type: 'string' },
        query: { type: 'string' },
        pageToken: { type: 'string' },
        limit: { type: 'number', default: 100 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'search',
    description: 'Search Google Drive filenames for the selected account.',
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: {
        account: { type: 'string', default: DEFAULT_ACCOUNT },
        query: { type: 'string' },
        driveId: { type: 'string' },
        pageToken: { type: 'string' },
        limit: { type: 'number', default: 50 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'stat',
    description: 'Return metadata for a Google Drive file or folder by fileId.',
    inputSchema: {
      type: 'object',
      required: ['fileId'],
      properties: {
        account: { type: 'string', default: DEFAULT_ACCOUNT },
        fileId: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'list_shared_drives',
    description: 'List shared drives visible to the selected Google account.',
    inputSchema: {
      type: 'object',
      properties: {
        account: { type: 'string', default: DEFAULT_ACCOUNT },
        pageToken: { type: 'string' },
        limit: { type: 'number', default: 100 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'read_text',
    description: 'Read or export a text representation of a Google Drive file by fileId.',
    inputSchema: {
      type: 'object',
      required: ['fileId'],
      properties: {
        account: { type: 'string', default: DEFAULT_ACCOUNT },
        fileId: { type: 'string' },
        maxBytes: { type: 'number', default: 65536 },
      },
      additionalProperties: false,
    },
  },
];

async function handle(msg) {
  if (msg.method === 'initialize') {
    return jsonRpc(msg.id, {
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'apex-google-drive-mcp', version: '1.1.0' },
        capabilities: { tools: {} },
      },
    });
  }

  if (msg.method === 'notifications/initialized' || msg.method?.startsWith('notifications/')) return;

  if (msg.method === 'tools/list') {
    return jsonRpc(msg.id, { result: { tools } });
  }

  if (msg.method === 'tools/call') {
    const name = msg.params?.name;
    const args = msg.params?.arguments || {};
    try {
      if (name === 'status') return jsonRpc(msg.id, { result: textResult(await status(args)) });
      if (name === 'list') return jsonRpc(msg.id, { result: textResult(await list(args)) });
      if (name === 'search') return jsonRpc(msg.id, { result: textResult(await search(args)) });
      if (name === 'stat') return jsonRpc(msg.id, { result: textResult(await stat(args)) });
      if (name === 'list_shared_drives') return jsonRpc(msg.id, { result: textResult(await listSharedDrives(args)) });
      if (name === 'read_text') return jsonRpc(msg.id, { result: textResult(await readText(args)) });
      return jsonRpc(msg.id, { error: { code: -32601, message: `unknown tool: ${name}` } });
    } catch (e) {
      return jsonRpc(msg.id, { result: errorResult(e.message) });
    }
  }

  if (msg.method === 'ping') return jsonRpc(msg.id, { result: {} });
  return jsonRpc(msg.id, { error: { code: -32601, message: `method not implemented: ${msg.method}` } });
}

readline.createInterface({ input: process.stdin }).on('line', (line) => {
  if (!line.trim()) return;
  try {
    handle(JSON.parse(line));
  } catch (e) {
    jsonRpc(null, { error: { code: -32700, message: e.message } });
  }
});
