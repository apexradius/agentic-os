#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ALLOWED_TYPES = new Set([
  'prompt',
  'prompt-strategy',
  'skill',
  'hook',
  'command',
  'doc',
  'config',
  'standard',
  'primitive',
  'runtime',
]);

const GENERATED_SEGMENTS = new Set(['node_modules', 'dist', 'build', '.pytest_cache']);
const GENERATED_BASENAMES = new Set([
  'index.generated.md',
  'index.json',
  'labels.json',
  'capabilities.json',
  '.env',
  '.env.local',
]);

const SEMVER = /^\d+\.\d+\.\d+$/;
const NAME = /^[a-z0-9]+([._-][a-z0-9]+)*$/;

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRelativeCleanPath(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  if (path.isAbsolute(value)) return false;
  if (value.includes('\\')) return false;
  const normalized = path.posix.normalize(value);
  if (normalized === '.' || normalized.startsWith('../') || normalized === '..') return false;
  if (normalized !== value) return false;
  return !value.split('/').includes('..');
}

function hasGeneratedSegment(target) {
  const parts = target.split('/');
  return (
    parts.some((part) => GENERATED_SEGMENTS.has(part)) || GENERATED_BASENAMES.has(parts.at(-1))
  );
}

function underAnyRoot(target, roots) {
  return roots.some((root) => target === root.replace(/\/$/, '') || target.startsWith(root));
}

function underProtectedPath(target, protectedPaths) {
  return protectedPaths.some((protectedPath) => {
    const clean = protectedPath.endsWith('/') ? protectedPath : `${protectedPath}/`;
    return target === protectedPath.replace(/\/$/, '') || target.startsWith(clean);
  });
}

function pathState(root, relativePath) {
  if (!root || !isRelativeCleanPath(relativePath)) {
    return { exists: null, isFile: null, isDirectory: null, inspectable: null };
  }
  const fullPath = path.resolve(root, relativePath);
  if (!existsSync(fullPath)) {
    return { exists: false, isFile: false, isDirectory: false, inspectable: true };
  }
  try {
    const stat = statSync(fullPath);
    return {
      exists: true,
      isFile: stat.isFile(),
      isDirectory: stat.isDirectory(),
      inspectable: true,
    };
  } catch {
    return { exists: true, isFile: null, isDirectory: null, inspectable: false };
  }
}

function buildDryRunPlan(normalizedFiles, options, errors) {
  const bundleRoot = options.bundleRoot ? path.resolve(options.bundleRoot) : null;
  const targetRoot = options.targetRoot ? path.resolve(options.targetRoot) : null;
  const checkSources = Boolean(options.checkSources);
  const checkTargets = Boolean(options.checkTargets);

  if (checkSources && !bundleRoot) {
    errors.push('bundleRoot is required when checkSources is true');
  }
  if (checkTargets && !targetRoot) {
    errors.push('targetRoot is required when checkTargets is true');
  }

  return normalizedFiles.map((file, index) => {
    const sourceState = pathState(bundleRoot, file.source);
    const targetState = pathState(targetRoot, file.target);

    if (checkSources && sourceState.exists === false) {
      errors.push(`files[${index}].source does not exist: ${file.source}`);
    }
    if (checkSources && sourceState.exists === true && !sourceState.isFile) {
      errors.push(`files[${index}].source is not a file: ${file.source}`);
    }
    if (checkSources && sourceState.inspectable === false) {
      errors.push(`files[${index}].source could not be inspected: ${file.source}`);
    }
    if (checkTargets && targetState.exists === true && !targetState.isFile) {
      errors.push(`files[${index}].target exists and is not a file: ${file.target}`);
    }
    if (checkTargets && targetState.inspectable === false) {
      errors.push(`files[${index}].target could not be inspected: ${file.target}`);
    }

    return {
      action: 'install_file',
      type: file.type ?? null,
      source: file.source ?? null,
      target: file.target ?? null,
      source_exists: checkSources ? sourceState.exists : null,
      target_exists: checkTargets ? targetState.exists : null,
      target_state:
        checkTargets && targetState.exists !== null
          ? targetState.exists
            ? 'replace'
            : 'create'
          : 'unknown',
    };
  });
}

