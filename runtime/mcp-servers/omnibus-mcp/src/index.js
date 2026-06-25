/**
 * apex-omnibus-mcp — single SSE endpoint that proxies JSON-RPC to N stdio MCP children.
 * Tools are namespaced as `<server>__<tool>`. Routes by namespace.
 */
const express = require('express');
const cors = require('cors');
const { spawn, execFileSync } = require('child_process');
const { randomUUID, createHash } = require('crypto');
const readline = require('readline');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = parseInt(process.env.OMNIBUS_PORT || '3000', 10);
const HOST = process.env.OMNIBUS_HOST || '127.0.0.1';
const HOME_DIR = os.homedir();
// Monorepo root the child-server registry (SERVERS, below) resolves its paths under.
// Supplied per-install via APEX_ROOT; falls back to a conventional deploy location.
const APEX_ROOT = [
  process.env.APEX_ROOT,
  '/opt/omnibus',
].filter(Boolean).find(p => fs.existsSync(p));
const ONEPASSWORD_SSH_AUTH_SOCK = `${HOME_DIR}/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock`;
const DEFAULT_SSH_KEY = [
  process.env.APEX_OMNIBUS_SSH_KEY,
  `${HOME_DIR}/.ssh/id_ed25519`,
].filter(Boolean).find(p => fs.existsSync(p));
const CHILD_INIT_TIMEOUT_MS = 30000;
const SERVER_INCLUDE = parseList(process.env.OMNIBUS_SERVERS);
const SERVER_EXCLUDE = parseList(process.env.OMNIBUS_EXCLUDE_SERVERS);
const EXTERNAL_DEPENDENCIES = parseList(
  Object.prototype.hasOwnProperty.call(process.env, 'OMNIBUS_EXTERNAL_DEPS')
    ? process.env.OMNIBUS_EXTERNAL_DEPS
    : 'apple'
);
const EXTERNAL_DEPENDENCY_DESCRIPTIONS = {
  apple: 'desktop-local Apple MCP plugin exposed by agent runtimes; not a VPS child process',
};

function parseList(value) {
  return new Set((value || '').split(',').map(s => s.trim()).filter(Boolean));
}

function enabledServer(name) {
  if (SERVER_INCLUDE.size > 0 && !SERVER_INCLUDE.has(name)) return false;
  return !SERVER_EXCLUDE.has(name);
}

function loadEnv() {
  const env = { ...process.env };
  const envPath = `${HOME_DIR}/.mcp.env`;
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
      const m = line.match(/^(?:export\s+)?([^=]+)="?(.*?)"?$/);
      if (m) env[m[1]] = m[2];
    });
  }
  env.PATH = `${HOME_DIR}/.local/bin:${HOME_DIR}/.local/src/node-v25.9.0-darwin-arm64/bin:${HOME_DIR}/.bun/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:` + (env.PATH || '');
  if (env.SSH_AUTH_SOCK && !fs.existsSync(env.SSH_AUTH_SOCK)) {
    delete env.SSH_AUTH_SOCK;
  }
  if (!env.SSH_AUTH_SOCK && fs.existsSync(ONEPASSWORD_SSH_AUTH_SOCK)) {
    env.SSH_AUTH_SOCK = ONEPASSWORD_SSH_AUTH_SOCK;
  }
  return env;
}
const childEnv = loadEnv();

function mcpPath(relativePath) {
  return `${APEX_ROOT}/${relativePath}`;
}

// Relative dir under APEX_ROOT that holds the per-child MCP package dirs (the SERVERS registry below
// resolves its leaves under it). Override per-install via OMNIBUS_CHILD_BASE — e.g. a release-symlink
// deploy whose children live under a different layout sets it to that path. Default = a portable
// relative layout; set OMNIBUS_CHILD_BASE to the real monorepo path on a coupled install.
const CHILD_BASE = process.env.OMNIBUS_CHILD_BASE || 'packages/mcp';
function childPath(leaf) {
  return mcpPath(`${CHILD_BASE}/${leaf}`);
}

/**
 * Skill source taxonomy:
 *   apex     — first-party skills (authored in-house, evolved with the stack).
 *   curated  — vendor-published skill bundles vetted and pinned for Apex use (e.g. Cloudflare, Stripe).
 *   bundled  — Codex/OpenAI runtime-bundled skills shipped with the host CLI; pinned to a CLI version.
 *   agents   — agent-shaped skills (one per autonomous agent role) under ~/.agents/skills.
 *
 * Override at runtime via OMNIBUS_SKILL_ROOTS=name1=/abs/path1,name2=/abs/path2
 */
function parseSkillRoots() {
  if (process.env.OMNIBUS_SKILL_ROOTS) {
    return process.env.OMNIBUS_SKILL_ROOTS.split(',')
      .map((entry, index) => {
        const [rawSource, ...rawPathParts] = entry.split('=');
        if (rawPathParts.length === 0) {
          return { source: `root${index + 1}`, root: path.resolve(rawSource.trim()) };
        }
        return { source: rawSource.trim(), root: path.resolve(rawPathParts.join('=').trim()) };
      })
      .filter(entry => entry.source && entry.root);
  }

  return [
    { source: 'apex', root: mcpPath('packages/skills/codex') },
    { source: 'curated', root: mcpPath('plugins/cache/openai-curated') },
    { source: 'bundled', root: mcpPath('plugins/cache/openai-bundled') },
    { source: 'agents', root: `${APEX_ROOT}/.agents/skills` },
  ];
}

