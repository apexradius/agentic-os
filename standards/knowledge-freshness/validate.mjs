#!/usr/bin/env node
// validate.mjs — the knowledge-freshness standard, run bare or by `validate.mjs --all`. Enforces
// doctrine/standards/knowledge-freshness.md: startup authority is explicit, historical artifacts
// self-identify near the top, and current files cannot point at history without saying so. The
// framework stays generic: it discovers instance manifests (`knowledge-freshness.manifest.json`)
// instead of hardcoding Apex paths. Selftests exercise RED/GREEN fixtures on temp repos; the real
// scan validates any discovered manifests in the current tree.

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRAMEWORK_ROOT = join(__dirname, '..', '..');
const REPO_ROOT = resolve(FRAMEWORK_ROOT, '..');
const checks = [];
const ok = (name, cond, detail = '') => {
  checks.push({ name, pass: !!cond, detail });
  return !!cond;
};

const REQUIRED_TOP_LEVEL = [
  'scope_root',
  'startup_authority',
  'current_reference',
  'historical_artifact',
  'ephemeral',
  'exceptions',
  'rules',
];
const CLASS_KEYS = ['startup_authority', 'current_reference', 'historical_artifact', 'ephemeral'];
const DEFAULT_SKIP_DIR = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next']);
const FINDING_ORDER = [
  'manifest-parse',
  'manifest-shape',
  'manifest-missing-file',
  'manifest-overlap',
  'scan-target-missing',
  'unclassified-scan-file',
  'exception-expired',
  'startup-claims-history',
  'startup-historical-link-cue',
  'historical-banner-missing',
  'historical-authority-phrase',
  'retired-term-live-assertion',
  'retired-term-exemption-expired',
  'memory-freshness-missing',
  'tasks-active-order',
];
const STARTUP_STATUS_TERMS = [
  'historical record',
  'historical note',
  'historical artifact',
  'superseded',
  'checkpoint',
  'migration log',
  'reconciliation log',
  'decision record',
  'working artifact',
  'append-only',
  'plan only',
  'retirement',
  'disposition',
];
// Generic English retirement cues. When a manifest declares `retired_terms` but no
// `retired_term_cues`, the retired-term prose scan falls back to these (zone-pure: they name no
// instance, only the shape of a "this is retired" acknowledgment). A term found near one of these
// cues is treated as a retirement note, not a live assertion — same idea as `historical_link_cues`.
const DEFAULT_RETIRED_CUES = [
  'retired',
  'retire',
  'retirement',
  'dissolved',
  'disband',
  'disbanded',
  'decommission',
  'superseded',
  'supersede',
  'deprecated',
  'sunset',
  'legacy',
  'archived',
  'archive',
  'no longer',
  'not live',
  'removed',
  'defunct',
  'frozen',
  'historical',
  'dead',
  'stale',
];