export function validateManifest(manifest, options = {}) {
  const errors = [];
  const warnings = [];

  if (!isObject(manifest)) {
    return { ok: false, errors: ['manifest must be an object'], warnings, summary: null };
  }

  if (typeof manifest.name !== 'string' || !NAME.test(manifest.name)) {
    errors.push('name must be lowercase id text');
  }
  if (typeof manifest.version !== 'string' || !SEMVER.test(manifest.version)) {
    errors.push('version must be semver');
  }

  const roots = Array.isArray(manifest.allowed_target_roots) ? manifest.allowed_target_roots : [];
  if (roots.length === 0) errors.push('allowed_target_roots must be a non-empty array');
  for (const root of roots) {
    if (
      typeof root !== 'string' ||
      !root.endsWith('/') ||
      !isRelativeCleanPath(root.slice(0, -1))
    ) {
      errors.push(
        `allowed_target_roots entry must be a clean relative directory ending with /: ${String(root)}`,
      );
    }
  }

  const protectedPaths = Array.isArray(manifest.protected_paths) ? manifest.protected_paths : [];
  for (const protectedPath of protectedPaths) {
    const value =
      typeof protectedPath === 'string' && protectedPath.endsWith('/')
        ? protectedPath.slice(0, -1)
        : protectedPath;
    if (!isRelativeCleanPath(value)) {
      errors.push(`protected_paths entry must be a clean relative path: ${String(protectedPath)}`);
    }
  }

  const files = Array.isArray(manifest.files) ? manifest.files : [];
  if (files.length === 0) errors.push('files must be a non-empty array');

  const targetsSeen = new Map();
  const normalizedFiles = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    if (!isObject(file)) {
      errors.push(`files[${index}] must be an object`);
      continue;
    }
    const source = file.source;
    const target = file.target;
    const type = file.type;

    if (!isRelativeCleanPath(source))
      errors.push(`files[${index}].source must be a clean relative path`);
    if (!isRelativeCleanPath(target))
      errors.push(`files[${index}].target must be a clean relative path`);
    if (typeof type !== 'string' || !ALLOWED_TYPES.has(type)) {
      errors.push(`files[${index}].type must be one of: ${Array.from(ALLOWED_TYPES).join(', ')}`);
    }
    if (typeof target === 'string' && isRelativeCleanPath(target)) {
      if (roots.length > 0 && !underAnyRoot(target, roots)) {
        errors.push(`files[${index}].target is outside allowed roots: ${target}`);
      }
      if (underProtectedPath(target, protectedPaths)) {
        errors.push(`files[${index}].target hits protected path: ${target}`);
      }
      if (hasGeneratedSegment(target)) {
        errors.push(`files[${index}].target points at generated/runtime artifact: ${target}`);
      }

      const folded = target.toLowerCase();
      const prior = targetsSeen.get(folded);
      if (prior && prior !== target) {
        errors.push(`case-insensitive target collision: ${prior} vs ${target}`);
      } else {
        targetsSeen.set(folded, target);
      }
    }

    normalizedFiles.push({ source, target, type });
  }

  const plan = buildDryRunPlan(normalizedFiles, options, errors);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      name: manifest.name ?? null,
      version: manifest.version ?? null,
      dry_run: true,
      installs: normalizedFiles.length,
      can_apply: errors.length === 0,
      files: normalizedFiles,
      plan,
    },
  };
}

function loadJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function runCli() {
  const args = process.argv.slice(2);
  const file = args.find((arg) => !arg.startsWith('--'));
  const json = args.includes('--json');

  if (!file) return runSelftest();

  const filePath = path.resolve(file);
  const result = validateManifest(loadJson(filePath), {
    bundleRoot: path.dirname(filePath),
    targetRoot: process.cwd(),
    checkSources: true,
    checkTargets: true,
  });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`capability-bundle: ${result.ok ? 'OK' : 'FAILED'} ${file}`);
    for (const error of result.errors) console.log(`  ERROR ${error}`);
    for (const warning of result.warnings) console.log(`  WARN ${warning}`);
    if (result.summary) {
      console.log(
        `  dry_run=true installs=${result.summary.installs} can_apply=${result.summary.can_apply}`,
      );
      for (const item of result.summary.plan) {
        console.log(`  PLAN ${item.target_state} ${item.target}`);
      }
    }
  }
  return result.ok;
}

