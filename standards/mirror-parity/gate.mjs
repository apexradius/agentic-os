#!/usr/bin/env node
// gate.mjs — the structural-mirror engine. Two markdown files are "mirrors" when
// they carry the SAME section outline in the SAME order: a co-owned manual pair
// (CLAUDE.md ⇄ AGENTS.md is the framework's canonical case — one runtime each,
// kept diff-able). The bodies differ in voice; the skeleton must not drift.
//
// The engine is generic — it knows nothing about any instance. It compares the
// heading outline (level + text, at or below a minimum level) of two strings and
// reports where they diverge. The H1 title is excluded by default (minLevel 2),
// because a manual's title legitimately names its own runtime.
//
//   node gate.mjs <fileA> <fileB>          check one pair (paths)
//   node gate.mjs --config <path.json>     check every pair in a config
//   node gate.mjs --json                   machine-readable output
//
// Exit 0 when every pair mirrors (or is N/A), 1 on any divergence.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// ── the mechanism (pure; no fs, no instance knowledge) ───────────────────────

// Extract the heading outline, skipping fenced code blocks so a `#` inside ``` is
// not mistaken for a section. Trailing `#` (closed ATX headings) are stripped.
export function headingOutline(text, minLevel = 2) {
  const out = [];
  let inFence = false;
  for (const line of String(text).split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const level = m[1].length;
    if (level < minLevel) continue;
    out.push({ level, text: m[2].trim() });
  }
  return out;
}

const fmt = (h) => `${'#'.repeat(h.level)} ${h.text}`;

// Compare two outlines positionally. Returns a list of divergences; empty == mirror.
export function compareOutlines(a, b) {
  const findings = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = b[i];
    if (!x) {
      findings.push({ kind: 'only-in-b', index: i, b: fmt(y) });
      continue;
    }
    if (!y) {
      findings.push({ kind: 'only-in-a', index: i, a: fmt(x) });
      continue;
    }
    if (x.level !== y.level || x.text !== y.text) {
      findings.push({ kind: 'mismatch', index: i, a: fmt(x), b: fmt(y) });
    }
  }
  return findings;
}

// ── pair resolution over the filesystem ──────────────────────────────────────

// Check one {a, b} pair resolved against rootDir. A pair where BOTH files are
// absent is N/A (status "skip") — nothing claims to mirror. One present, one
// absent is itself a divergence (a half-mirror).
export function checkPair(pair, rootDir, minLevel = 2) {
  const aPath = resolve(rootDir, pair.a);
  const bPath = resolve(rootDir, pair.b);
  const aHere = existsSync(aPath);
  const bHere = existsSync(bPath);
  if (!aHere && !bHere) return { ...pair, status: 'skip', findings: [] };
  if (aHere !== bHere) {
    return {
      ...pair,
      status: 'fail',
      findings: [{ kind: aHere ? 'missing-b' : 'missing-a', b: pair.b, a: pair.a }],
    };
  }
  const findings = compareOutlines(
    headingOutline(readFileSync(aPath, 'utf8'), minLevel),
    headingOutline(readFileSync(bPath, 'utf8'), minLevel),
  );
  return { ...pair, status: findings.length ? 'fail' : 'pass', findings };
}

export function checkPairs(pairs, rootDir, minLevel = 2) {
  return pairs.map((p) => checkPair(p, rootDir, minLevel));
}

// Render a single pair result as human lines.
export function renderPair(r) {
  if (r.status === 'skip') return [`  ·  ${r.a} ⇄ ${r.b} — N/A (neither present)`];
  if (r.status === 'pass') return [`  ok ${r.a} ⇄ ${r.b} — outlines mirror`];
  const lines = [`  ✗  ${r.a} ⇄ ${r.b} — ${r.findings.length} divergence(s)`];
  for (const f of r.findings) {
    if (f.kind === 'missing-a') lines.push(`       ${f.a} is missing (its mirror ${f.b} exists)`);
    else if (f.kind === 'missing-b')
      lines.push(`       ${f.b} is missing (its mirror ${f.a} exists)`);
    else if (f.kind === 'only-in-a') lines.push(`       [${f.index}] only in ${r.a}: ${f.a}`);
    else if (f.kind === 'only-in-b') lines.push(`       [${f.index}] only in ${r.b}: ${f.b}`);
    else lines.push(`       [${f.index}] ${r.a}: ${f.a}  ≠  ${r.b}: ${f.b}`);
  }
  return lines;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function main(argv) {
  const json = argv.includes('--json');
  const rest = argv.filter((a) => a !== '--json');
  const cfgIdx = rest.indexOf('--config');

  let pairs;
  let rootDir = process.cwd();
  let minLevel = 2;

  if (cfgIdx !== -1) {
    const cfgPath = resolve(rest[cfgIdx + 1]);
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
    pairs = cfg.pairs || [];
    if (typeof cfg.minLevel === 'number') minLevel = cfg.minLevel;
    rootDir = dirname(cfgPath);
  } else {
    const files = rest.filter((a) => !a.startsWith('--'));
    if (files.length !== 2) {
      console.error('usage: gate.mjs <fileA> <fileB>  |  gate.mjs --config <path.json>  [--json]');
      return 2;
    }
    pairs = [{ a: files[0], b: files[1] }];
  }

  const results = checkPairs(pairs, rootDir, minLevel);
  if (json) {
    console.log(JSON.stringify({ results }, null, 2));
  } else {
    for (const r of results) for (const line of renderPair(r)) console.log(line);
  }
  return results.some((r) => r.status === 'fail') ? 1 : 0;
}

// Run as CLI only when invoked directly (not when imported by validate.mjs).
if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
