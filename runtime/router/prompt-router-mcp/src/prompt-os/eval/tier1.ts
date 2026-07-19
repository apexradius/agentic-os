/**
 * Apex Prompt OS — Tier-1 eval runner (deterministic, no LLM calls).
 *
 * For each golden file in library/golden/:
 *   (a) Parse and validate every JSONL line against GoldenCaseSchema (zod).
 *   (b) Confirm the referenced prompt record exists and lints with 0 errors.
 *   (c) Assert the set is stratified (>=1 happy AND >=1 (edge OR refusal OR adversarial)).
 *   (d) For any published record, assert its eval_refs point to an existing,
 *       non-empty, stratified golden file — this is the real publish gate.
 *
 * Exit codes: 0 = all gates passed; non-zero indicates failure (thrown Error).
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { FrontmatterSchema } from '../contract.js';
import { parseFrontmatter } from '../frontmatter.js';
import { lintRecord } from '../lint.js';

// ---------------------------------------------------------------------------
// Golden case schema (JSONL line shape)
// ---------------------------------------------------------------------------

export const GoldenCaseSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['happy', 'edge', 'refusal', 'adversarial']),
  input: z.string().min(1),
  expect_contains: z.array(z.string()),
  forbid_contains: z.array(z.string()),
  expect_regex: z.string().nullable(),
  eval_criteria: z.string().min(1),
});

export type GoldenCase = z.infer<typeof GoldenCaseSchema>;

// ---------------------------------------------------------------------------
// Per-file result
// ---------------------------------------------------------------------------

export type GoldenFileResult = {
  slug: string;
  goldenFile: string;
  ok: boolean;
  caseCount: number;
  reasons: string[];
};

// ---------------------------------------------------------------------------
// Overall runner result
// ---------------------------------------------------------------------------

export type Tier1Result = {
  ok: boolean;
  goldenResults: GoldenFileResult[];
  publishGateResults: GoldenFileResult[];
  summary: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Walk a directory for *.prompt.md files (recursive).
 */
async function walkPrompts(dir: string, found: string[]): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkPrompts(full, found);
    } else if (entry.isFile() && entry.name.endsWith('.prompt.md')) {
      found.push(full);
    }
  }
}

/**
 * Parse and validate a golden JSONL file. Returns cases array or throws with
 * a descriptive reason string added to the reasons array.
 */
async function parseGoldenFile(
  goldenPath: string,
  reasons: string[],
): Promise<GoldenCase[] | null> {
  let raw: string;
  try {
    raw = await fs.readFile(goldenPath, 'utf8');
  } catch (err) {
    reasons.push(`Cannot read golden file: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }

  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    reasons.push('Golden file is empty (0 JSONL lines)');
    return null;
  }

  const cases: GoldenCase[] = [];
  for (let i = 0; i < lines.length; i++) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(lines[i]);
    } catch (err) {
      reasons.push(
        `Line ${i + 1}: invalid JSON — ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
    const result = GoldenCaseSchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues
        .map((iss) => `${iss.path.join('.')}: ${iss.message}`)
        .join('; ');
      reasons.push(
        `Line ${i + 1} (id=${(parsed as Record<string, unknown>)?.id ?? '?'}): schema violation — ${issues}`,
      );
      return null;
    }
    cases.push(result.data);
  }

  return cases;
}

/**
 * Check that a case set is stratified:
 * >= 1 happy AND >= 1 of (edge | refusal | adversarial).
 */
function checkStratified(cases: GoldenCase[], reasons: string[]): boolean {
  const hasHappy = cases.some((c) => c.type === 'happy');
  const hasNonHappy = cases.some(
    (c) => c.type === 'edge' || c.type === 'refusal' || c.type === 'adversarial',
  );
  if (!hasHappy) {
    reasons.push('Not stratified: no case with type="happy"');
  }
  if (!hasNonHappy) {
    reasons.push('Not stratified: no case with type in {edge, refusal, adversarial}');
  }
  return hasHappy && hasNonHappy;
}