const SOURCE_DESCRIPTIONS = {
  apex: 'First-party skills (authored in-house).',
  curated: 'Vendor-published skill bundles vetted and pinned for Apex use.',
  bundled: 'Codex/OpenAI runtime-bundled skills shipped with the host CLI.',
  agents: 'Agent-shaped skills, one per autonomous agent role.',
};
const SOURCE_SEARCH_PRIORITY = {
  apex: 0,
  agents: 1,
  curated: 2,
  bundled: 3,
};

function parseFrontMatter(content) {
  if (!content.startsWith('---\n')) return {};
  const end = content.indexOf('\n---', 4);
  if (end === -1) return {};
  const meta = {};
  content.slice(4, end).split('\n').forEach(line => {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) return;
    const value = match[2].trim().replace(/^['"]|['"]$/g, '');
    meta[match[1]] = value;
  });
  return meta;
}

function findSkillFiles(root) {
  const files = [];
  const skipDirs = new Set(['.git', 'node_modules', '.venv', '__pycache__', 'latest']);

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) walk(path.join(dir, entry.name));
        continue;
      }
      if (entry.isFile() && entry.name === 'SKILL.md') {
        files.push(path.join(dir, entry.name));
      }
    }
  }

  if (root && fs.existsSync(root)) walk(root);
  return files;
}

function loadCategorySidecar(roots) {
  const map = {};
  for (const { source, root } of roots) {
    const sidecar = path.join(root, '.categories.json');
    if (!fs.existsSync(sidecar)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(sidecar, 'utf8'));
      for (const [k, v] of Object.entries(data)) {
        const key = k.includes(':') ? k : `${source}:${k}`;
        const cats = Array.isArray(v) ? v : (v == null ? [] : [String(v)]);
        map[key] = cats;
      }
    } catch (e) {
      console.error(`[omnibus] failed to read ${sidecar}: ${e.message}`);
    }
  }
  return map;
}

function normalizeSkillId(source, value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.includes(':') ? raw : `${source}:${raw.replace(/\/SKILL\.md$/i, '')}`;
}

function loadAliasSidecar(roots) {
  const map = {};
  for (const { source, root } of roots) {
    const sidecar = path.join(root, '.aliases.json');
    if (!fs.existsSync(sidecar)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(sidecar, 'utf8'));
      for (const [rawAlias, rawTarget] of Object.entries(data)) {
        const aliasId = normalizeSkillId(source, rawAlias);
        const targetValue = rawTarget && typeof rawTarget === 'object' && !Array.isArray(rawTarget)
          ? rawTarget.target
          : rawTarget;
        const targetId = normalizeSkillId(source, targetValue);
        if (aliasId && targetId) map[aliasId] = targetId;
      }
    } catch (e) {
      console.error(`[omnibus] failed to read ${sidecar}: ${e.message}`);
    }
  }
  return map;
}

function computeCategories(source, skillPath, categorySidecar) {
  const segments = skillPath.split('/');
  const pathCategories = segments.length > 1 ? [segments[0]] : [];
  const sidecarByPath = categorySidecar[`${source}:${skillPath}`] || [];
  const sidecarByBase = categorySidecar[`${source}:${path.basename(skillPath)}`] || [];
  return Array.from(new Set([...pathCategories, ...sidecarByPath, ...sidecarByBase])).sort();
}