function toPosix(path) {
  return String(path).split(sep).join('/');
}
function relFrom(root, path) {
  return toPosix(relative(root, path)) || '.';
}
function read(path) {
  return readFileSync(path, 'utf8');
}
function linesOf(text) {
  return String(text ?? '').split(/\r?\n/);
}
function firstLines(text, count) {
  return linesOf(text).slice(0, count).join('\n');
}
function lower(text) {
  return String(text ?? '').toLowerCase();
}
function isExternalTarget(target) {
  return /^(https?:|mailto:|tel:|#)/i.test(target);
}
function normalizeLinkTarget(target) {
  return String(target).trim().split('#')[0].split('?')[0];
}
function walkFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!DEFAULT_SKIP_DIR.has(entry.name)) walkFiles(path, acc);
      continue;
    }
    acc.push(path);
  }
  return acc;
}
// The gate governs committed knowledge source only (doctrine: "Commit source, gitignore
// artifacts"). Return the subset of `paths` that git ignores so the scan surface can drop
// them — local validate and CI (which never sees ignored files) then see the same surface.
// Degrades to an empty set when git is missing or the tree is not a repo, so non-git
// framework consumers keep scanning everything.
function gitIgnoredSet(paths, repoRoot) {
  if (!paths.length) return new Set();
  try {
    const result = spawnSync('git', ['check-ignore', '--stdin', '-z'], {
      cwd: repoRoot,
      input: paths.join('\0'),
      encoding: 'utf8',
    });
    // status 0 = some ignored, 1 = none ignored; anything else (e.g. 128 not-a-repo) or a
    // spawn error means git could not answer — fall back to no exclusions.
    if (result.error || (result.status !== 0 && result.status !== 1)) return new Set();
    return new Set(result.stdout.split('\0').filter(Boolean));
  } catch {
    return new Set();
  }
}
function findManifests(repoRoot) {
  return walkFiles(repoRoot).filter(
    (path) => basename(path) === 'knowledge-freshness.manifest.json',
  );
}
function makeFinding(rule, file, detail) {
  return { rule, file: toPosix(file), detail: detail.trim() };
}
function sortFindings(findings) {
  const order = new Map(FINDING_ORDER.map((rule, index) => [rule, index]));
  return [...findings].sort((a, b) => {
    const ao = order.has(a.rule) ? order.get(a.rule) : FINDING_ORDER.length;
    const bo = order.has(b.rule) ? order.get(b.rule) : FINDING_ORDER.length;
    if (ao !== bo) return ao - bo;
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.detail.localeCompare(b.detail);
  });
}
function formatFinding(finding) {
  return `${finding.rule} ${finding.file} :: ${finding.detail}`;
}
function parseManifest(manifestPath, repoRoot) {
  const manifestRel = relFrom(repoRoot, manifestPath);
  let raw;
  try {
    raw = JSON.parse(read(manifestPath));
  } catch (error) {
    return {
      findings: [makeFinding('manifest-parse', manifestRel, error.message)],
      context: null,
    };
  }

  const findings = [];
  for (const key of REQUIRED_TOP_LEVEL) {
    if (!(key in raw))
      findings.push(makeFinding('manifest-shape', manifestRel, `missing top-level key '${key}'`));
  }
  if (typeof raw.scope_root !== 'string' || !raw.scope_root.trim()) {
    findings.push(
      makeFinding('manifest-shape', manifestRel, 'scope_root must be a non-empty string'),
    );
  }
  for (const key of CLASS_KEYS) {
    if (!Array.isArray(raw[key]))
      findings.push(makeFinding('manifest-shape', manifestRel, `${key} must be an array`));
  }
  if (!Array.isArray(raw.exceptions))
    findings.push(makeFinding('manifest-shape', manifestRel, 'exceptions must be an array'));
  if (!raw.rules || typeof raw.rules !== 'object' || Array.isArray(raw.rules)) {
    findings.push(makeFinding('manifest-shape', manifestRel, 'rules must be an object'));
  }
  if (findings.length) return { findings, context: null };

  const ruleErrors = [];
  const rules = raw.rules;
  const mustArray = [
    'scan_roots',
    'scan_include',
    'historical_banner_terms',
    'authority_phrases',
    'historical_link_cues',
  ];
  for (const key of mustArray) {
    if (!Array.isArray(rules[key])) ruleErrors.push(`${key} must be an array`);
  }
  if (typeof rules.banner_max_lines !== 'number' || rules.banner_max_lines < 1) {
    ruleErrors.push('banner_max_lines must be a positive number');
  }
  if (typeof rules.memory_freshness_phrase !== 'string' || !rules.memory_freshness_phrase.trim()) {
    ruleErrors.push('memory_freshness_phrase must be a non-empty string');
  }
  if (
    typeof rules.memory_freshness_max_lines !== 'number' ||
    rules.memory_freshness_max_lines < 1
  ) {
    ruleErrors.push('memory_freshness_max_lines must be a positive number');
  }
  if (typeof rules.tasks_active_heading !== 'string' || !rules.tasks_active_heading.trim()) {
    ruleErrors.push('tasks_active_heading must be a non-empty string');
  }
  if (
    typeof rules.tasks_historical_heading_prefix !== 'string' ||
    !rules.tasks_historical_heading_prefix.trim()
  ) {
    ruleErrors.push('tasks_historical_heading_prefix must be a non-empty string');
  }
  if (rules.text_scan_extensions && !Array.isArray(rules.text_scan_extensions)) {
    ruleErrors.push('text_scan_extensions must be an array when provided');
  }
  // Retired-term prose scan config (all optional — the check is off unless retired_terms is set).
  if (rules.retired_terms !== undefined) {
    if (!Array.isArray(rules.retired_terms)) {
      ruleErrors.push('retired_terms must be an array when provided');
    } else {
      for (const rt of rules.retired_terms) {
        if (!rt || typeof rt !== 'object' || Array.isArray(rt)) {
          ruleErrors.push('every retired_terms entry must be an object');
          continue;
        }
        if (typeof rt.term !== 'string' || !rt.term.trim()) {
          ruleErrors.push('every retired_terms entry needs a non-empty term');
        }
        if (typeof rt.retired_on !== 'string' || !rt.retired_on.trim()) {
          ruleErrors.push(`retired term '${rt.term ?? '<missing>'}' needs a non-empty retired_on`);
        }
      }
    }
  }
  if (rules.retired_term_cues !== undefined && !Array.isArray(rules.retired_term_cues)) {
    ruleErrors.push('retired_term_cues must be an array when provided');
  }
  if (rules.retired_term_exemptions !== undefined) {
    if (!Array.isArray(rules.retired_term_exemptions)) {
      ruleErrors.push('retired_term_exemptions must be an array when provided');
    } else {
      for (const rx of rules.retired_term_exemptions) {
        if (!rx || typeof rx !== 'object' || Array.isArray(rx)) {
          ruleErrors.push('every retired_term_exemption must be an object');
          continue;
        }
        for (const key of ['path', 'term', 'reason', 'owner', 'expires_on']) {
          if (typeof rx[key] !== 'string' || !rx[key].trim()) {
            ruleErrors.push(
              `retired_term_exemption '${rx.path ?? '<missing path>'}' must include non-empty ${key}`,
            );
          }
        }
        if (typeof rx.expires_on === 'string' && Number.isNaN(Date.parse(rx.expires_on))) {
          ruleErrors.push(
            `retired_term_exemption '${rx.path ?? '<missing path>'}' has invalid expires_on`,
          );
        }
      }
    }
  }
  for (const ex of raw.exceptions) {
    if (!ex || typeof ex !== 'object' || Array.isArray(ex)) {
      ruleErrors.push('every exception must be an object');
      continue;
    }
    for (const key of ['path', 'reason', 'owner', 'expires_on']) {
      if (typeof ex[key] !== 'string' || !ex[key].trim()) {
        ruleErrors.push(`exception '${ex.path ?? '<missing path>'}' must include non-empty ${key}`);
      }
    }
  }
  if (ruleErrors.length) {
    return {
      findings: ruleErrors.map((detail) => makeFinding('manifest-shape', manifestRel, detail)),
      context: null,
    };
  }

  const scopeRootAbs = resolve(repoRoot, raw.scope_root);
  const classMap = new Map();
  const exceptionMap = new Map();
  const listedFiles = [];

  function register(kind, relPath) {
    const absPath = resolve(scopeRootAbs, relPath);
    const repoRel = relFrom(repoRoot, absPath);
    listedFiles.push({ kind, absPath, repoRel });
    if (classMap.has(absPath)) {
      findings.push(
        makeFinding(
          'manifest-overlap',
          repoRel,
          `classified as both ${classMap.get(absPath)} and ${kind}`,
        ),
      );
      return;
    }
    classMap.set(absPath, kind);
  }

  for (const key of CLASS_KEYS) {
    for (const relPath of raw[key]) {
      if (typeof relPath !== 'string' || !relPath.trim()) {
        findings.push(
          makeFinding('manifest-shape', manifestRel, `${key} entries must be non-empty strings`),
        );
        continue;
      }
      register(key, relPath);
    }
  }
  for (const ex of raw.exceptions) {
    const absPath = resolve(scopeRootAbs, ex.path);
    const repoRel = relFrom(repoRoot, absPath);
    listedFiles.push({ kind: 'exception', absPath, repoRel });
    if (classMap.has(absPath) || exceptionMap.has(absPath)) {
      findings.push(
        makeFinding(
          'manifest-overlap',
          repoRel,
          'path appears in both classification and exception sets',
        ),
      );
      continue;
    }
    exceptionMap.set(absPath, ex);
    const expiry = Date.parse(ex.expires_on);
    if (Number.isNaN(expiry)) {
      findings.push(
        makeFinding('manifest-shape', manifestRel, `exception '${ex.path}' has invalid expires_on`),
      );
    } else if (expiry < Date.now()) {
      findings.push(makeFinding('exception-expired', repoRel, `expired on ${ex.expires_on}`));
    }
  }

  // Per-file, per-term opt-outs for the retired-term prose scan — mirrors the `exceptions` shape
  // (dated + owned), but scoped to one retired term so the file keeps every other check. `term`
  // may be "*" to allow all retired terms in that file. Expiry is enforced at hit time in the scan.
  const retiredExemptionMap = new Map();
  for (const rx of Array.isArray(rules.retired_term_exemptions)
    ? rules.retired_term_exemptions
    : []) {
    const absPath = resolve(scopeRootAbs, rx.path);
    listedFiles.push({
      kind: 'retired_term_exemption',
      absPath,
      repoRel: relFrom(repoRoot, absPath),
    });
    if (!retiredExemptionMap.has(absPath)) retiredExemptionMap.set(absPath, new Map());
    retiredExemptionMap
      .get(absPath)
      .set(lower(rx.term), { expires_on: rx.expires_on, term: rx.term });
  }

  const scanTargets = [];
  for (const relPath of [...rules.scan_roots, ...rules.scan_include]) {
    if (typeof relPath !== 'string' || !relPath.trim()) {
      findings.push(
        makeFinding(
          'manifest-shape',
          manifestRel,
          'scan_roots/scan_include entries must be non-empty strings',
        ),
      );
      continue;
    }
    scanTargets.push({ absPath: resolve(scopeRootAbs, relPath), relPath });
  }

  return {
    findings,
    context: {
      repoRoot,
      manifestPath,
      manifestRel,
      raw,
      rules: {
        ...rules,
        text_scan_extensions:
          Array.isArray(rules.text_scan_extensions) && rules.text_scan_extensions.length
            ? rules.text_scan_extensions.map((entry) => lower(entry))
            : ['.md'],
        retired_terms: Array.isArray(rules.retired_terms) ? rules.retired_terms : [],
        retired_term_cues:
          Array.isArray(rules.retired_term_cues) && rules.retired_term_cues.length
            ? rules.retired_term_cues.map((entry) => lower(entry))
            : DEFAULT_RETIRED_CUES,
      },
      scopeRootAbs,
      classMap,
      exceptionMap,
      retiredExemptionMap,
      listedFiles,
      scanTargets,
    },
  };
}
function buildScanSurface(context, findings) {
  const surface = new Set();
  for (const { absPath, relPath } of context.scanTargets) {
    if (!existsSync(absPath)) {
      findings.push(
        makeFinding(
          'scan-target-missing',
          relFrom(context.repoRoot, resolve(context.scopeRootAbs, relPath)),
          'scan target does not exist',
        ),
      );
      continue;
    }
    const stats = statSync(absPath);
    if (stats.isDirectory()) {
      for (const file of walkFiles(absPath)) surface.add(file);
    } else {
      surface.add(absPath);
    }
  }
  for (const file of gitIgnoredSet([...surface], context.repoRoot)) surface.delete(file);
  return surface;
}
function hasHistoricalBanner(text, rules) {
  const lines = linesOf(text).slice(0, rules.banner_max_lines);
  return lines.some((line) => {
    const trimmed = lower(line.trim());
    if (!trimmed) return false;
    if (!/^(#|>|status:|\*\*status:|artifact status:|\*\*artifact status:)/.test(trimmed))
      return false;
    const body = trimmed
      .replace(/^#+\s*/, '')
      .replace(/^>\s*/, '')
      .replace(/^\*\*status:\*\*\s*/, '')
      .replace(/^status:\s*/, '')
      .replace(/^\*\*artifact status:\*\*\s*/, '')
      .replace(/^artifact status:\s*/, '');
    return rules.historical_banner_terms.some((term) => body.includes(lower(term)));
  });
}
function hasStartupHistoricalHeader(text, rules) {
  const lines = linesOf(text).slice(0, rules.banner_max_lines);
  return lines.some((line) => {
    const trimmed = lower(line.trim());
    if (!trimmed) return false;
    if (!/^(#|>|status:|\*\*status:|artifact status:|\*\*artifact status:)/.test(trimmed))
      return false;
    const body = trimmed
      .replace(/^#+\s*/, '')
      .replace(/^>\s*/, '')
      .replace(/^\*\*status:\*\*\s*/, '')
      .replace(/^status:\s*/, '')
      .replace(/^\*\*artifact status:\*\*\s*/, '')
      .replace(/^artifact status:\s*/, '');
    return STARTUP_STATUS_TERMS.some((term) => body.startsWith(term));
  });
}
function firstAuthorityPhrase(text, rules) {
  const body = lower(text);
  return rules.authority_phrases.find((term) => body.includes(lower(term))) ?? '';
}
function isTextScannable(path, rules) {
  return rules.text_scan_extensions.includes(lower(extname(path)));
}
function stripCodeLineContext(lines) {
  const out = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line) || /^\s*~~~/.test(line)) {
      inFence = !inFence;
      out.push('');
      continue;
    }
    out.push(inFence ? '' : line);
  }
  return out;
}
function startupHistoricalLinkFindings(absPath, text, rules, historicalFiles, repoRoot) {
  const findings = [];
  const lines = stripCodeLineContext(linesOf(text));
  const cueTerms = rules.historical_link_cues.map((term) => lower(term));
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const re = /\[[^\]]+\]\(([^)]+)\)/g;
    let match;
    while ((match = re.exec(line))) {
      const target = normalizeLinkTarget(match[1]);
      if (!target || isExternalTarget(target)) continue;
      const resolved = resolve(dirname(absPath), target);
      if (!historicalFiles.has(resolved)) continue;
      const context = lower(`${lines[index - 1] ?? ''} ${line}`);
      const hasCue = cueTerms.some((term) => context.includes(term));
      if (!hasCue) {
        findings.push(
          makeFinding(
            'startup-historical-link-cue',
            relFrom(repoRoot, absPath),
            `link to historical '${relFrom(repoRoot, resolved)}' lacks nearby cue text`,
          ),
        );
        return findings;
      }
    }
  }
  return findings;
}
// Retired-term prose scan for files classified as live truth (startup_authority / current_reference).
// A retired term (declared in the manifest with its retirement date) that appears WITHOUT a nearby
// retirement cue reads as asserting the retired thing is still live — the exact staleness this catches.
// Mirrors `startupHistoricalLinkFindings`: term list + cue list, flag only when no cue is near.
// Two things keep it honest without editing prose: classification (historical/ephemeral files are
// never scanned here) and dated per-file/per-term exemptions. The scan is bounded to the live region
// of the file — anything from the historical build-ledger heading onward (e.g. tasks.md's `## Stage`
// sections) is a self-identified history log and is skipped.
function retiredTermFindings(absPath, text, context, repoRoot) {
  const { rules } = context;
  const terms = rules.retired_terms;
  if (!terms.length) return [];
  let lines = stripCodeLineContext(linesOf(text));
  const histIdx = lines.findIndex((line) =>
    line.trim().startsWith(rules.tasks_historical_heading_prefix),
  );
  if (histIdx !== -1) lines = lines.slice(0, histIdx);
  const cues = rules.retired_term_cues;
  const exMap = context.retiredExemptionMap.get(absPath);
  const findings = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lower(lines[index]);
    if (!line.trim()) continue;
    const window = lower(`${lines[index - 1] ?? ''} ${lines[index]} ${lines[index + 1] ?? ''}`);
    for (const rt of terms) {
      const term = lower(rt.term);
      if (!line.includes(term)) continue;
      if (cues.some((cue) => window.includes(cue))) continue; // retirement acknowledged nearby
      const ex = exMap && (exMap.get(term) || exMap.get('*'));
      if (ex) {
        if (Date.parse(ex.expires_on) >= Date.now()) continue; // opted out, still valid
        findings.push(
          makeFinding(
            'retired-term-exemption-expired',
            relFrom(repoRoot, absPath),
            `line ${index + 1}: exemption for retired '${rt.term}' expired on ${ex.expires_on}`,
          ),
        );
        continue;
      }
      findings.push(
        makeFinding(
          'retired-term-live-assertion',
          relFrom(repoRoot, absPath),
          `line ${index + 1}: retired '${rt.term}' (retired ${rt.retired_on}) asserted as live without a retirement cue`,
        ),
      );
    }
  }
  return findings;
}
function scanManifestContext(context) {
  const findings = [];

  for (const listed of context.listedFiles) {
    if (!existsSync(listed.absPath)) {
      findings.push(
        makeFinding(
          'manifest-missing-file',
          listed.repoRel,
          `listed as ${listed.kind} but file does not exist`,
        ),
      );
    }
  }

  const surface = buildScanSurface(context, findings);
  for (const file of surface) {
    if (!context.classMap.has(file) && !context.exceptionMap.has(file)) {
      findings.push(
        makeFinding(
          'unclassified-scan-file',
          relFrom(context.repoRoot, file),
          'scanned file has no classification',
        ),
      );
    }
  }

  const historicalFiles = new Set(
    [...context.classMap.entries()]
      .filter(([, kind]) => kind === 'historical_artifact')
      .map(([file]) => file),
  );

  for (const [absPath, kind] of context.classMap.entries()) {
    if (!existsSync(absPath) || !isTextScannable(absPath, context.rules)) continue;
    const text = read(absPath);
    if (kind === 'historical_artifact') {
      const banner = hasHistoricalBanner(text, context.rules);
      const phrase = firstAuthorityPhrase(text, context.rules);
      if (phrase && !banner) {
        findings.push(
          makeFinding('historical-authority-phrase', relFrom(context.repoRoot, absPath), phrase),
        );
        continue;
      }
      if (!banner) {
        findings.push(
          makeFinding(
            'historical-banner-missing',
            relFrom(context.repoRoot, absPath),
            `missing historical status banner in first ${context.rules.banner_max_lines} lines`,
          ),
        );
      }
      continue;
    }
    if (kind === 'startup_authority') {
      if (hasStartupHistoricalHeader(text, context.rules)) {
        findings.push(
          makeFinding(
            'startup-claims-history',
            relFrom(context.repoRoot, absPath),
            'startup-authority header reads as historical or superseded',
          ),
        );
        continue;
      }
      findings.push(
        ...startupHistoricalLinkFindings(
          absPath,
          text,
          context.rules,
          historicalFiles,
          context.repoRoot,
        ),
      );
    }
    if (kind === 'startup_authority' || kind === 'current_reference') {
      findings.push(...retiredTermFindings(absPath, text, context, context.repoRoot));
    }
  }

  const memoryPath = resolve(context.scopeRootAbs, 'apex/knowledge/memory.md');
  if (context.classMap.get(memoryPath) === 'startup_authority' && existsSync(memoryPath)) {
    const header = firstLines(read(memoryPath), context.rules.memory_freshness_max_lines);
    if (!header.includes(context.rules.memory_freshness_phrase)) {
      findings.push(
        makeFinding(
          'memory-freshness-missing',
          relFrom(context.repoRoot, memoryPath),
          `missing '${context.rules.memory_freshness_phrase}' near the top`,
        ),
      );
    }
  }

  const tasksPath = resolve(context.scopeRootAbs, 'apex/knowledge/tasks.md');
  if (context.classMap.get(tasksPath) === 'startup_authority' && existsSync(tasksPath)) {
    const lines = linesOf(read(tasksPath));
    const activeIndex = lines.findIndex((line) =>
      line.trim().startsWith(context.rules.tasks_active_heading),
    );
    const historicalIndex = lines.findIndex((line) =>
      line.trim().startsWith(context.rules.tasks_historical_heading_prefix),
    );
    if (activeIndex === -1 || (historicalIndex !== -1 && activeIndex > historicalIndex)) {
      findings.push(
        makeFinding(
          'tasks-active-order',
          relFrom(context.repoRoot, tasksPath),
          `'${context.rules.tasks_active_heading}' must appear before the historical build ledger`,
        ),
      );
    }
  }

  return sortFindings(findings);
}
function runRepoScan(repoRoot) {
  const findings = [];
  const manifests = findManifests(repoRoot);
  const contexts = [];
  const globalFiles = new Map();

  for (const manifestPath of manifests) {
    const parsed = parseManifest(manifestPath, repoRoot);
    findings.push(...parsed.findings);
    if (!parsed.context) continue;
    contexts.push(parsed.context);
    for (const [absPath, kind] of parsed.context.classMap.entries()) {
      const repoRel = relFrom(repoRoot, absPath);
      if (globalFiles.has(absPath)) {
        findings.push(
          makeFinding(
            'manifest-overlap',
            repoRel,
            `classified by both ${globalFiles.get(absPath).manifestRel} and ${parsed.context.manifestRel}`,
          ),
        );
      } else {
        globalFiles.set(absPath, { manifestRel: parsed.context.manifestRel, kind });
      }
    }
  }

  for (const context of contexts) findings.push(...scanManifestContext(context));
  return sortFindings(findings);
}

