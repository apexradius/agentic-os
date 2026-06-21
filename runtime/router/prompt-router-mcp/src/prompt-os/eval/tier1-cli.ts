#!/usr/bin/env node
/**
 * Apex Prompt OS — Tier-1 eval CLI
 *
 * Usage: node dist/prompt-os/eval/tier1-cli.js [library-dir]
 * Default library-dir: library (relative to cwd)
 *
 * Exit 0: all gates passed.
 * Exit 1: one or more gates failed.
 * Exit 2: fatal (unexpected error).
 */

import path from 'node:path';
import { runTier1 } from './tier1.js';

async function main(): Promise<void> {
  const arg = process.argv[2];
  const libraryDir = arg
    ? path.isAbsolute(arg)
      ? arg
      : path.resolve(process.cwd(), arg)
    : path.resolve(process.cwd(), 'library');

  const result = await runTier1(libraryDir);
  console.log(result.summary);

  if (!result.ok) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : String(err));
  process.exit(2);
});
