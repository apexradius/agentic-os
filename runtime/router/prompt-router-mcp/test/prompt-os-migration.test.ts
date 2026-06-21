import { readFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  parsePromptLibrary,
  resolveLibraryPath,
  resolveRoutes,
  type PromptEntry,
} from '../src/lib.js';
import { readIndex } from '../src/prompt-os/build.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const LIBRARY_DIR = path.join(PACKAGE_ROOT, 'library');

const MONOLITH_PATH =
  process.env['APEX_PROMPT_LIBRARY_PATH'] ??
  path.join(os.homedir(), 'prompt-library.md');
const GENERATED_PATH = path.join(LIBRARY_DIR, 'index.generated.md');

function parseFileOrThrow(p: string): PromptEntry[] {
  const text = readFileSync(p, 'utf8');
  const { prompts, warnings } = parsePromptLibrary(text);
  expect(warnings, `parser warnings in ${p}`).toHaveLength(0);
  return prompts;
}

// ---------------------------------------------------------------------------
// HARD GATE — byte-identical migration proof + routing baseline preserved.
//
// The byte-identity proof compares the in-repo generated library against the
// legacy single-file monolith, which lives OUTSIDE this repo (instance content,
// supplied via APEX_PROMPT_LIBRARY_PATH) and is therefore ABSENT in CI by
// default. Monolith-dependent assertions are SKIPPED
// when the source is unavailable — they remain a full gate on a dev machine
// where the monolith exists. The in-repo structural checks (generated parse,
// route baseline 28/0, sidecar integrity, published set) ALWAYS run and are
// the ongoing CI regression guard.
// ---------------------------------------------------------------------------

const MONO_AVAILABLE = existsSync(MONOLITH_PATH);
const itMono = it.skipIf(!MONO_AVAILABLE);

describe('Prompt OS migration HARD GATE', () => {
  const mono = MONO_AVAILABLE ? parseFileOrThrow(MONOLITH_PATH) : [];
  const gen = parseFileOrThrow(GENERATED_PATH);

  itMono('monolith parses to exactly 30 prompts (baseline)', () => {
    expect(mono).toHaveLength(30);
  });

  it('index.generated.md parses to at least 31 prompts (30 migrated + reference)', () => {
    expect(gen.length).toBeGreaterThanOrEqual(31);
  });

  itMono('every monolith prompt round-trips byte-identically (name -> slug + text)', () => {
    // Records promoted to published with rewritten typed-contract bodies
    // intentionally diverge from the legacy monolith prose — exclude them from
    // the byte-identity check. Their record still PRESENCE-checks (must exist +
    // slug match); only the text gate is lifted for the promoted set. The
    // remaining 26 unpromoted records retain the full byte-identity gate.
    const PROMOTED = new Set([
      'Root Cause Debugging Prompt',
      'Feature Slice Build Prompt',
      'QA Test Strategy Prompt',
      'Security Review Prompt',
    ]);
    const genByName = new Map(gen.map((p) => [p.name, p]));
    for (const m of mono) {
      const g = genByName.get(m.name);
      expect(g, `generated library is missing prompt "${m.name}"`).toBeDefined();
      expect(g!.slug, `slug mismatch for "${m.name}"`).toBe(m.slug);
      if (!PROMOTED.has(m.name)) {
        expect(g!.text, `text mismatch for "${m.name}"`).toBe(m.text);
      }
    }
  });

  it('resolveRoutes(gen) preserves the routing baseline: 28 resolved, 0 missing', () => {
    const res = resolveRoutes(gen);
    expect(res.missing_route_prompts).toEqual([]);
    expect(res.resolved.length).toBe(28);
  });

  itMono('resolveRoutes(mono) and resolveRoutes(gen) agree on resolved count and missing', () => {
    const monoRes = resolveRoutes(mono);
    const genRes = resolveRoutes(gen);
    expect(genRes.resolved.length).toBe(monoRes.resolved.length);
    expect(genRes.missing_route_prompts).toEqual(monoRes.missing_route_prompts);
  });

  itMono('generated library additionally contains the reference record -> 31 total', () => {
    expect(gen.some((p) => p.slug === 'production-deploy-verify')).toBe(true);
    // 30 migrated (all monolith names present) + the 1 reference.
    const monoNames = new Set(mono.map((p) => p.name));
    const extras = gen.filter((p) => !monoNames.has(p.name));
    expect(extras.map((p) => p.slug)).toContain('production-deploy-verify');
  });
});

