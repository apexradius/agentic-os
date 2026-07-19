#!/usr/bin/env node
// Apex Prompt OS — Phase 1 migration.
//
// Reads the READ-ONLY Brain monolith, parses it with the SAME parser the live
// router uses, and writes one `.prompt.md` record per prompt under
// library/prompts/<domain>/<slug>.prompt.md with `status: draft` front-matter.
//
// Byte-identical contract: each record is wrapped so that re-parsing it with
// parsePromptLibrary yields a `text` and `slug` byte-identical to the monolith
// parse. The parser trims+joins fence content, and the monolith `text` is
// already trimmed and contains no bare ``` lines, so the wrap below round-trips
// exactly.
//
// Idempotent: safe to re-run; it overwrites the migrated draft records.
// NEVER touches the published reference record (production-deploy-verify).
//
// Build first (`tsc`), then run: `node scripts/prompt-os/migrate.mjs`.

import { promises as fs, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parsePromptLibrary, slugify } from '../../dist/lib.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const LIBRARY_DIR = path.join(PACKAGE_ROOT, 'library');
const PROMPTS_DIR = path.join(LIBRARY_DIR, 'prompts');

// Legacy single-file prompt library to migrate from. Instance-specific →
// supply via APEX_PROMPT_LIBRARY_PATH; falls back to a home-dir file.
const MONOLITH_PATH =
  process.env['APEX_PROMPT_LIBRARY_PATH'] ?? path.join(os.homedir(), 'prompt-library.md');

// The published reference record is authored by hand and is NOT in the monolith.
// Guard against any slug collision overwriting it.
const RESERVED_SLUGS = new Set(['production-deploy-verify']);

// name -> domain. Anything not listed falls through to 'services'.
const DOMAIN_MAP = new Map([
  ['Universal Intake Contract', 'templates'],
  ['Copy Patterns', 'templates'],
  ['Application Development Lifecycle Master Prompt', 'lifecycle'],
  ['Existing Codebase Onboarding Prompt', 'lifecycle'],
  ['Root Cause Debugging Prompt', 'operations'],
  ['Feature Slice Build Prompt', 'lifecycle'],
  ['QA Test Strategy Prompt', 'operations'],
  ['Production Release Deploy Prompt', 'lifecycle'],
  ['Security Review Prompt', 'operations'],
  ['Refactor Migration Prompt', 'operations'],
  ['Agent Handoff Resume Prompt', 'operations'],
  ['MCP Tool Integration Prompt', 'platforms'],
  ['Incident Recovery Prompt', 'operations'],
  ['Go To Market Readiness Prompt', 'lifecycle'],
]);

function domainFor(name) {
  return DOMAIN_MAP.get(name) ?? 'services';
}

// Front-matter for a migrated draft record. Order is stable and matches the
// authoring contract field order.
function frontmatter(slug, domain) {
  return [
    '---',
    `id: ${slug}`,
    'version: 1.0.0',
    `domain: ${domain}`,
    'owner: sam',
    'model_targets: [claude-opus-4-8]',
    'status: draft',
    'contract_version: "1.0"',
    'eval_refs: []',
    'includes: []',
    'created: 2026-06-16',
    'updated: 2026-06-16',
    '---',
  ].join('\n');
}

// Re-wrap so parsePromptLibrary round-trips byte-identically:
//   `## <name>\n\n```text\n<text>\n```\n`
// (text is already trimmed; parser trims again -> identical).
function recordText(name, slug, domain, text) {
  return `${frontmatter(slug, domain)}\n\n## ${name}\n\n\`\`\`text\n${text}\n\`\`\`\n`;
}

async function main() {
  const monoText = readFileSync(MONOLITH_PATH, 'utf8');
  const { prompts, warnings } = parsePromptLibrary(monoText);

  if (warnings.length > 0) {
    console.error('Monolith parser warnings (aborting migration):');
    for (const w of warnings) console.error(`  - ${w}`);
    process.exit(1);
  }

  let written = 0;
  let skipped = 0;
  const byDomain = new Map();

  for (const prompt of prompts) {
    const slug = slugify(prompt.name);
    if (RESERVED_SLUGS.has(slug)) {
      console.warn(`SKIP (reserved slug collides with reference record): ${prompt.name}`);
      skipped += 1;
      continue;
    }
    const domain = domainFor(prompt.name);
    const domainDir = path.join(PROMPTS_DIR, domain);
    await fs.mkdir(domainDir, { recursive: true });

    const outPath = path.join(domainDir, `${slug}.prompt.md`);
    await fs.writeFile(outPath, recordText(prompt.name, slug, domain, prompt.text), 'utf8');
    written += 1;
    byDomain.set(domain, (byDomain.get(domain) ?? 0) + 1);
  }

  console.log(`migrate: parsed ${prompts.length} monolith prompts`);
  console.log(`migrate: wrote ${written} records, skipped ${skipped}`);
  for (const [domain, count] of [...byDomain.entries()].sort()) {
    console.log(`  ${domain}: ${count}`);
  }
  console.log(
    `migrate: reference record left untouched: library/prompts/lifecycle/production-deploy-verify.prompt.md`,
  );
}

main().catch((err) => {
  console.error('migrate fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