function runSelftest() {
  const dir = mkdtempSync(path.join(tmpdir(), 'capability-bundle-'));
  const checks = [];
  const ok = (name, condition) => checks.push({ name, pass: Boolean(condition) });
  try {
    const good = {
      name: 'prompt-pack',
      version: '1.0.0',
      allowed_target_roots: ['framework/', 'instance/'],
      protected_paths: ['framework/primitives/'],
      files: [
        {
          source: 'library/strategies/proof.md',
          target: 'instance/prompt-router/library/strategies/proof.md',
          type: 'prompt-strategy',
        },
      ],
    };
    mkdirSync(path.join(dir, 'library/strategies'), { recursive: true });
    mkdirSync(path.join(dir, 'instance/prompt-router/library/strategies'), { recursive: true });
    writeFileSync(path.join(dir, 'library/strategies/proof.md'), '# Proof\n');
    const goodPath = path.join(dir, 'good.json');
    writeFileSync(goodPath, JSON.stringify(good));
    ok('valid manifest passes', validateManifest(loadJson(goodPath)).ok);

    const sourceChecked = validateManifest(good, {
      bundleRoot: dir,
      targetRoot: dir,
      checkSources: true,
      checkTargets: true,
    });
    ok('source-aware dry run passes', sourceChecked.ok);
    ok('missing target plans create', sourceChecked.summary.plan[0].target_state === 'create');
    ok('source check without bundleRoot fails', !validateManifest(good, { checkSources: true }).ok);

    writeFileSync(
      path.join(dir, 'instance/prompt-router/library/strategies/proof.md'),
      '# Existing\n',
    );
    const replaceChecked = validateManifest(good, {
      bundleRoot: dir,
      targetRoot: dir,
      checkSources: true,
      checkTargets: true,
    });
    ok('existing target plans replace', replaceChecked.summary.plan[0].target_state === 'replace');
    ok(
      'missing source fails',
      !validateManifest(
        {
          ...good,
          files: [{ ...good.files[0], source: 'library/strategies/missing.md' }],
        },
        {
          bundleRoot: dir,
          targetRoot: dir,
          checkSources: true,
          checkTargets: true,
        },
      ).ok,
    );

    ok(
      'absolute target fails',
      !validateManifest({ ...good, files: [{ ...good.files[0], target: '/tmp/x' }] }).ok,
    );
    ok(
      'path traversal fails',
      !validateManifest({ ...good, files: [{ ...good.files[0], target: '../x' }] }).ok,
    );
    ok(
      'outside root fails',
      !validateManifest({ ...good, files: [{ ...good.files[0], target: 'other/x.md' }] }).ok,
    );
    ok(
      'protected target fails',
      !validateManifest({
        ...good,
        files: [{ ...good.files[0], target: 'framework/primitives/x.md' }],
      }).ok,
    );
    ok(
      'generated target fails',
      !validateManifest({
        ...good,
        files: [{ ...good.files[0], target: 'instance/index.generated.md' }],
      }).ok,
    );
    ok(
      'capability index target fails',
      !validateManifest({
        ...good,
        files: [{ ...good.files[0], target: 'instance/capabilities.json' }],
      }).ok,
    );
    ok(
      'case collision fails',
      !validateManifest({
        ...good,
        files: [
          { ...good.files[0], target: 'instance/Prompt.md' },
          { ...good.files[0], target: 'instance/prompt.md' },
        ],
      }).ok,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const failed = checks.filter((check) => !check.pass);
  for (const check of checks) {
    console.log(`  ${check.pass ? 'ok  ' : 'FAIL'} ${check.name}`);
  }
  console.log(
    `\ncapability-bundle: ${checks.length - failed.length}/${checks.length} selftest checks passed`,
  );
  return failed.length === 0;
}

process.exit(runCli() ? 0 : 1);
