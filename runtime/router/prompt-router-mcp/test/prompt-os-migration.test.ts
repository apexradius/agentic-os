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
import { readCapabilityIndex, readIndex } from '../src/prompt-os/build.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '../../../..');
const ENV_LIBRARY_PATH = process.env['APEX_PROMPT_LIBRARY_PATH'];
const ENV_LIBRARY_IS_GENERATED = ENV_LIBRARY_PATH?.endsWith('index.generated.md') ?? false;
const LIBRARY_DIR =
  ENV_LIBRARY_IS_GENERATED && ENV_LIBRARY_PATH
    ? path.dirname(ENV_LIBRARY_PATH)
    : path.join(REPO_ROOT, 'apex/config/prompt-router/library');

const MONOLITH_PATH =
  ENV_LIBRARY_PATH && !ENV_LIBRARY_IS_GENERATED ? ENV_LIBRARY_PATH : path.join(os.homedir(), 'prompt-library.md');
const GENERATED_PATH =
  ENV_LIBRARY_IS_GENERATED && ENV_LIBRARY_PATH ? ENV_LIBRARY_PATH : path.join(LIBRARY_DIR, 'index.generated.md');

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
// route baseline, sidecar integrity, published set) ALWAYS run and are
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

  it('resolveRoutes(gen) preserves the routing baseline: 30 resolved, 0 missing', () => {
    const res = resolveRoutes(gen);
    expect(res.missing_route_prompts).toEqual([]);
    expect(res.resolved.length).toBe(30);
  });

  itMono('resolveRoutes(mono) and resolveRoutes(gen) agree on resolved count and missing', () => {
    const monoRes = resolveRoutes(mono);
    const genRes = resolveRoutes(gen);
    expect(genRes.resolved.length).toBe(monoRes.resolved.length);
    expect(genRes.missing_route_prompts).toEqual(monoRes.missing_route_prompts);
  });

  itMono('generated library additionally contains the reference record -> 32 total', () => {
    expect(gen.some((p) => p.slug === 'production-deploy-verify')).toBe(true);
    // All monolith names are present, plus the promoted reference record.
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
    const index = JSON.parse(readFileSync(path.join(LIBRARY_DIR, 'index.json'), 'utf8')) as Array<{
      slug: string;
      status: string;
      version: string;
    }>;
    const publishedBySlug = new Map(
      index.filter((r) => r.status === 'published').map((r) => [r.slug, r.version]),
    );
    expect(labelSlugs).toEqual(Array.from(publishedBySlug.keys()).sort());
    for (const slug of labelSlugs) {
      expect(labels[slug]).toEqual({ production: publishedBySlug.get(slug) });
    }
  });

  it('published records include the generated production label set', async () => {
    const index = await readIndex(LIBRARY_DIR);
    expect(index).not.toBeNull();
    const published = index!.filter((r) => r.status === 'published').map((r) => r.slug).sort();
    expect(published.length).toBeGreaterThanOrEqual(30);
    expect(published).toContain('focused-gtm-slice-prompt');
    expect(published).toContain('production-deploy-verify');
    const drafts = index!.filter((r) => r.status === 'draft');
    expect(drafts.length).toBe(index!.length - published.length);
  });

  it('capabilities.json mirrors index.json and exposes metadata lookups', async () => {
    const index = await readIndex(LIBRARY_DIR);
    const capabilities = await readCapabilityIndex(LIBRARY_DIR);
    expect(index, 'index.json must exist').not.toBeNull();
    expect(capabilities, 'capabilities.json must exist').not.toBeNull();
    expect(capabilities!.summary.records).toBe(index!.length);
    expect(capabilities!.capabilities.map((entry) => entry.slug).sort()).toEqual(
      index!.map((entry) => entry.slug).sort(),
    );
    expect(capabilities!.lookups.by_strategy.proof).toContain('production-deploy-verify');
    expect(capabilities!.lookups.by_proof.live_endpoint).toContain('production-deploy-verify');
    expect(capabilities!.lookups.by_risk.critical).toContain('production-deploy-verify');
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
    const priorMode = process.env['APEX_PROMPT_LIBRARY_MODE'];
    const priorPath = process.env['APEX_PROMPT_LIBRARY_PATH'];
    process.env['APEX_PROMPT_LIBRARY_MODE'] = 'structured';
    process.env['APEX_PROMPT_LIBRARY_PATH'] = GENERATED_PATH;
    try {
      const resolved = resolveLibraryPath(MONOLITH_PATH);
      expect(resolved).toBe(GENERATED_PATH);
      expect(existsSync(resolved)).toBe(true);
    } finally {
      if (priorMode !== undefined) process.env['APEX_PROMPT_LIBRARY_MODE'] = priorMode;
      else delete process.env['APEX_PROMPT_LIBRARY_MODE'];
      if (priorPath !== undefined) process.env['APEX_PROMPT_LIBRARY_PATH'] = priorPath;
      else delete process.env['APEX_PROMPT_LIBRARY_PATH'];
    }
  });
});
