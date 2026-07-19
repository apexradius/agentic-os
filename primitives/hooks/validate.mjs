#!/usr/bin/env node
// framework/primitives/hooks/validate.mjs — validate the hooks-block ENTRY shape.
//
//   node validate.mjs <settings.json|hooks.json> ...  validate the 'hooks' block in a config
//   node validate.mjs --selftest                      prove the validator with inline fixtures
//   node validate.mjs                                  (no in-repo sources) run selftest only
//
// HONEST LAYERING (see spec.md): this validator checks the structural ENTRY shape of the
// hooks map only — events → matcher-groups → {type, command|prompt, timeout}. It does NOT
// check the runtime I/O contract (stdin/stdout JSON, exit 0/2, fail-open) or that the hook
// scripts exist/behave — that is deferred to the existing validate-codex-hook-runtime.py.
// It reads the 'hooks' key out of any config (settings.json carries many other keys; a
// dedicated hooks.json is hooks-only) so the same validator serves Claude, Codex, and plugins.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileSchema, formatErrors } from '../_lib/schema.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..', '..', '..');

const schema = JSON.parse(readFileSync(join(__dirname, 'hooks.schema.json'), 'utf8'));
const validateHooksMap = compileSchema(schema);

// Known events as of writing — used for a soft warning only (runtimes add events over time,
// so an unknown event name is suspicious, not invalid).
const KNOWN_EVENTS = new Set([
  'PreToolUse',
  'PostToolUse',
  'UserPromptSubmit',
  'Stop',
  'SessionStart',
  'SessionEnd',
  'SubagentStop',
  'PreCompact',
  'Notification',
]);
const TIMEOUT_MAX = 600;

// Core check on a parsed config object — used by file validation and the inline selftest.
export function checkHooks(config) {
  const errors = [];
  const warnings = [];

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { errors: ['config is not a JSON object'], warnings };
  }
  if (config.hooks === undefined) {
    warnings.push("no 'hooks' block — nothing for this primitive to validate");
    return { errors, warnings };
  }

  if (!validateHooksMap(config.hooks)) {
    for (const line of formatErrors(validateHooksMap.errors)) errors.push(`hooks ${line}`);
  }

  // Soft checks the schema can't express cleanly.
  if (config.hooks && typeof config.hooks === 'object') {
    for (const [event, groups] of Object.entries(config.hooks)) {
      if (!KNOWN_EVENTS.has(event))
        warnings.push(`unknown hook event '${event}' (typo, or newer than this validator?)`);
      if (!Array.isArray(groups)) continue;
      for (const g of groups) {
        if (!g || !Array.isArray(g.hooks)) continue;
        for (const h of g.hooks) {
          if (h && typeof h.timeout === 'number' && h.timeout > TIMEOUT_MAX) {
            warnings.push(
              `event '${event}': timeout ${h.timeout}s exceeds the ${TIMEOUT_MAX}s runtime cap`,
            );
          }
        }
      }
    }
  }

  return { errors, warnings };
}

export function validateHookFile(path) {
  let config;
  try {
    config = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return { path, errors: [`invalid JSON: ${e.message}`], warnings: [] };
  }
  const { errors, warnings } = checkHooks(config);
  return { path, errors, warnings };
}

// ── Selftest: prove the validator accepts good entries and rejects malformed ones ─
function runSelftest() {
  const cases = [
    [
      'accepts a command hook',
      {
        hooks: {
          PreToolUse: [
            { matcher: 'Write|Edit', hooks: [{ type: 'command', command: 'x.sh', timeout: 5 }] },
          ],
        },
      },
      (r) => r.errors.length === 0,
    ],
    [
      'accepts a prompt hook',
      { hooks: { Stop: [{ hooks: [{ type: 'prompt', prompt: 'summarize the session' }] }] } },
      (r) => r.errors.length === 0,
    ],
    [
      'rejects a command hook with no command',
      { hooks: { PreToolUse: [{ hooks: [{ type: 'command' }] }] } },
      (r) => r.errors.some((e) => /command|required/.test(e)),
    ],
    [
      'rejects an invalid hook type',
      { hooks: { PreToolUse: [{ hooks: [{ type: 'bogus', command: 'x' }] }] } },
      (r) => r.errors.some((e) => /type|enum/.test(e)),
    ],
    [
      'rejects a matcher-group missing its hooks array',
      { hooks: { PreToolUse: [{ matcher: 'Write' }] } },
      (r) => r.errors.some((e) => /hooks|required/.test(e)),
    ],
    [
      'warns on an unknown event name',
      { hooks: { MadeUpEvent: [{ hooks: [{ type: 'command', command: 'x' }] }] } },
      (r) => r.errors.length === 0 && r.warnings.some((w) => /unknown hook event/.test(w)),
    ],
    [
      'warns (not fails) on a config with no hooks block',
      { model: 'claude-opus-4-8', permissions: {} },
      (r) => r.errors.length === 0 && r.warnings.some((w) => /no 'hooks' block/.test(w)),
    ],
    [
      'warns on a timeout over the cap',
      { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'x', timeout: 999 }] }] } },
      (r) => r.errors.length === 0 && r.warnings.some((w) => /exceeds the 600s/.test(w)),
    ],
  ];

  let pass = 0;
  for (const [name, config, ok] of cases) {
    const res = checkHooks(config);
    const good = ok(res);
    if (good) pass++;
    console.log(`  ${good ? 'ok  ' : 'FAIL'} ${name}`);
  }
  console.log(`\nhooks selftest: ${pass}/${cases.length} passed`);
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
    const { errors, warnings } = validateHookFile(t);
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
      `\nhooks: ${targets.length - failed}/${targets.length} valid${warned ? `, ${warned} with warnings` : ''}`,
    );
  }

  let selftestOk = true;
  if (targets.length === 0) {
    selftestOk = runSelftest();
  }
  process.exit(failed || !selftestOk ? 1 : 0);
}
