#!/usr/bin/env node
// Apex Prompt OS — CLI linter
// Usage: node dist/prompt-os/cli.js [dir1] [dir2] ...
// Default: library/prompts

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { lintFile } from './lint.js';
import type { LintResult } from './lint.js';

// ---------------------------------------------------------------------------
// Walk directories recursively for *.prompt.md files
// ---------------------------------------------------------------------------

async function walkForPrompts(dir: string, found: string[]): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    // Skip unreadable directories
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkForPrompts(full, found);
    } else if (entry.isFile() && entry.name.endsWith('.prompt.md')) {
      found.push(full);
    }
  }
}

// ---------------------------------------------------------------------------
// Report formatting
// ---------------------------------------------------------------------------

function formatResult(result: LintResult): string {
  const lines: string[] = [];
  const status = result.ok ? '✓' : '✗';
  lines.push(`${status} ${result.file}`);
  for (const err of result.errors) {
    lines.push(`  [${err.code}] ERROR: ${err.message}`);
  }
  for (const warn of result.warnings) {
    lines.push(`  [${warn.code}] WARN:  ${warn.message}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dirs = args.length > 0 ? args : ['library/prompts'];

  // Resolve relative to cwd
  const resolvedDirs = dirs.map((d) => (path.isAbsolute(d) ? d : path.resolve(process.cwd(), d)));

  const promptFiles: string[] = [];
  for (const dir of resolvedDirs) {
    await walkForPrompts(dir, promptFiles);
  }

  promptFiles.sort();

  if (promptFiles.length === 0) {
    console.log('No *.prompt.md files found in:', resolvedDirs.join(', '));
    process.exit(0);
  }

  const results: LintResult[] = [];
  for (const file of promptFiles) {
    const result = await lintFile(file);
    results.push(result);
    console.log(formatResult(result));
    if (result.errors.length > 0 || result.warnings.length > 0) {
      console.log('');
    }
  }

  const totalFiles = results.length;
  const failedFiles = results.filter((r) => !r.ok).length;
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

  console.log(
    `\nSummary: ${totalFiles} file(s) checked — ${failedFiles} failed, ${totalErrors} error(s), ${totalWarnings} warning(s)`,
  );

  if (failedFiles > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : String(err));
  process.exit(2);
});