function buildSkillIndex(roots) {
  const canonicals = [];
  const aliasMap = new Map();
  const seen = new Map();
  const categorySidecar = loadCategorySidecar(roots);
  const persistedAliases = loadAliasSidecar(roots);
  const rawCounts = {};
  let rawCount = 0;
  let skippedReadErrors = 0;

  for (const { source, root } of roots) {
    const files = findSkillFiles(root).sort();
    rawCounts[source] = (rawCounts[source] || 0) + files.length;
    rawCount += files.length;
    for (const filePath of files) {
      const relativeFile = path.relative(root, filePath).split(path.sep).join('/');
      const skillPath = relativeFile.replace(/(^|\/)SKILL\.md$/, '') || path.basename(root);
      let content, stat, meta;
      try {
        content = fs.readFileSync(filePath, 'utf8');
        stat = fs.statSync(filePath);
        meta = parseFrontMatter(content);
      } catch (e) {
        console.error(`[omnibus] skipping unreadable skill ${source}:${skillPath} — ${e.message}`);
        skippedReadErrors++;
        continue;
      }
      const id = `${source}:${skillPath}`;
      const hash = createHash('sha1').update(content).digest('hex');
      const dedupeKey = `${source}:${hash}`;

      const existing = seen.get(dedupeKey);
      if (existing) {
        const incomingShorter =
          skillPath.length < existing.skillPath.length ||
          (skillPath.length === existing.skillPath.length && skillPath < existing.skillPath);
        if (incomingShorter) {
          aliasMap.set(existing.id, existing);
          existing.aliases.push(existing.id);
          // Merge the old canonical's categories with the new canonical's: aliases
          // contribute their path-prefix categories (the original folder context that
          // the dedup would otherwise destroy).
          const mergedCategories = Array.from(new Set([
            ...computeCategories(source, skillPath, categorySidecar),
            ...existing.categories,
          ])).sort();
          existing.id = id;
          existing.name = meta.name || path.basename(skillPath);
          existing.description = meta.description || existing.description;
          existing.mcpDependencies = meta.mcp_dependencies || existing.mcpDependencies;
          existing.userInvocable = meta['user-invocable'] || existing.userInvocable;
          existing.relativePath = relativeFile;
          existing.skillPath = skillPath;
          existing.filePath = filePath;
          existing.sizeBytes = stat.size;
          existing.updatedAt = stat.mtime.toISOString();
          existing.categories = mergedCategories;
        } else {
          existing.aliases.push(id);
          // Even when the duplicate isn't promoted, contribute its path-prefix
          // category to the canonical so search by the alias category still finds it.
          const aliasCats = computeCategories(source, skillPath, categorySidecar);
          if (aliasCats.length) {
            existing.categories = Array.from(new Set([...existing.categories, ...aliasCats])).sort();
          }
        }
        aliasMap.set(id, existing);
        continue;
      }

      const categories = computeCategories(source, skillPath, categorySidecar);

      const entry = {
        id,
        source,
        name: meta.name || path.basename(skillPath),
        description: meta.description || '',
        mcpDependencies: meta.mcp_dependencies || '',
        userInvocable: meta['user-invocable'] || '',
        relativePath: relativeFile,
        skillPath,
        filePath,
        sizeBytes: stat.size,
        updatedAt: stat.mtime.toISOString(),
        contentHash: hash,
        aliases: [],
        categories,
      };
      seen.set(dedupeKey, entry);
      canonicals.push(entry);
    }
  }

  const canonicalById = new Map(canonicals.map(skill => [skill.id, skill]));
  for (const [aliasId, targetId] of Object.entries(persistedAliases)) {
    const canonical = canonicalById.get(targetId) || aliasMap.get(targetId);
    if (!canonical || aliasId === canonical.id) continue;
    if (!canonical.aliases.includes(aliasId)) canonical.aliases.push(aliasId);
    aliasMap.set(aliasId, canonical);

    const aliasSource = aliasId.split(':')[0];
    const aliasPath = aliasId.slice(aliasSource.length + 1);
    const aliasCats = computeCategories(aliasSource, aliasPath, categorySidecar);
    if (aliasCats.length) {
      canonical.categories = Array.from(new Set([...canonical.categories, ...aliasCats])).sort();
    }
  }

  canonicals.sort((a, b) => a.id.localeCompare(b.id));
  if (skippedReadErrors > 0) {
    console.error(`[omnibus] WARN ${skippedReadErrors} skill file(s) were skipped due to read errors — see lines above for details.`);
  }
  return { canonicals, aliasMap, rawCount, rawCounts };
}

const skillRoots = parseSkillRoots().filter(entry => fs.existsSync(entry.root));
const {
  canonicals: skillIndex,
  aliasMap: skillAliasMap,
  rawCount: skillRawCount,
  rawCounts: skillRawCountBySource,
} = buildSkillIndex(skillRoots);
const skillById = new Map(skillIndex.map(skill => [skill.id, skill]));
for (const [aliasId, canonical] of skillAliasMap) {
  if (!skillById.has(aliasId)) skillById.set(aliasId, canonical);
}

function normalizeLimit(value, defaultValue = 50, maxValue = 500) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return Math.min(parsed, maxValue);
}

function skillSummary(skill) {
  return {
    id: skill.id,
    source: skill.source,
    name: skill.name,
    description: skill.description,
    mcpDependencies: skill.mcpDependencies,
    userInvocable: skill.userInvocable,
    relativePath: skill.relativePath,
    sizeBytes: skill.sizeBytes,
    updatedAt: skill.updatedAt,
    aliases: skill.aliases || [],
    categories: skill.categories || [],
  };
}

function listSkills({ source, limit } = {}) {
  const max = normalizeLimit(limit);
  const skills = skillIndex.filter(skill => !source || skill.source === source);
  const visibleSkills = source ? skills : dedupeSkillEntries(skills);
  return visibleSkills
    .sort(compareSkillEntries)
    .slice(0, max)
    .map(skillSummary);
}

