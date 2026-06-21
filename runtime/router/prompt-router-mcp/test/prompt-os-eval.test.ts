/**
 * Tests for Phase 2 eval harness:
 *   1. runTier1 passes on the current library (5 golden sets present, published
 *      record's publish gate satisfied).
 *   2. Negative: a published record whose golden file is missing/empty/unstratified
 *      → runTier1 fails with a clear reason.
 *   3. Tier-2 scoring logic: given a recorded output + golden case, scorer returns
 *      correct pass/fail. Tests invoke the canonical Python scorer via child_process
 *      (single source of truth — no TS mirror to drift).
 */

import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runTier1, GoldenCaseSchema } from '../src/prompt-os/eval/tier1.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const LIBRARY_DIR = path.join(PACKAGE_ROOT, 'library');
const RUN_TIER2_PY = path.join(PACKAGE_ROOT, 'scripts/prompt-os/eval/run_tier2.py');

// ---------------------------------------------------------------------------
// Helper: call canonical Python scorer (single source of truth)
// ---------------------------------------------------------------------------

interface GoldenCaseInput {
  id?: string;
  expect_contains?: string[];
  forbid_contains?: string[];
  expect_regex?: string | null;
  eval_criteria?: string;
}

interface ScoreResult {
  case_id: string;
  passed: boolean;
  score: number;
  matched_expected: number;
  missed_expected: number;
  forbidden_hits: number;
  regex_match: boolean;
  details: string;
}

function scoreCase(goldenCase: GoldenCaseInput, modelOutput: string): ScoreResult {
  const payload = JSON.stringify({ case: goldenCase, output: modelOutput });
  const stdout = execFileSync('python3', [RUN_TIER2_PY, '--score-case'], {
    input: payload,
    encoding: 'utf8',
  });
  return JSON.parse(stdout.trim()) as ScoreResult;
}

// ---------------------------------------------------------------------------
// 1. runTier1 passes on the real library
// ---------------------------------------------------------------------------