function writeFile(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}
function gitAvailable() {
  try {
    const result = spawnSync('git', ['--version'], { encoding: 'utf8' });
    return !result.error && result.status === 0;
  } catch {
    return false;
  }
}
function runFixture({ files, manifest, gitignore }) {
  const dir = mkdtempSync(join(tmpdir(), 'knowledge-freshness-'));
  try {
    if (gitignore != null) {
      spawnSync('git', ['init', '-q'], { cwd: dir });
      writeFile(join(dir, '.gitignore'), gitignore);
    }
    for (const [path, content] of Object.entries(files)) writeFile(join(dir, path), content);
    writeFile(
      join(dir, 'apex', 'knowledge', 'knowledge-freshness.manifest.json'),
      JSON.stringify(manifest, null, 2) + '\n',
    );
    return runRepoScan(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
function hasRule(findings, rule, file = '') {
  return findings.some((finding) => finding.rule === rule && (!file || finding.file === file));
}

const BASE_RULES = {
  scan_roots: ['apex/knowledge'],
  scan_include: [],
  banner_max_lines: 12,
  historical_banner_terms: [
    'historical record',
    'historical note',
    'historical artifact',
    'historical cleanup',
    'superseded',
    'checkpoint',
    'migration log',
    'migration',
    'reconciliation log',
    'reconciliation',
    'provenance',
    'audit',
    'scan',
    'decision record',
    'research record',
    'trial',
    'verdict',
    'retired',
    'retirement',
    'decommission',
    'disposition',
    'working artifact',
    'point-in-time',
    'append-only',
    'this log records',
    'this file records',
    'plan only',
  ],
  authority_phrases: [
    'start here',
    'startup authority',
    'current truth',
    'single source of truth',
    'canonical truth',
  ],
  historical_link_cues: [
    'historical',
    'provenance',
    'superseded',
    'migration',
    'migration record',
    'reconciliation',
    'audit',
    'checkpoint',
    'log',
    'record',
  ],
  memory_freshness_phrase: 'Freshness contract',
  memory_freshness_max_lines: 12,
  tasks_active_heading: '## Active',
  tasks_historical_heading_prefix: '## Stage ',
  text_scan_extensions: ['.md'],
};

// ── selftest: RED/GREEN fixture repos ────────────────────────────────────────────
const baseManifest = {
  scope_root: '.',
  startup_authority: ['apex/knowledge/memory.md', 'apex/knowledge/tasks.md'],
  current_reference: ['apex/knowledge/knowledge-freshness.manifest.json'],
  historical_artifact: [],
  ephemeral: [],
  exceptions: [],
  rules: BASE_RULES,
};

const missingBanner = runFixture({
  files: {
    'apex/knowledge/memory.md': '# memory\n\n> **Freshness contract.** Live truth wins.\n',
    'apex/knowledge/tasks.md': '## Active\n\n## Stage 0\n',
    'apex/knowledge/history.md': '# Old plan\n\nThis was useful once.\n',
  },
  manifest: { ...baseManifest, historical_artifact: ['apex/knowledge/history.md'] },
});
ok(
  'selftest: historical file without banner fails',
  hasRule(missingBanner, 'historical-banner-missing', 'apex/knowledge/history.md'),
  missingBanner.map(formatFinding).join(' | '),
);

const startupHistorical = runFixture({
  files: {
    'apex/knowledge/memory.md':
      '# memory\n\n> Historical record. This is old.\n> **Freshness contract.** Live truth wins.\n',
    'apex/knowledge/tasks.md': '## Active\n\n## Stage 0\n',
  },
  manifest: baseManifest,
});
ok(
  'selftest: startup-authority file marked historical fails',
  hasRule(startupHistorical, 'startup-claims-history', 'apex/knowledge/memory.md'),
  startupHistorical.map(formatFinding).join(' | '),
);

const authorityPhrase = runFixture({
  files: {
    'apex/knowledge/memory.md': '# memory\n\n> **Freshness contract.** Live truth wins.\n',
    'apex/knowledge/tasks.md': '## Active\n\n## Stage 0\n',
    'apex/knowledge/history.md': '# Legacy front door\n\nStart here for the canonical truth.\n',
  },
  manifest: { ...baseManifest, historical_artifact: ['apex/knowledge/history.md'] },
});
ok(
  'selftest: historical authority phrase without banner fails',
  hasRule(authorityPhrase, 'historical-authority-phrase', 'apex/knowledge/history.md'),
  authorityPhrase.map(formatFinding).join(' | '),
);

const uncuedLink = runFixture({
  files: {
    'apex/knowledge/memory.md':
      '# memory\n\n> **Freshness contract.** Live truth wins.\nSee [history](history.md).\n',
    'apex/knowledge/tasks.md': '## Active\n\n## Stage 0\n',
    'apex/knowledge/history.md': '# Historical record\n\nOld state.\n',
  },
  manifest: { ...baseManifest, historical_artifact: ['apex/knowledge/history.md'] },
});
ok(
  'selftest: startup-authority link to history without cue text fails',
  hasRule(uncuedLink, 'startup-historical-link-cue', 'apex/knowledge/memory.md'),
  uncuedLink.map(formatFinding).join(' | '),
);

const cleanStartup = runFixture({
  files: {
    'apex/knowledge/memory.md':
      '# memory\n\n> **Freshness contract.** Live truth wins.\nHistorical migration record -> [history](history.md).\n',
    'apex/knowledge/tasks.md': '## Active\n\n## Stage 0\n',
    'apex/knowledge/history.md': '# Historical record\n\nOld state.\n',
  },
  manifest: { ...baseManifest, historical_artifact: ['apex/knowledge/history.md'] },
});
ok(
  'selftest: clean startup-authority file passes',
  cleanStartup.length === 0,
  cleanStartup.map(formatFinding).join(' | '),
);

const cleanHistory = runFixture({
  files: {
    'apex/knowledge/memory.md': '# memory\n\n> **Freshness contract.** Live truth wins.\n',
    'apex/knowledge/tasks.md': '## Active\n\n## Stage 0\n',
    'apex/knowledge/history.md': '# Historical record\n\nCheckpoint captured 2026-07-04.\n',
  },
  manifest: { ...baseManifest, historical_artifact: ['apex/knowledge/history.md'] },
});
ok(
  'selftest: clean historical file with banner passes',
  cleanHistory.length === 0,
  cleanHistory.map(formatFinding).join(' | '),
);

// ── gitignore exclusion: the gate scans committed source only ─────────────────────
// A machine-generated, gitignored file inside a scan root (e.g. apex/knowledge/drift-reports/)
// must not trip unclassified-scan-file — CI on a clean checkout never sees it, so local
// validate must not either. Needs a real git repo to answer check-ignore; skip if git is absent.
if (gitAvailable()) {
  const driftFiles = {
    'apex/knowledge/memory.md': '# memory\n\n> **Freshness contract.** Live truth wins.\n',
    'apex/knowledge/tasks.md': '## Active\n\n## Stage 0\n',
    'apex/knowledge/drift-reports/2026-07-05.md': 'generated report, unclassified by design\n',
  };
  const gitignored = runFixture({
    files: driftFiles,
    manifest: baseManifest,
    gitignore: 'apex/knowledge/drift-reports/\n',
  });
  ok(
    'selftest: gitignored scan-root file is excluded from the surface',
    gitignored.length === 0 && !hasRule(gitignored, 'unclassified-scan-file'),
    gitignored.map(formatFinding).join(' | '),
  );
  // Same tree, nothing ignored: the unclassified file must still fail. Proves the pass above
  // is the gitignore filter, not the file silently vanishing from the surface.
  const tracked = runFixture({
    files: driftFiles,
    manifest: baseManifest,
    gitignore: '# nothing ignored\n',
  });
  ok(
    'selftest: a tracked unclassified scan-root file still fails',
    hasRule(tracked, 'unclassified-scan-file', 'apex/knowledge/drift-reports/2026-07-05.md'),
    tracked.map(formatFinding).join(' | '),
  );
} else {
  ok('selftest: gitignore exclusion — SKIPPED: git unavailable', true);
}

// Graceful degradation: off a git repo, check-ignore cannot answer, so nothing is excluded
// and the surface is unchanged (framework consumers outside git keep scanning everything).
const nonRepoDir = mkdtempSync(join(tmpdir(), 'knowledge-freshness-nogit-'));
try {
  ok(
    'selftest: gitIgnoredSet falls back to an empty set off a git repo',
    gitIgnoredSet([join(nonRepoDir, 'probe.md')], nonRepoDir).size === 0,
  );
} finally {
  rmSync(nonRepoDir, { recursive: true, force: true });
}

// ── selftest: retired-term prose scan + infra coverage ────────────────────────────
// A manifest that declares retired_terms turns the prose scan on. Cues come from the framework
// default list. `apex/knowledge/knowledge-freshness.manifest.json` sits inside the apex/knowledge
// scan root, so every fixture classifies it (matching the base fixtures above).
const retiredRules = {
  ...BASE_RULES,
  retired_terms: [
    { term: 'example-engine', retired_on: '2026-07-04' },
    { term: 'council gate', retired_on: '2026-06-30' },
  ],
};
const retiredBase = {
  scope_root: '.',
  startup_authority: ['apex/knowledge/memory.md', 'apex/knowledge/tasks.md'],
  current_reference: ['apex/knowledge/knowledge-freshness.manifest.json'],
  historical_artifact: [],
  ephemeral: [],
  exceptions: [],
  rules: retiredRules,
};
const cleanStartupFiles = {
  'apex/knowledge/memory.md': '# memory\n\n> **Freshness contract.** Live truth wins.\n',
  'apex/knowledge/tasks.md': '## Active\n\n## Stage 0\n',
};

const liveAssertsRetired = runFixture({
  files: {
    ...cleanStartupFiles,
    'apex/knowledge/reference.md':
      '# Reference\n\nThe example-engine ledger is the source of truth.\n',
  },
  manifest: {
    ...retiredBase,
    current_reference: [
      'apex/knowledge/knowledge-freshness.manifest.json',
      'apex/knowledge/reference.md',
    ],
  },
});
ok(
  'selftest: live-classified file asserting a retired term fails',
  hasRule(liveAssertsRetired, 'retired-term-live-assertion', 'apex/knowledge/reference.md'),
  liveAssertsRetired.map(formatFinding).join(' | '),
);

const historicalRetired = runFixture({
  files: {
    ...cleanStartupFiles,
    'apex/knowledge/old.md':
      '# Historical record\n\nThe example-engine ledger was the source of truth.\n',
  },
  manifest: {
    ...retiredBase,
    historical_artifact: ['apex/knowledge/old.md'],
  },
});
ok(
  'selftest: historical file with the same retired term passes',
  historicalRetired.length === 0,
  historicalRetired.map(formatFinding).join(' | '),
);

const cuedRetired = runFixture({
  files: {
    ...cleanStartupFiles,
    'apex/knowledge/reference.md':
      '# Reference\n\nThe example-engine ledger is retired; do not use it.\n',
  },
  manifest: {
    ...retiredBase,
    current_reference: [
      'apex/knowledge/knowledge-freshness.manifest.json',
      'apex/knowledge/reference.md',
    ],
  },
});
ok(
  'selftest: retired term with a nearby retirement cue passes',
  cuedRetired.length === 0,
  cuedRetired.map(formatFinding).join(' | '),
);

const optedOutRetired = runFixture({
  files: {
    ...cleanStartupFiles,
    'apex/knowledge/reference.md':
      '# Reference\n\nThe example-engine ledger is the source of truth.\n',
  },
  manifest: {
    ...retiredBase,
    current_reference: [
      'apex/knowledge/knowledge-freshness.manifest.json',
      'apex/knowledge/reference.md',
    ],
    rules: {
      ...retiredRules,
      retired_term_exemptions: [
        {
          path: 'apex/knowledge/reference.md',
          term: 'example-engine',
          reason: 'pending reconciliation',
          owner: 'test',
          expires_on: '2999-01-01',
        },
      ],
    },
  },
});
ok(
  'selftest: retired term opted out via a dated exemption passes',
  optedOutRetired.length === 0,
  optedOutRetired.map(formatFinding).join(' | '),
);

const expiredExemption = runFixture({
  files: {
    ...cleanStartupFiles,
    'apex/knowledge/reference.md':
      '# Reference\n\nThe example-engine ledger is the source of truth.\n',
  },
  manifest: {
    ...retiredBase,
    current_reference: [
      'apex/knowledge/knowledge-freshness.manifest.json',
      'apex/knowledge/reference.md',
    ],
    rules: {
      ...retiredRules,
      retired_term_exemptions: [
        {
          path: 'apex/knowledge/reference.md',
          term: 'example-engine',
          reason: 'lapsed',
          owner: 'test',
          expires_on: '2020-01-01',
        },
      ],
    },
  },
});
ok(
  'selftest: an expired retired-term exemption fails',
  hasRule(expiredExemption, 'retired-term-exemption-expired', 'apex/knowledge/reference.md'),
  expiredExemption.map(formatFinding).join(' | '),
);

// Infra coverage: a knowledge file outside the default scan roots, pulled into scope via
// scan_include, must be classified — otherwise it trips unclassified-scan-file (proving the gate
// now sees infra knowledge), and once classified it passes.
const infraUnclassified = runFixture({
  files: { ...cleanStartupFiles, 'apex/infra/fleet.json': '{ "stale": true }\n' },
  manifest: {
    ...retiredBase,
    rules: { ...retiredRules, scan_include: ['apex/infra/fleet.json'] },
  },
});
ok(
  'selftest: a seeded infra file pulled into scope but unclassified fails',
  hasRule(infraUnclassified, 'unclassified-scan-file', 'apex/infra/fleet.json'),
  infraUnclassified.map(formatFinding).join(' | '),
);

const infraClassified = runFixture({
  files: { ...cleanStartupFiles, 'apex/infra/fleet.json': '{ "stale": true }\n' },
  manifest: {
    ...retiredBase,
    current_reference: [
      'apex/knowledge/knowledge-freshness.manifest.json',
      'apex/infra/fleet.json',
    ],
    rules: { ...retiredRules, scan_include: ['apex/infra/fleet.json'] },
  },
});
ok(
  'selftest: a seeded infra file, once classified, passes',
  infraClassified.length === 0,
  infraClassified.map(formatFinding).join(' | '),
);

// ── real scan ────────────────────────────────────────────────────────────────────
const repoFindings = runRepoScan(REPO_ROOT);
ok(
  'scan: every discovered knowledge-freshness manifest is clean',
  repoFindings.length === 0,
  repoFindings[0] ? formatFinding(repoFindings[0]) : '',
);

if (repoFindings.length) console.log(formatFinding(repoFindings[0]));

for (const file of ['validate.mjs', 'README.md'])
  ok(`file present: ${file}`, existsSync(join(__dirname, file)));

const failed = checks.filter((check) => !check.pass);
for (const check of checks)
  if (!check.pass) console.log(`  FAIL ${check.name}${check.detail ? `  [${check.detail}]` : ''}`);
console.log(
  `knowledge-freshness: ${checks.length - failed.length}/${checks.length} selftest checks passed`,
);
process.exit(failed.length ? 1 : 0);