/**
 * Validate one golden file in isolation (parse + validate schema + stratification).
 * Does NOT check prompt record existence — that is done in validateGoldenFiles.
 */
async function validateGoldenFileStandalone(
  goldenPath: string,
  slug: string,
): Promise<GoldenFileResult> {
  const reasons: string[] = [];
  let ok = true;

  const cases = await parseGoldenFile(goldenPath, reasons);
  if (cases === null) {
    return { slug, goldenFile: goldenPath, ok: false, caseCount: 0, reasons };
  }

  checkStratified(cases, reasons);
  ok = reasons.length === 0;

  return {
    slug,
    goldenFile: goldenPath,
    ok,
    caseCount: cases.length,
    reasons,
  };
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

/**
 * Run the Tier-1 eval harness against a library directory.
 *
 * @param libraryDir - absolute path to the `library/` directory
 *                     (must contain `golden/` and `prompts/`)
 */
export async function runTier1(libraryDir: string): Promise<Tier1Result> {
  const goldenDir = path.join(libraryDir, 'golden');
  const promptsDir = path.join(libraryDir, 'prompts');

  const goldenResults: GoldenFileResult[] = [];
  const publishGateResults: GoldenFileResult[] = [];
  const allReasons: string[] = [];

  // -------------------------------------------------------------------------
  // Step 1: discover all *.jsonl files in library/golden/
  // -------------------------------------------------------------------------
  let goldenEntries: string[] = [];
  try {
    const dirEntries = await fs.readdir(goldenDir, { withFileTypes: true });
    goldenEntries = dirEntries
      .filter((e) => e.isFile() && e.name.endsWith('.jsonl'))
      .map((e) => path.join(goldenDir, e.name));
  } catch (err) {
    allReasons.push(
      `Cannot read golden/ directory at ${goldenDir}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return {
      ok: false,
      goldenResults: [],
      publishGateResults: [],
      summary: `TIER-1 FAILED: ${allReasons.join('; ')}`,
    };
  }

  // When goldenEntries is empty we do NOT bail early — continue to step 4 so
  // published records still get checked against their eval_refs (which will fail
  // because the referenced files are missing). The empty-golden-dir situation is
  // caught by the publish gate, giving a clear per-record error message.

  // -------------------------------------------------------------------------
  // Step 2: validate each golden file (parse + schema + stratification)
  // -------------------------------------------------------------------------
  for (const goldenPath of goldenEntries.sort()) {
    const slug = path.basename(goldenPath, '.jsonl');
    const result = await validateGoldenFileStandalone(goldenPath, slug);
    goldenResults.push(result);
    if (!result.ok) {
      allReasons.push(`[golden/${slug}.jsonl] ${result.reasons.join('; ')}`);
    }
  }

  // -------------------------------------------------------------------------
  // Step 3: discover all prompt records and check linting for referenced slugs
  // -------------------------------------------------------------------------
  const promptFiles: string[] = [];
  await walkPrompts(promptsDir, promptFiles);

  // Build slug -> file path map
  const slugToFile = new Map<string, string>();
  for (const pf of promptFiles) {
    const slug = path.basename(pf, '.prompt.md');
    slugToFile.set(slug, pf);
  }

  // For each golden slug, verify the corresponding prompt record exists and lints 0 errors
  for (const gr of goldenResults) {
    const promptFile = slugToFile.get(gr.slug);
    if (!promptFile) {
      const msg = `[golden/${gr.slug}.jsonl] No prompt record found at prompts/**/${gr.slug}.prompt.md`;
      gr.ok = false;
      gr.reasons.push(`Prompt record not found for slug "${gr.slug}"`);
      allReasons.push(msg);
      continue;
    }

    let fileText: string;
    try {
      fileText = await fs.readFile(promptFile, 'utf8');
    } catch (err) {
      const msg = `[golden/${gr.slug}.jsonl] Cannot read prompt file ${promptFile}: ${err instanceof Error ? err.message : String(err)}`;
      gr.ok = false;
      gr.reasons.push(`Cannot read prompt file`);
      allReasons.push(msg);
      continue;
    }

    const lintResult = lintRecord(fileText, { filePath: promptFile });
    if (!lintResult.ok) {
      const errSummary = lintResult.errors.map((e) => `[${e.code}] ${e.message}`).join('; ');
      const msg = `[golden/${gr.slug}.jsonl] Prompt record has lint errors: ${errSummary}`;
      gr.ok = false;
      gr.reasons.push(`Prompt lint errors: ${errSummary}`);
      allReasons.push(msg);
    }
  }

  // -------------------------------------------------------------------------
  // Step 4: Publish gate — for every published prompt, assert its eval_refs
  // point to an existing, non-empty, stratified golden file.
  // -------------------------------------------------------------------------
  for (const promptFile of promptFiles.sort()) {
    let fileText: string;
    try {
      fileText = await fs.readFile(promptFile, 'utf8');
    } catch {
      continue; // unreadable files are caught in lint
    }

    const fmResult = parseFrontmatter(fileText);
    if (fmResult.error !== null || fmResult.data === null) continue;

    const parseResult = FrontmatterSchema.safeParse(fmResult.data);
    if (!parseResult.success) continue;

    const fm = parseResult.data;
    if (fm.status !== 'published') continue;

    const slug = path.basename(promptFile, '.prompt.md');

    // Each eval_ref must resolve to an existing, non-empty, stratified golden file
    for (const evalRef of fm.eval_refs) {
      // eval_refs paths are relative to libraryDir
      const absGoldenPath = path.resolve(libraryDir, evalRef);
      const refReasons: string[] = [];

      const cases = await parseGoldenFile(absGoldenPath, refReasons);
      let pgOk = true;
      let caseCount = 0;

      if (cases === null) {
        pgOk = false;
      } else {
        caseCount = cases.length;
        const stratified = checkStratified(cases, refReasons);
        pgOk = stratified && refReasons.length === 0;
      }

      const pgResult: GoldenFileResult = {
        slug: `${slug} [published gate: ${evalRef}]`,
        goldenFile: absGoldenPath,
        ok: pgOk,
        caseCount,
        reasons: refReasons,
      };
      publishGateResults.push(pgResult);

      if (!pgOk) {
        allReasons.push(
          `[publish-gate] ${slug} eval_ref "${evalRef}" failed: ${refReasons.join('; ')}`,
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  const totalGolden = goldenResults.length;
  const failedGolden = goldenResults.filter((r) => !r.ok).length;
  const failedPublish = publishGateResults.filter((r) => !r.ok).length;
  const overallOk = allReasons.length === 0;

  const lines: string[] = [
    `TIER-1 ${overallOk ? 'PASSED' : 'FAILED'}`,
    `  Golden files validated: ${totalGolden - failedGolden}/${totalGolden} passed`,
    `  Publish gates checked: ${publishGateResults.length - failedPublish}/${publishGateResults.length} passed`,
  ];

  for (const gr of goldenResults) {
    const mark = gr.ok ? '✓' : '✗';
    lines.push(
      `  ${mark} golden/${gr.slug}.jsonl — ${gr.caseCount} cases${gr.ok ? '' : ': ' + gr.reasons.join('; ')}`,
    );
  }

  for (const pg of publishGateResults) {
    const mark = pg.ok ? '✓' : '✗';
    lines.push(
      `  ${mark} [publish-gate] ${pg.slug} — ${pg.caseCount} cases${pg.ok ? '' : ': ' + pg.reasons.join('; ')}`,
    );
  }

  if (!overallOk) {
    lines.push('');
    lines.push('FAILURES:');
    for (const r of allReasons) {
      lines.push(`  - ${r}`);
    }
  }

  return {
    ok: overallOk,
    goldenResults,
    publishGateResults,
    summary: lines.join('\n'),
  };
}