function tokenizeSkillSearchQuery(query) {
  return Array.from(new Set(String(query || '')
    .toLowerCase()
    .split(/[^a-z0-9.+#_-]+/)
    .map(token => token.trim())
    .filter(Boolean)));
}

function skillSearchHaystack(skill) {
  return [
    skill.id,
    skill.name,
    skill.description,
    skill.mcpDependencies,
    skill.relativePath,
    skill.skillPath,
    ...(skill.aliases || []),
    ...(skill.categories || []),
  ].map(value => String(value || '').toLowerCase()).join('\n');
}

function minimumSkillSearchMatches(tokenCount) {
  if (tokenCount <= 2) return tokenCount;
  return Math.max(2, Math.ceil(tokenCount * 0.5));
}

function skillSearchScore(skill, query) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return 1;

  const haystack = skillSearchHaystack(skill);
  const phraseMatch = haystack.includes(q);
  const tokens = tokenizeSkillSearchQuery(q);
  const matchedTokens = tokens.filter(token => haystack.includes(token));

  if (!phraseMatch) {
    if (tokens.length === 0) return 0;
    if (matchedTokens.length < minimumSkillSearchMatches(tokens.length)) return 0;
  }

  const tokenCoverage = tokens.length > 0 ? matchedTokens.length / tokens.length : 0;
  let score = matchedTokens.length * 10 + Math.round(tokenCoverage * 100);
  if (phraseMatch) score += 1000;
  if (String(skill.name || '').toLowerCase().includes(q)) score += 500;
  if (String(skill.id || '').toLowerCase().includes(q)) score += 300;
  if (String(skill.description || '').toLowerCase().includes(q)) score += 100;
  return score;
}

function skillSearchDedupeKey(skill) {
  if (skill.contentHash) return `hash:${skill.contentHash}`;
  return `meta:${String(skill.name || '').toLowerCase()}\0${String(skill.description || '').toLowerCase()}`;
}

function sourceSearchPriority(source) {
  return SOURCE_SEARCH_PRIORITY[source] ?? 100;
}

function compareSkillEntries(a, b) {
  const sourceDiff = sourceSearchPriority(a.source) - sourceSearchPriority(b.source);
  if (sourceDiff !== 0) return sourceDiff;
  return a.id.localeCompare(b.id);
}

function preferSkillEntry(candidate, existing) {
  return compareSkillEntries(candidate, existing) < 0;
}

function dedupeSkillEntries(skills) {
  const bestByKey = new Map();
  for (const skill of skills) {
    const key = skillSearchDedupeKey(skill);
    const existing = bestByKey.get(key);
    if (!existing || preferSkillEntry(skill, existing)) {
      bestByKey.set(key, skill);
    }
  }
  return Array.from(bestByKey.values());
}

function compareSkillSearchMatches(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  return compareSkillEntries(a.skill, b.skill);
}

function dedupeSkillSearchMatches(matches) {
  const bestByKey = new Map();
  for (const match of matches) {
    const key = skillSearchDedupeKey(match.skill);
    const existing = bestByKey.get(key);
    if (!existing || compareSkillSearchMatches(match, existing) < 0) {
      bestByKey.set(key, match);
    }
  }
  return Array.from(bestByKey.values());
}

function searchSkills({ query, source, limit } = {}) {
  const q = (query || '').toLowerCase().trim();
  const max = normalizeLimit(limit);
  const matches = skillIndex
    .filter(skill => !source || skill.source === source)
    .map(skill => ({ skill, score: skillSearchScore(skill, q) }))
    .filter(({ score }) => score > 0);

  return dedupeSkillSearchMatches(matches)
    .sort(compareSkillSearchMatches)
    .map(({ skill }) => skill)
    .slice(0, max)
    .map(skillSummary);
}

function getSkill(id) {
  const skill = skillById.get(id);
  if (!skill) {
    const err = new Error(`unknown skill id: ${id}`);
    err.statusCode = 404;
    throw err;
  }
  return {
    ...skillSummary(skill),
    content: fs.readFileSync(skill.filePath, 'utf8'),
  };
}

function parseSkillDeps(raw) {
  return String(raw || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(dep => dep.replace(/^mcp-/i, ''));
}

function validateSkillDependencies() {
  const aliveSubservers = new Set(children.filter(c => c.alive).map(c => c.name));
  const allSubservers = new Set(children.map(c => c.name));
  const orphans = [];
  const externalDependencyHits = [];
  const skillCountByDep = {};

  for (const skill of skillIndex) {
    const deps = parseSkillDeps(skill.mcpDependencies);
    const external = deps.filter(d => !allSubservers.has(d) && EXTERNAL_DEPENDENCIES.has(d));
    const missing = deps.filter(d => !allSubservers.has(d) && !EXTERNAL_DEPENDENCIES.has(d));
    const down = deps.filter(d => allSubservers.has(d) && !aliveSubservers.has(d));
    for (const d of deps) {
      skillCountByDep[d] = (skillCountByDep[d] || 0) + 1;
    }
    if (external.length) {
      externalDependencyHits.push({
        id: skill.id,
        source: skill.source,
        declared: deps,
        external,
      });
    }
    if (missing.length || down.length) {
      orphans.push({
        id: skill.id,
        source: skill.source,
        declared: deps,
        missing,
        down,
      });
    }
  }

  const unusedSubservers = children
    .map(c => c.name)
    .filter(name => !skillCountByDep[name]);

  return {
    totalSkills: skillRawCount,
    canonicalSkills: skillIndex.length,
    aliasSkills: skillAliasMap.size,
    totalSubservers: children.length,
    aliveSubservers: aliveSubservers.size,
    skillsWithMissingDeps: orphans.filter(o => o.missing.length).length,
    skillsWithDownDeps: orphans.filter(o => o.down.length).length,
    skillsWithExternalDeps: externalDependencyHits.length,
    orphans,
    externalDependencyHits,
    externalDependencies: Array.from(EXTERNAL_DEPENDENCIES).map(name => ({
      name,
      description: EXTERNAL_DEPENDENCY_DESCRIPTIONS[name] || '',
    })),
    skillCountByDep,
    unusedSubservers,
    sources: skillRoots.map(({ source, root }) => ({
      source,
      root,
      description: SOURCE_DESCRIPTIONS[source] || '',
      count: skillIndex.filter(s => s.source === source).length,
      rawCount: skillRawCountBySource[source] || 0,
    })),
  };
}

function textResult(value) {
  return {
    content: [{
      type: 'text',
      text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
    }],
  };
}

function redactSecretText(value, secret) {
  if (!secret || typeof value !== 'string') return value;
  return value.split(secret).join('[REDACTED]');
}

function getMacKeychainSecret(service, account) {
  if (process.platform !== 'darwin') return null;
  try {
    return execFileSync('security', [
      'find-generic-password',
      '-s',
      service,
      '-a',
      account,
      '-w',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

function getApifyToken() {
  const envToken = childEnv.APIFY_API_TOKEN || childEnv.APIFY_TOKEN;
  if (envToken) return envToken;

  const accounts = Array.from(new Set([
    process.env.USER,
    os.userInfo().username,
  ].filter(Boolean)));

  for (const account of accounts) {
    const token = getMacKeychainSecret('apify-api', account);
    if (token) return token;
  }

  return null;
}

function clampInteger(value, defaultValue, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, min), max);
}

function appendOptionalParam(url, name, value) {
  if (value === undefined || value === null || value === '') return;
  url.searchParams.set(name, String(value));
}

function parseJsonOrText(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function apifyRun(args = {}) {
  const actorId = String(args.actorId || '').trim();
  if (!actorId) throw new Error('actorId is required');

  const token = getApifyToken();
  if (!token) {
    throw new Error('missing Apify token: set APIFY_API_TOKEN or add macOS Keychain item service=apify-api');
  }

  const mode = args.mode || 'sync_items';
  if (!['sync_items', 'sync_run', 'async_run'].includes(mode)) {
    throw new Error(`unsupported Apify mode: ${mode}`);
  }

  const apiBase = childEnv.APIFY_API_BASE_URL || 'https://api.apify.com';
  const encodedActorId = encodeURIComponent(actorId);
  const pathByMode = {
    sync_items: `/v2/acts/${encodedActorId}/run-sync-get-dataset-items`,
    sync_run: `/v2/acts/${encodedActorId}/run-sync`,
    async_run: `/v2/acts/${encodedActorId}/runs`,
  };
  const url = new URL(pathByMode[mode], apiBase);

  if (mode === 'async_run') {
    appendOptionalParam(url, 'waitForFinish', clampInteger(args.waitForFinishSecs, 0, 0, 300));
  } else {
    appendOptionalParam(url, 'timeout', clampInteger(args.timeoutSecs, 60, 1, 300));
  }
  if (mode === 'sync_items') {
    appendOptionalParam(url, 'limit', clampInteger(args.maxItems, 50, 1, 1000));
    appendOptionalParam(url, 'clean', args.clean === false ? 'false' : 'true');
  }
  appendOptionalParam(url, 'memory', args.memoryMbytes);
  appendOptionalParam(url, 'build', args.build);

  const controller = new AbortController();
  const hardTimeoutMs = clampInteger(args.hardTimeoutSecs, 330, 5, 360) * 1000;
  const timeout = setTimeout(() => controller.abort(), hardTimeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args.input || {}),
      signal: controller.signal,
    });
    const rawText = await response.text();
    const body = parseJsonOrText(redactSecretText(rawText, token));

    if (!response.ok) {
      const detail = typeof body === 'string' ? body : JSON.stringify(body);
      throw new Error(`Apify ${response.status} ${response.statusText}: ${detail.slice(0, 1000)}`);
    }

    return textResult({
      ok: true,
      status: response.status,
      actorId,
      mode,
      itemCount: Array.isArray(body) ? body.length : undefined,
      result: body,
    });
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error(`Apify request exceeded hard timeout of ${hardTimeoutMs / 1000}s`);
    }
    throw new Error(redactSecretText(e.message, token));
  } finally {
    clearTimeout(timeout);
  }
}

const localTools = [
  {
    name: 'apify_run',
    description: 'Run an Apify Actor using the configured Apify token. Supports synchronous dataset items, synchronous run metadata, or async run creation without exposing the token in URLs.',
    inputSchema: {
      type: 'object',
      properties: {
        actorId: { type: 'string', description: 'Apify Actor id, preferably username~actor-name format.' },
        input: { type: 'object', description: 'JSON input passed to the Actor. Defaults to an empty object.' },
        mode: {
          type: 'string',
          enum: ['sync_items', 'sync_run', 'async_run'],
          description: 'sync_items returns dataset items, sync_run returns run metadata, async_run starts a run. Defaults to sync_items.',
        },
        timeoutSecs: { type: 'number', description: 'Apify sync timeout in seconds. Defaults to 60, max 300.' },
        hardTimeoutSecs: { type: 'number', description: 'Local request hard timeout in seconds. Defaults to 330, max 360.' },
        waitForFinishSecs: { type: 'number', description: 'For async_run, seconds to wait for completion before returning. Defaults to 0, max 300.' },
        maxItems: { type: 'number', description: 'For sync_items, maximum dataset items returned. Defaults to 50, max 1000.' },
        clean: { type: 'boolean', description: 'For sync_items, request cleaned dataset items. Defaults to true.' },
        memoryMbytes: { type: 'number', description: 'Optional Actor memory in megabytes.' },
        build: { type: 'string', description: 'Optional Actor build tag or version.' },
      },
      required: ['actorId'],
      additionalProperties: false,
    },
    handler: apifyRun,
  },
  {
    name: 'skills__list',
    description: 'List centrally indexed Apex skill registry entries without returning full skill content.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Optional skill source filter such as apex, curated, bundled, or agents.' },
        limit: { type: 'number', description: 'Maximum entries to return. Defaults to 50, max 500.' },
      },
      additionalProperties: false,
    },
    handler: args => textResult({
      total: skillRawCount,
      canonicalTotal: skillIndex.length,
      aliasTotal: skillAliasMap.size,
      skills: listSkills(args),
    }),
  },
  {
    name: 'skills__search',
    description: 'Search centrally indexed Apex skills by id, name, description, dependency, or relative path.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query.' },
        source: { type: 'string', description: 'Optional skill source filter such as apex, curated, bundled, or agents.' },
        limit: { type: 'number', description: 'Maximum entries to return. Defaults to 50, max 500.' },
      },
      additionalProperties: false,
    },
    handler: args => textResult({
      total: skillRawCount,
      canonicalTotal: skillIndex.length,
      aliasTotal: skillAliasMap.size,
      skills: searchSkills(args),
    }),
  },
  {
    name: 'skills__get',
    description: 'Fetch one centrally indexed SKILL.md entry by registry id.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Skill registry id, for example apex:build-mcp-server.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: args => textResult(getSkill(args.id)),
  },
  {
    name: 'skills__health',
    description: 'Validate every skill\'s declared mcp_dependencies against the live subserver registry. Returns orphans (skills declaring deps that are missing or down), external/local plugin deps, unused subservers (no skill depends on them), per-dep usage counts, and per-source skill counts. Use to find broken skill→tool wiring before invocation.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    handler: () => textResult(validateSkillDependencies()),
  },
];
const localToolMap = new Map(localTools.map(tool => [tool.name, tool]));
const localToolDefinitions = localTools.map(({ handler, ...tool }) => tool);