// ---------------------------------------------------------------------------
// Sidecar artifacts: index.json per record, labels.json published-only.
// ---------------------------------------------------------------------------

describe('Prompt OS sidecar artifacts', () => {
  it('index.json has one entry per record (>=31) including the reference', async () => {
    const index = await readIndex(LIBRARY_DIR);
    expect(index, 'index.json must exist').not.toBeNull();
    const gen = parseFileOrThrow(GENERATED_PATH);
    expect(index!.length).toBe(gen.length);
    expect(index!.some((r) => r.slug === 'production-deploy-verify')).toBe(true);
    // Every generated prompt has a matching index entry by slug.
    const indexSlugs = new Set(index!.map((r) => r.slug));
    for (const p of gen) {
      expect(indexSlugs.has(p.slug), `index.json missing record ${p.slug}`).toBe(true);
    }
  });

  it('labels.json contains exactly the published record(s)', () => {
    const labelsPath = path.join(LIBRARY_DIR, 'labels.json');
    expect(existsSync(labelsPath), 'labels.json must exist').toBe(true);
    const labels = JSON.parse(readFileSync(labelsPath, 'utf8')) as Record<string, { production: string }>;
    const labelSlugs = Object.keys(labels).sort();
    // All published records are labeled for production (data-driven, not a
    // frozen single-record snapshot).
    expect(labelSlugs).toEqual([
      'feature-slice-build-prompt',
      'production-deploy-verify',
      'qa-test-strategy-prompt',
      'root-cause-debugging-prompt',
      'security-review-prompt',
    ]);
    for (const slug of labelSlugs) {
      expect(labels[slug]).toEqual({ production: '1.0.0' });
    }
  });

  it('published records match the expected promoted set', async () => {
    const index = await readIndex(LIBRARY_DIR);
    expect(index).not.toBeNull();
    const published = index!.filter((r) => r.status === 'published').map((r) => r.slug).sort();
    expect(published).toEqual([
      'feature-slice-build-prompt',
      'production-deploy-verify',
      'qa-test-strategy-prompt',
      'root-cause-debugging-prompt',
      'security-review-prompt',
    ]);
    const drafts = index!.filter((r) => r.status === 'draft');
    expect(drafts.length).toBe(index!.length - published.length);
  });
});

// ---------------------------------------------------------------------------
// Default read-path is UNCHANGED: with no env var, resolveLibraryPath returns
// the monolith default path (NOT the structured generated file).
// ---------------------------------------------------------------------------

describe('default read-path is unchanged (structured mode is opt-in)', () => {
  it('with no APEX_PROMPT_LIBRARY_MODE, resolveLibraryPath returns the default monolith path', () => {
    const prior = process.env['APEX_PROMPT_LIBRARY_MODE'];
    delete process.env['APEX_PROMPT_LIBRARY_MODE'];
    try {
      const resolved = resolveLibraryPath(MONOLITH_PATH);
      expect(resolved).toBe(MONOLITH_PATH);
    } finally {
      if (prior !== undefined) process.env['APEX_PROMPT_LIBRARY_MODE'] = prior;
    }
  });

  it('an explicit library_path override always wins, even in structured mode', () => {
    const prior = process.env['APEX_PROMPT_LIBRARY_MODE'];
    process.env['APEX_PROMPT_LIBRARY_MODE'] = 'structured';
    try {
      const resolved = resolveLibraryPath(MONOLITH_PATH, '/some/explicit/path.md');
      expect(resolved).toBe('/some/explicit/path.md');
    } finally {
      if (prior !== undefined) process.env['APEX_PROMPT_LIBRARY_MODE'] = prior;
      else delete process.env['APEX_PROMPT_LIBRARY_MODE'];
    }
  });

  it('structured mode resolves to index.generated.md when the env var is set and the file exists', () => {
    const prior = process.env['APEX_PROMPT_LIBRARY_MODE'];
    process.env['APEX_PROMPT_LIBRARY_MODE'] = 'structured';
    try {
      const resolved = resolveLibraryPath(MONOLITH_PATH);
      // structuredLibraryPath() resolves relative to dist/ at runtime; in vitest
      // (running TS from src) it resolves to <pkg>/library/index.generated.md.
      expect(resolved.endsWith(path.join('library', 'index.generated.md'))).toBe(true);
      expect(existsSync(resolved)).toBe(true);
    } finally {
      if (prior !== undefined) process.env['APEX_PROMPT_LIBRARY_MODE'] = prior;
      else delete process.env['APEX_PROMPT_LIBRARY_MODE'];
    }
  });
});
