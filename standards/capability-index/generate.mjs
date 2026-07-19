#!/usr/bin/env node
// generate.mjs — the capability-index single-source pipeline.
//
//   node framework/standards/capability-index/generate.mjs           (re)write CAPABILITIES.md
//   node framework/standards/capability-index/generate.mjs --check    fail if it drifts (CI gate)
//
// Source of truth: the live capability tree (framework/skills, apex/skills, framework/roles,
// apex/agents, framework/runtime/mcp-servers). Emitted (committed, browsable): CAPABILITIES.md
// at the REPO ROOT — not under framework/, because it aggregates apex-zone descriptions and the
// catalog spans both zones (like the root README). The render is deterministic; --check proves
// the committed file equals a fresh render, mirroring emit.mjs --check.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectAll, renderCatalog } from './lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO = join(__dirname, '..', '..', '..'); // repo root (framework/standards/capability-index → up 3)
export const OUT = join(REPO, 'CAPABILITIES.md');

export function build() {
  return renderCatalog(collectAll(REPO));
}

if (process.argv[1] && process.argv[1].endsWith('generate.mjs')) {
  const isCheck = process.argv.slice(2).includes('--check');
  try {
    const fresh = build();
    if (isCheck) {
      const committed = existsSync(OUT) ? readFileSync(OUT, 'utf8') : null;
      if (committed !== fresh) {
        console.error(
          `capability-index --check: DRIFT — CAPABILITIES.md is ${committed === null ? 'missing' : 'stale'}. ` +
            'Run: node framework/standards/capability-index/generate.mjs',
        );
        process.exit(1);
      }
      console.log(
        'capability-index --check: clean — CAPABILITIES.md matches the live capability tree',
      );
    } else {
      writeFileSync(OUT, fresh);
      console.log('capability-index: wrote CAPABILITIES.md');
    }
  } catch (e) {
    console.error('capability-index: ' + e.message);
    process.exit(1);
  }
}
