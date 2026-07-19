#!/usr/bin/env node
// framework/primitives/plugins/validate.mjs — validate plugin JSON artifacts.
//
//   node validate.mjs <file.json> ...   validate by filename (see below)
//   node validate.mjs --selftest        prove the validator with inline good/bad fixtures
//   node validate.mjs                    (no in-repo sources) run selftest only
//
// A plugin is not one frontmatter file — it is three JSON artifacts, dispatched by name:
//   installed_plugins.json   -> the install registry        (#/definitions/installedPlugins)
//   known_marketplaces.json  -> the marketplace registry    (#/definitions/knownMarketplaces)
//   plugin.json              -> a per-plugin manifest        (#/definitions/pluginManifest)
// Plugins are GitHub-marketplace-sourced and Claude-managed; there is no emit/projection.
// Schemas are lenient on entry detail (these files are tool-written) — we check the backbone.

import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileSchema, formatErrors } from '../_lib/schema.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..', '..', '..');

const schema = JSON.parse(readFileSync(join(__dirname, 'plugins.schema.json'), 'utf8'));

// Pre-compile one validator per artifact kind (each is a $ref into the shared definitions).
const KINDS = {
  installedPlugins: { def: 'installedPlugins', file: 'installed_plugins.json' },
  knownMarketplaces: { def: 'knownMarketplaces', file: 'known_marketplaces.json' },
  pluginManifest: { def: 'pluginManifest', file: 'plugin.json' },
};
const compiled = Object.fromEntries(
  Object.entries(KINDS).map(([k, { def }]) => [
    k,
    compileSchema({ $ref: `#/definitions/${def}`, definitions: schema.definitions }),
  ]),
);

function kindForFilename(base) {
  if (base === 'installed_plugins.json') return 'installedPlugins';
  if (base === 'known_marketplaces.json') return 'knownMarketplaces';
  if (base === 'plugin.json') return 'pluginManifest';
  return null;
}

// Core check on parsed data — used by both file validation and the inline selftest.
export function checkPlugin(data, kind) {
  const errors = [];
  const warnings = [];
  const validate = compiled[kind];
  if (!validate) {
    return { errors: [`unknown plugin artifact kind '${kind}'`], warnings };
  }
  if (!validate(data)) {
    for (const line of formatErrors(validate.errors)) errors.push(line);
  }
  // version is recommended on a manifest but official plugins sometimes omit it — warn, don't fail.
  if (kind === 'pluginManifest' && data && data.version === undefined) {
    warnings.push("manifest has no 'version' (recommended; some official plugins omit it)");
  }
  return { errors, warnings };
}

export function validatePluginFile(path) {
  const base = basename(path);
  const kind = kindForFilename(base);
  if (!kind) {
    return {
      path,
      errors: [
        `unrecognized plugin artifact '${base}' — expected installed_plugins.json, known_marketplaces.json, or plugin.json`,
      ],
      warnings: [],
    };
  }
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return { path, errors: [`invalid JSON: ${e.message}`], warnings: [] };
  }
  const { errors, warnings } = checkPlugin(data, kind);
  return { path, errors, warnings };
}

// ── Selftest: prove each artifact kind accepts good and rejects bad ──────────────
function runSelftest() {
  const cases = [
    [
      'accepts a valid installed_plugins.json',
      'installedPlugins',
      {
        version: 2,
        plugins: { 'context7@official': [{ scope: 'user', installPath: '/x', version: '1.0.0' }] },
      },
      (r) => r.errors.length === 0,
    ],
    [
      'rejects an install record missing installPath',
      'installedPlugins',
      { version: 2, plugins: { 'x@m': [{ scope: 'user', version: '1.0.0' }] } },
      (r) => r.errors.some((e) => /installPath|required/.test(e)),
    ],
    [
      "rejects installed_plugins.json with no 'plugins' key",
      'installedPlugins',
      { version: 2 },
      (r) => r.errors.some((e) => /plugins|required/.test(e)),
    ],
    [
      'accepts a valid known_marketplaces.json',
      'knownMarketplaces',
      {
        official: {
          source: { source: 'github', repo: 'anthropics/x' },
          installLocation: '/c',
          lastUpdated: 't',
        },
      },
      (r) => r.errors.length === 0,
    ],
    [
      'rejects a marketplace missing its source',
      'knownMarketplaces',
      { official: { installLocation: '/c' } },
      (r) => r.errors.some((e) => /source|required/.test(e)),
    ],
    [
      'accepts a valid plugin.json manifest',
      'pluginManifest',
      { name: 'demo', version: '1.0.0', description: 'A demo plugin' },
      (r) => r.errors.length === 0,
    ],
    [
      'rejects a manifest missing name',
      'pluginManifest',
      { version: '1.0.0', description: 'A demo plugin' },
      (r) => r.errors.some((e) => /name|required/.test(e)),
    ],
    [
      'warns (not fails) on a manifest missing version',
      'pluginManifest',
      { name: 'demo', description: 'A demo plugin' },
      (r) => r.errors.length === 0 && r.warnings.some((w) => /version/.test(w)),
    ],
  ];

  let pass = 0;
  for (const [name, kind, data, ok] of cases) {
    const res = checkPlugin(data, kind);
    const good = ok(res);
    if (good) pass++;
    console.log(`  ${good ? 'ok  ' : 'FAIL'} ${name}`);
  }
  console.log(`\nplugins selftest: ${pass}/${cases.length} passed`);
  return pass === cases.length;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith('validate.mjs')) {
  const args = process.argv.slice(2);

  if (args.includes('--selftest')) {
    process.exit(runSelftest() ? 0 : 1);
  }

  const targets = args.filter((a) => !a.startsWith('--'));
  let failed = 0;
  let warned = 0;
  for (const t of targets) {
    const { errors, warnings } = validatePluginFile(t);
    const rel = t.startsWith(REPO + '/') ? t.slice(REPO.length + 1) : t;
    if (errors.length) {
      failed++;
      console.log(`  FAIL ${rel}`);
      for (const e of errors) console.log(`       ✗ ${e}`);
    } else if (warnings.length) {
      warned++;
      console.log(`  warn ${rel}`);
      for (const w of warnings) console.log(`       ! ${w}`);
    } else {
      console.log(`  ok   ${rel}`);
    }
  }
  if (targets.length) {
    console.log(
      `\nplugins: ${targets.length - failed}/${targets.length} valid${warned ? `, ${warned} with warnings` : ''}`,
    );
  }

  // No in-repo plugin sources (plugins are external) — bare run proves via selftest so
  // `--all` stays non-vacuous on a fresh clone.
  let selftestOk = true;
  if (targets.length === 0) {
    selftestOk = runSelftest();
  }
  process.exit(failed || !selftestOk ? 1 : 0);
}
