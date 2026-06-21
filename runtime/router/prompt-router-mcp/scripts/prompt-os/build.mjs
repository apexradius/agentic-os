#!/usr/bin/env node
// Apex Prompt OS — thin build wrapper.
// Build first (`tsc`), then run: `node scripts/prompt-os/build.mjs`.
// Emits library/index.json, library/labels.json, library/index.generated.md.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeArtifacts } from '../../dist/prompt-os/build.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const LIBRARY_DIR = path.join(PACKAGE_ROOT, 'library');

async function main() {
  const result = await writeArtifacts(LIBRARY_DIR);
  console.log(`build: indexed ${result.count} records (${result.published} published)`);
  for (const outFile of result.outFiles) {
    console.log(`  wrote ${path.relative(PACKAGE_ROOT, outFile)}`);
  }
}

main().catch((err) => {
  console.error('build fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