function dataArgs() {
  const args = [childPath('apex-data-mcp/dist/index.js')];
  if (!process.env.APEX_PG_URL) {
    args.push('--pg-host', process.env.APEX_PG_HOST || '127.0.0.1');
    args.push('--pg-port', process.env.APEX_PG_PORT || '5432');
    args.push('--pg-db', process.env.APEX_PG_DB || 'app_db');
    args.push('--pg-user', process.env.APEX_PG_USER || 'app');
  }
  if (process.env.OMNIBUS_DATA_SSH !== '0') {
    args.push('--ssh-host', process.env.APEX_DATA_SSH_HOST || '127.0.0.1');
    args.push('--ssh-user', process.env.APEX_DATA_SSH_USER || 'remote');
  }
  if (process.env.OMNIBUS_DATA_SSH !== '0' && DEFAULT_SSH_KEY) {
    args.push('--ssh-key', DEFAULT_SSH_KEY);
  }
  return args;
}

const SERVERS = [
  { name: 'github',     cmd: 'node',                              args: [childPath('apex-github-mcp/dist/index.js')] },
  { name: 'core',       cmd: 'node',                              args: [childPath('apex-core-mcp/dist/index.js')] },
  { name: 'commerce',   cmd: 'node',                              args: [childPath('apex-commerce-mcp/dist/index.js')] },
  { name: 'automation', cmd: 'node',                              args: [childPath('apex-automation-mcp/dist/index.js')] },
  { name: 'social',     cmd: 'node',                              args: [childPath('apex-social-mcp/dist/index.js')] },
  { name: 'seo',        cmd: 'node',                              args: [childPath('apex-seo-mcp/dist/index.js')] },
  { name: 'data',       cmd: 'node',                              args: dataArgs() },
  { name: 'tools',      cmd: 'node',                              args: [childPath('apex-tools-mcp/dist/index.js')] },
  { name: 'browser',    cmd: 'node',                              args: [childPath('apex-browser-mcp/dist/index.js')] },
  { name: 'ai',         cmd: 'node',                              args: [childPath('apex-ai-mcp/dist/index.js')] },
  { name: 'apple',      cmd: `${HOME_DIR}/.bun/bin/apple-mcp`,     args: [] },
  { name: 'telemetry',  cmd: 'node',                              args: [childPath('apex-telemetry-mcp/index.js')] },
  { name: 'gdrive',     cmd: 'node',                              args: [childPath('apex-google-drive-mcp/index.js')] },
].filter(s => enabledServer(s.name));