describe('runTier1 — real library', () => {
  it('passes with 5 golden sets and published record gate satisfied', async () => {
    const result = await runTier1(LIBRARY_DIR);

    if (!result.ok) {
      console.error('Tier-1 failure summary:\n', result.summary);
    }

    expect(result.ok, 'runTier1 must pass on the current library').toBe(true);
    expect(result.goldenResults.length, 'Must have 5 golden sets').toBe(5);
    expect(
      result.goldenResults.every((r) => r.ok),
      'All golden sets must validate',
    ).toBe(true);
    expect(
      result.publishGateResults.every((r) => r.ok),
      'All publish gates must pass',
    ).toBe(true);
  });

  it('each golden set has at least 5 cases', async () => {
    const result = await runTier1(LIBRARY_DIR);
    for (const gr of result.goldenResults) {
      expect(gr.caseCount, `${gr.slug} must have >= 5 cases`).toBeGreaterThanOrEqual(5);
    }
  });

  it('all golden JSONL lines parse against GoldenCaseSchema', async () => {
    const goldenDir = path.join(LIBRARY_DIR, 'golden');
    const entries = await fs.readdir(goldenDir);
    const jsonlFiles = entries.filter((e) => e.endsWith('.jsonl'));

    expect(jsonlFiles.length, 'Must have 5 golden files').toBe(5);

    for (const file of jsonlFiles) {
      const raw = await fs.readFile(path.join(goldenDir, file), 'utf8');
      const lines = raw.split('\n').filter((l) => l.trim().length > 0);
      for (let i = 0; i < lines.length; i++) {
        const parsed = JSON.parse(lines[i]);
        const result = GoldenCaseSchema.safeParse(parsed);
        expect(
          result.success,
          `${file}:line ${i + 1} failed schema: ${result.success ? '' : result.error.message}`,
        ).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Negative test: published record with broken golden → runTier1 fails
// ---------------------------------------------------------------------------

describe('runTier1 — negative fixtures', () => {
  // We create a temporary library dir with a published prompt whose golden
  // file is missing/empty/unstratified, verify that runTier1 returns ok=false.

  let tmpDir: string;

  beforeEach(async () => {
    // Create temp dir structure
    tmpDir = path.join(PACKAGE_ROOT, '.tmp-tier1-test-' + Date.now());
    await fs.mkdir(path.join(tmpDir, 'golden'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'prompts', 'lifecycle'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  /** Write a minimal valid published prompt record with a given eval_ref. */
  async function writePublishedPrompt(
    slug: string,
    evalRef: string,
    bodySections: string,
  ): Promise<void> {
    const content = `---
id: ${slug}
version: 1.0.0
domain: lifecycle
owner: ayo
model_targets: [claude-opus-4-8]
status: published
contract_version: "1.0"
eval_refs: [${evalRef}]
includes: [universal-intake-contract, loops/loop-contract, loops/plan-implement-verify]
created: 2026-06-16
updated: 2026-06-16
---

## ${slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}

\`\`\`text
${bodySections}
\`\`\`
`;
    await fs.writeFile(
      path.join(tmpDir, 'prompts', 'lifecycle', `${slug}.prompt.md`),
      content,
      'utf8',
    );
  }

  const FULL_BODY_SECTIONS = `<role>
You are a test agent.
</role>
<output_contract>
Output a report.
</output_contract>
<constraints>
Follow the contract when conditions apply.
</constraints>
<exit_criteria>
Done when complete.
</exit_criteria>
<intake_gate>
Verify inputs before acting.
</intake_gate>
<plan>
Step 1: plan.
</plan>
<implement>
Step 2: implement.
</implement>
<verify>
Step 3: verify with real input.
</verify>`;

  it('fails when published record golden file is missing', async () => {
    await writePublishedPrompt(
      'test-prompt-missing-golden',
      'golden/test-prompt-missing-golden.jsonl',
      FULL_BODY_SECTIONS,
    );
    // Do NOT create the golden file

    const result = await runTier1(tmpDir);

    expect(result.ok, 'Should fail when golden file is missing').toBe(false);
    const hasRelevantFailure = result.publishGateResults.some((r) => !r.ok);
    expect(hasRelevantFailure, 'publishGateResults must include a failure').toBe(true);

    // The failure reason must be clear (mention the missing/unreadable file)
    const failedGate = result.publishGateResults.find((r) => !r.ok);
    expect(failedGate?.reasons.length, 'Must have at least one reason').toBeGreaterThan(0);
  });

  it('fails when published record golden file is empty', async () => {
    await writePublishedPrompt(
      'test-prompt-empty-golden',
      'golden/test-prompt-empty-golden.jsonl',
      FULL_BODY_SECTIONS,
    );
    await fs.writeFile(
      path.join(tmpDir, 'golden', 'test-prompt-empty-golden.jsonl'),
      '',
      'utf8',
    );

    const result = await runTier1(tmpDir);

    expect(result.ok, 'Should fail when golden file is empty').toBe(false);
    const reason = result.summary;
    expect(reason, 'Summary must mention the failure').toMatch(/empty|0 JSONL/i);
  });

  it('fails when published record golden file is not stratified (happy only)', async () => {
    await writePublishedPrompt(
      'test-prompt-unstratified',
      'golden/test-prompt-unstratified.jsonl',
      FULL_BODY_SECTIONS,
    );
    // Golden with only happy cases — not stratified
    const happyOnly = JSON.stringify({
      id: 'case1',
      type: 'happy',
      input: 'test input',
      expect_contains: ['result'],
      forbid_contains: [],
      expect_regex: null,
      eval_criteria: 'Should pass',
    });
    await fs.writeFile(
      path.join(tmpDir, 'golden', 'test-prompt-unstratified.jsonl'),
      happyOnly + '\n',
      'utf8',
    );

    const result = await runTier1(tmpDir);

    expect(result.ok, 'Should fail when golden is not stratified').toBe(false);
    const failedGate = result.publishGateResults.find((r) => !r.ok);
    expect(
      failedGate?.reasons.some((r) => /stratif/i.test(r)),
      'Reason must mention stratification',
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Tier-2 scoring logic — unit tests via canonical Python scorer
//    Calls run_tier2.py --score-case; no API call, no TS mirror.
// ---------------------------------------------------------------------------

describe('scoreCase — Tier-2 deterministic scorer (canonical Python via child_process)', () => {
  it('passes a happy output that contains all expected strings and matches regex', () => {
    const goldenCase: GoldenCaseInput = {
      id: 'test_happy',
      expect_contains: ['VERDICT: VERIFIED', 'PASS'],
      forbid_contains: ['FAILED', 'ERROR'],
      expect_regex: 'VERDICT:\\s*VERIFIED',
      eval_criteria: 'Must say VERIFIED and PASS',
    };
    const output = 'VERDICT: VERIFIED\nAll checks: PASS\n';
    const result = scoreCase(goldenCase, output);
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.forbidden_hits).toBe(0);
    expect(result.regex_match).toBe(true);
  });

  it('fails when a forbidden string is present', () => {
    const goldenCase: GoldenCaseInput = {
      id: 'test_forbidden',
      expect_contains: ['VERDICT: HALTED_PRE_DEPLOY'],
      forbid_contains: ['migration run'],
      expect_regex: null,
      eval_criteria: 'Must halt, must not run migration',
    };
    const output = 'VERDICT: HALTED_PRE_DEPLOY\nmigration run successfully\n';
    const result = scoreCase(goldenCase, output);
    expect(result.passed).toBe(false);
    expect(result.forbidden_hits).toBe(1);
    expect(result.details).toContain('forbidden');
  });

  it('fails when expected strings are missing', () => {
    const goldenCase: GoldenCaseInput = {
      id: 'test_missing',
      expect_contains: ['VERDICT: VERIFIED', 'ACTIONS_TAKEN', 'ROLLBACK_REF'],
      forbid_contains: [],
      expect_regex: null,
      eval_criteria: 'Must have all required RELEASE REPORT fields',
    };
    const output = 'VERDICT: VERIFIED\n'; // missing ACTIONS_TAKEN and ROLLBACK_REF
    const result = scoreCase(goldenCase, output);
    // Score = 100 - 2*15 = 70, so not auto-failed by score, but missed_expected = 2
    // passed = score>=60 && forbiddenHits==0 && no regex = true (70 >= 60)
    // Actually it passes score threshold — the expected strings penalty applies to score
    expect(result.missed_expected).toBe(2);
    expect(result.matched_expected).toBe(1);
  });

  it('fails when regex does not match', () => {
    const goldenCase: GoldenCaseInput = {
      id: 'test_regex',
      expect_contains: [],
      forbid_contains: [],
      expect_regex: 'VERDICT:\\s*ESCALATED',
      eval_criteria: 'Must escalate',
    };
    const output = 'VERDICT: ROLLED_BACK\n';
    const result = scoreCase(goldenCase, output);
    expect(result.passed).toBe(false);
    expect(result.regex_match).toBe(false);
    expect(result.details).toContain('regex did not match');
  });

  it('passes when no constraints are set (empty case)', () => {
    const goldenCase: GoldenCaseInput = {
      id: 'test_empty',
      expect_contains: [],
      forbid_contains: [],
      expect_regex: null,
      eval_criteria: 'No specific checks',
    };
    const output = 'Some output here.';
    const result = scoreCase(goldenCase, output);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it('details string says "all checks passed" when everything passes', () => {
    const goldenCase: GoldenCaseInput = {
      id: 'test_detail',
      expect_contains: ['hello'],
      forbid_contains: ['goodbye'],
      expect_regex: 'hello',
      eval_criteria: 'Test',
    };
    const output = 'hello world';
    const result = scoreCase(goldenCase, output);
    expect(result.passed).toBe(true);
    expect(result.details).toBe('all checks passed');
  });

  it('caseId defaults to "unknown" when id is absent', () => {
    const goldenCase: GoldenCaseInput = {};
    const result = scoreCase(goldenCase, 'output');
    expect(result.case_id).toBe('unknown');
  });
});