// Two-flag state model:
//   spawned — process is running and stdio is writable. Set true after spawn, false on exit/error.
//             initChild uses this to gate its initialize+tools/list calls.
//   alive   — process AND protocol handshake both succeeded (tools registered).
//             External health checks (validateSkillDependencies, /health) use this.
// Invariant: alive ⇒ spawned. Init never marks alive=true unless it finished cleanly.
class ChildClient {
  constructor(spec) {
    this.name = spec.name;
    this.spec = spec;
    this.pending = new Map();
    this.nextId = 1;
    this.tools = [];
    this.spawned = false;
    this.alive = false;
    this.spawnProc();
  }
  spawnProc() {
    try {
      this.proc = spawn(this.spec.cmd, this.spec.args, { stdio: ['pipe', 'pipe', 'pipe'], env: childEnv });
    } catch (e) {
      console.error(`[${this.name}] spawn threw synchronously: ${e.message}`);
      this.proc = null;
      this.spawned = false;
      this.alive = false;
      return;
    }
    this.proc.on('error', (err) => {
      console.error(`[${this.name}] spawn error: ${err.message}`);
      this.spawned = false;
      this.alive = false;
      for (const [, { reject }] of this.pending) reject(new Error(`child ${this.name} spawn error: ${err.message}`));
      this.pending.clear();
    });
    this.proc.on('exit', (code) => {
      this.spawned = false;
      this.alive = false;
      console.error(`[${this.name}] exited code=${code}, will not restart automatically`);
      for (const [, { reject }] of this.pending) reject(new Error(`child ${this.name} exited`));
      this.pending.clear();
    });
    if (this.proc.stderr) this.proc.stderr.on('data', (d) => process.stderr.write(`[${this.name}] ${d}`));
    if (this.proc.stdout) {
      const rl = readline.createInterface({ input: this.proc.stdout });
      rl.on('line', (line) => {
        if (!line.trim()) return;
        let msg;
        try { msg = JSON.parse(line); } catch { return; }
        if (msg.id != null && this.pending.has(msg.id)) {
          const { resolve } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          resolve(msg);
        }
      });
    }
    this.spawned = true;
  }
  call(method, params, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      if (!this.spawned) return reject(new Error(`child ${this.name} not spawned`));
      if (!this.proc || !this.proc.stdin || this.proc.stdin.destroyed) {
        return reject(new Error(`child ${this.name} stdin unavailable`));
      }
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`child ${this.name} timeout on ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve: (msg) => { clearTimeout(timer); resolve(msg); }, reject });
      try {
        this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params: params || {} }) + '\n');
      } catch (e) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(e);
      }
    });
  }
}

let children = [];
const toolMap = new Map();
let allTools = [...localToolDefinitions];

async function initChild(child) {
  if (!child.spawned) {
    console.error(`[${child.name}] init skipped — process never spawned`);
    return;
  }
  try {
    await child.call('initialize', {
      protocolVersion: '2024-11-05',
      clientInfo: { name: 'apex-omnibus', version: '1.0.0' },
      capabilities: { tools: {} },
    }, CHILD_INIT_TIMEOUT_MS);
    if (child.proc && child.proc.stdin && !child.proc.stdin.destroyed) {
      try {
        child.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
      } catch {}
    }
    const resp = await child.call('tools/list', {}, CHILD_INIT_TIMEOUT_MS);
    const tools = resp.result?.tools || [];
    child.tools = tools;
    for (const t of tools) {
      const ns = `${child.name}__${t.name}`;
      toolMap.set(ns, { child, original: t.name });
      allTools.push({ ...t, name: ns });
    }
    child.alive = true;
    console.error(`[${child.name}] initialized with ${tools.length} tools`);
  } catch (e) {
    child.alive = false;
    console.error(`[${child.name}] init failed: ${e.message}`);
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
// Body-parser errors (malformed JSON, oversize, type mismatch) must come back as JSON-RPC,
// not Express's default HTML, so MCP clients can decode them.
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large' || err instanceof SyntaxError)) {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: `parse error: ${err.message}` },
    });
  }
  next(err);
});

const sseClients = new Map();

const SSE_HEARTBEAT_MS = 25000;

app.get('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const connId = randomUUID();
  sseClients.set(connId, res);
  res.write(`event: endpoint\ndata: /messages?connId=${connId}\n\n`);
  // Heartbeat keeps proxies/load balancers from killing the long-lived connection.
  const heartbeat = setInterval(() => {
    try { res.write(`: keep-alive ${Date.now()}\n\n`); }
    catch { clearInterval(heartbeat); sseClients.delete(connId); }
  }, SSE_HEARTBEAT_MS);
  const cleanup = () => { clearInterval(heartbeat); sseClients.delete(connId); };
  req.on('close', cleanup);
  res.on('error', cleanup);
});

function sseSend(connId, payload) {
  const sse = sseClients.get(connId);
  if (!sse) return;
  sse.write(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
}

async function handleRpcMessage(msg) {
  // JSON-RPC requires id to be present on responses; null is the canonical "unknown id" value.
  const safeId = (msg && typeof msg === 'object' && 'id' in msg) ? msg.id : null;
  const result = (payload) => ({ jsonrpc: '2.0', id: safeId, result: payload });
  const error = (payload) => ({ jsonrpc: '2.0', id: safeId, error: payload });

  if (!msg || typeof msg !== 'object') {
    return error({ code: -32600, message: 'invalid Request: body must be a JSON object' });
  }

  try {
    if (msg.method === 'initialize') {
      return result({
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'apex-omnibus', version: '1.0.0' },
        capabilities: { tools: {} },
      });
    }

    if (msg.method === 'notifications/initialized' || msg.method?.startsWith('notifications/')) {
      return null;
    }

    if (msg.method === 'tools/list') {
      return result({ tools: allTools });
    }

    if (msg.method === 'tools/call') {
      const localTool = localToolMap.get(msg.params?.name);
      if (localTool) {
        return result(await localTool.handler(msg.params?.arguments || {}));
      }

      const entry = toolMap.get(msg.params?.name);
      if (!entry) return error({ code: -32601, message: `unknown tool: ${msg.params?.name}` });

      const childResp = await entry.child.call('tools/call', { ...msg.params, name: entry.original });
      if (childResp.error) return error(childResp.error);
      return result(childResp.result);
    }

    if (msg.method === 'resources/list' || msg.method === 'prompts/list') {
      return result({ [msg.method.split('/')[0]]: [] });
    }

    if (msg.method === 'ping') {
      return result({});
    }

    return error({ code: -32601, message: `method not implemented in omnibus: ${msg.method}` });
  } catch (e) {
    return error({ code: -32000, message: e.message });
  }
}

app.post('/sse', async (req, res) => {
  const payload = await handleRpcMessage(req.body);
  if (!payload) return res.status(202).end();
  res.type('application/json').json(payload);
});

app.post('/mcp', async (req, res) => {
  const payload = await handleRpcMessage(req.body);
  if (!payload) return res.status(202).end();
  res.type('application/json').json(payload);
});

app.post('/messages', async (req, res) => {
  const rawConnId = req.query.connId;
  const connId = typeof rawConnId === 'string' ? rawConnId : null;
  const msg = req.body;
  if (!connId || !sseClients.has(connId)) return res.status(404).send('no sse');
  res.status(202).send();

  const payload = await handleRpcMessage(msg);
  if (payload) sseSend(connId, payload);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    children: children.map(c => ({ name: c.name, alive: c.alive, tools: c.tools.length })),
    localTools: localToolDefinitions.length,
    skills: {
      total: skillRawCount,
      canonicalTotal: skillIndex.length,
      aliasTotal: skillAliasMap.size,
      roots: skillRoots.map(entry => ({ source: entry.source, root: entry.root })),
    },
    totalTools: allTools.length,
  });
});

app.get('/skills/health', (req, res) => {
  res.json({ status: 'ok', ...validateSkillDependencies() });
});

app.get(['/skills', '/skills/catalog'], (req, res) => {
  res.json({
    totalSkills: skillRawCount,
    canonicalSkills: skillIndex.length,
    aliasSkills: skillAliasMap.size,
    skills: listSkills(req.query),
  });
});

app.get('/skills/search', (req, res) => {
  res.json({
    totalSkills: skillRawCount,
    canonicalSkills: skillIndex.length,
    aliasSkills: skillAliasMap.size,
    query: req.query.query || req.query.q || '',
    skills: searchSkills({ ...req.query, query: req.query.query || req.query.q }),
  });
});

app.get('/skills/content', (req, res) => {
  try {
    if (!req.query.id) return res.status(400).json({ error: 'missing id' });
    res.json(getSkill(String(req.query.id)));
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

// require.main === module guards all side effects so the file can be imported by tests
// without spawning children or binding a port.
if (require.main === module) {
  children = SERVERS.map(s => new ChildClient(s));
  (async () => {
    console.error(`[omnibus] spawning ${SERVERS.length} children...`);
    await new Promise(r => setTimeout(r, 500));
    await Promise.all(children.map(initChild));
    app.listen(PORT, HOST, () => {
      console.error(`[omnibus] listening on ${HOST}:${PORT}, ${allTools.length} tools and ${skillRawCount} raw skills (${skillIndex.length} canonical) across ${children.filter(c => c.alive).length}/${children.length} servers`);
      const health = validateSkillDependencies();
      if (health.unusedSubservers.length) {
        console.error(`[omnibus] WARN unused subservers (no skill references them): ${health.unusedSubservers.join(', ')} — author skills with mcp_dependencies pointing to these, or remove the subservers.`);
      }
      if (health.skillsWithMissingDeps) {
        console.error(`[omnibus] WARN ${health.skillsWithMissingDeps} skill(s) declare deps that no subserver provides. Run skills__health for details.`);
      }
      if (health.skillsWithDownDeps) {
        console.error(`[omnibus] WARN ${health.skillsWithDownDeps} skill(s) depend on subservers that failed to start. Run skills__health for details.`);
      }
      if (health.skillsWithExternalDeps) {
        console.error(`[omnibus] INFO ${health.skillsWithExternalDeps} skill(s) depend on external/local MCP plugins outside this gateway.`);
      }
    });
  })();
}

module.exports = {
  // Pure functions — no side effects, safe to test
  parseFrontMatter,
  parseSkillDeps,
  loadCategorySidecar,
  normalizeSkillId,
  loadAliasSidecar,
  computeCategories,
  buildSkillIndex,
  tokenizeSkillSearchQuery,
  skillSearchScore,
  searchSkills,
  minimumSkillSearchMatches,
  dedupeSkillEntries,
  dedupeSkillSearchMatches,
  // RPC + validation — depend on module-level state (skillIndex, children, app)
  handleRpcMessage,
  validateSkillDependencies,
  // Test injection point — tests can populate before calling validators
  __setChildrenForTest: (arr) => { children = arr; },
  __getChildrenForTest: () => children,
};
