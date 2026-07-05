/**
 * Phase 3 — Loop-engineering library + includes composition tests.
 *
 * Tests:
 * 1. All 5 loop blocks are valid (heading, non-empty ```text fence, slug === filename stem).
 * 2. Reference record in structured mode: composed text includes, in declared order:
 *    Universal Intake Contract, Loop Contract, Plan-Implement-Verify, then body.
 *    `composition` lists them in the correct order.
 * 3. A record with includes:[] → composed output is byte-identical to legacy behavior.
 * 4. Unresolved include → emits <!-- include unresolved --> marker, does not throw.
 * 5. Routing count is unaffected: resolveRoutes sees loop blocks as UNROUTED_ALLOWED.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  composePromptText,
  loadLoopBlocks,
  parsePromptLibrary,
  resolveRoutes,
  INTAKE_CONTRACT_NAME,
  UNROUTED_ALLOWED,
  type PromptEntry,
} from '../src/lib.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '../../../..');
const ENV_LIBRARY_PATH = process.env['APEX_PROMPT_LIBRARY_PATH'];
const LIBRARY_DIR =
  ENV_LIBRARY_PATH?.endsWith('index.generated.md')
    ? path.dirname(ENV_LIBRARY_PATH)
    : path.join(REPO_ROOT, 'apex/config/prompt-router/library');
const GENERATED_PATH =
  ENV_LIBRARY_PATH?.endsWith('index.generated.md')
    ? ENV_LIBRARY_PATH
    : path.join(LIBRARY_DIR, 'index.generated.md');
const LOOPS_DIR = path.join(LIBRARY_DIR, 'loops');
const REFERENCE_FILE = path.join(
  LIBRARY_DIR,
  'prompts/lifecycle/production-deploy-verify.prompt.md',
);

// ---------------------------------------------------------------------------
// 1. Loop block structural validity
// ---------------------------------------------------------------------------

describe('loop blocks: structural validity', () => {
  const EXPECTED_STEMS = [
    'loop-contract',
    'plan-implement-verify',
    'planner-generator-evaluator',
    'reflexion',
    'ralph-pattern',
  ] as const;

  for (const stem of EXPECTED_STEMS) {
    it(`${stem}.md: heading present, non-empty text fence, slug === filename stem`, async () => {
      const filePath = path.join(LOOPS_DIR, `${stem}.md`);
      const text = await fs.readFile(filePath, 'utf8');

      // Must parse to exactly 1 prompt via the standard parser
      const { prompts, warnings } = parsePromptLibrary(text);
      expect(warnings, `${stem}.md should have no parser warnings`).toHaveLength(0);
      expect(prompts, `${stem}.md should parse to exactly 1 prompt`).toHaveLength(1);

      const prompt = prompts[0]!;
      // Text fence must be non-empty
      expect(prompt.text.trim().length, `${stem}.md text must be non-empty`).toBeGreaterThan(0);

      // Heading must be present (parser only returns a prompt if heading exists)
      expect(prompt.name.length, `${stem}.md must have a non-empty heading`).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// 2. loadLoopBlocks: slug === filename stem
// ---------------------------------------------------------------------------

describe('loadLoopBlocks', () => {
  it('loads all 5 loop blocks with slug === filename stem', async () => {
    const blocks = await loadLoopBlocks(LIBRARY_DIR);
    expect(blocks.length, 'should load 5 loop blocks').toBe(5);

    const bySlug = new Map(blocks.map((b) => [b.slug, b]));
    for (const stem of [
      'loop-contract',
      'plan-implement-verify',
      'planner-generator-evaluator',
      'reflexion',
      'ralph-pattern',
    ]) {
      const block = bySlug.get(stem);
      expect(block, `loop block "${stem}" must be loaded`).toBeDefined();
      expect(block!.slug, `slug must equal filename stem "${stem}"`).toBe(stem);
      expect(block!.text.trim().length, `${stem} text must be non-empty`).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. composePromptText — DECLARATIVE mode (reference record includes)
// ---------------------------------------------------------------------------

describe('composePromptText: DECLARATIVE mode', () => {
  it('reference record: composed text contains intake + loop-contract + plan-implement-verify + body, in order', async () => {
    // Load all prompts including loop blocks (simulate structured mode)
    const generatedText = await fs.readFile(GENERATED_PATH, 'utf8');
    const { prompts: basePrompts } = parsePromptLibrary(generatedText);
    const loopBlocks = await loadLoopBlocks(LIBRARY_DIR);
    const allPrompts: PromptEntry[] = [...basePrompts, ...loopBlocks];

    // Parse the reference record's front-matter to get its includes
    const refText = await fs.readFile(REFERENCE_FILE, 'utf8');
    const { prompts: refParsed } = parsePromptLibrary(refText);
    expect(refParsed).toHaveLength(1);
    const refPrompt = refParsed[0]!;

    // Build the PromptEntry with includes as declared in front-matter
    const refEntry: PromptEntry = {
      ...refPrompt,
      includes: ['universal-intake-contract', 'loops/loop-contract', 'loops/plan-implement-verify'],
    };

    const { text: composed, composition } = composePromptText(refEntry, allPrompts);

    // composition must list them in declared order, then the prompt itself
    expect(composition[0]).toBe(INTAKE_CONTRACT_NAME);
    expect(composition[1]).toBe('Loop Contract');
    expect(composition[2]).toBe('Plan-Implement-Verify');
    expect(composition[3]).toBe(refPrompt.name);
    expect(composition).toHaveLength(4);

    // The composed text sections (split by ---) must appear in order
    const sections = composed.split('\n\n---\n\n');
    expect(sections).toHaveLength(4);

    // Section 0: intake contract text (filled with prompt name)
    expect(sections[0]).toContain('most capable Production Deploy & Verify operator');
    expect(sections[0]).toContain('shared intake + grounding gate');
    // Section 1: loop-contract block
    expect(sections[1]).toContain('TRIGGER');
    expect(sections[1]).toContain('STOP');
    expect(sections[1]).toContain('REPORT');
    // Section 2: plan-implement-verify block
    expect(sections[2]).toContain('PIV');
    expect(sections[2]).toContain('PLAN');
    expect(sections[2]).toContain('VERIFY');
    // Section 3: reference prompt body (starts with <role>)
    expect(sections[3]).toContain('<role>');
  });

  it('each include appears exactly once', async () => {
    const generatedText = await fs.readFile(GENERATED_PATH, 'utf8');
    const { prompts: basePrompts } = parsePromptLibrary(generatedText);
    const loopBlocks = await loadLoopBlocks(LIBRARY_DIR);
    const allPrompts: PromptEntry[] = [...basePrompts, ...loopBlocks];

    const refText = await fs.readFile(REFERENCE_FILE, 'utf8');
    const { prompts: refParsed } = parsePromptLibrary(refText);
    const refEntry: PromptEntry = {
      ...refParsed[0]!,
      includes: ['universal-intake-contract', 'loops/loop-contract', 'loops/plan-implement-verify'],
    };

    const { composition } = composePromptText(refEntry, allPrompts);
    // Verify no duplicates
    const counts = new Map<string, number>();
    for (const name of composition) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    for (const [name, count] of counts) {
      expect(count, `"${name}" should appear exactly once in composition`).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. composePromptText — LEGACY mode (includes undefined or empty)
// ---------------------------------------------------------------------------

describe('composePromptText: LEGACY mode (byte-identical to prior behavior)', () => {
  it('a prompt with includes:undefined behaves identically to no-includes legacy path', () => {
    // A simple prompt without ## Intake Gate → legacy prepends the contract
    const promptWithoutGate: PromptEntry = {
      name: 'Test Prompt',
      slug: 'test-prompt',
      text: 'This is the prompt body without an intake gate.',
      // includes: undefined (not set)
    };
    const contractEntry: PromptEntry = {
      name: INTAKE_CONTRACT_NAME,
      slug: 'universal-intake-contract',
      text: 'You are activating [SERVICE]. ## Intake Gate\nValidate inputs.',
    };
    const prompts = [contractEntry, promptWithoutGate];

    const { text, composition } = composePromptText(promptWithoutGate, prompts);
    // Should behave exactly like the old code: prepend intake + separator + body
    const expectedFilled = contractEntry.text.replaceAll('[SERVICE]', promptWithoutGate.name);
    expect(text).toBe(`${expectedFilled}\n\n---\n\n${promptWithoutGate.text}`);
    expect(composition).toEqual([INTAKE_CONTRACT_NAME, promptWithoutGate.name]);
  });

  it('a prompt with includes:[] also uses the legacy path (empty array = undefined)', () => {
    const promptWithoutGate: PromptEntry = {
      name: 'Test Prompt',
      slug: 'test-prompt',
      text: 'Prompt body.',
      includes: [], // explicitly empty
    };
    const contractEntry: PromptEntry = {
      name: INTAKE_CONTRACT_NAME,
      slug: 'universal-intake-contract',
      text: 'You are activating [SERVICE]. ## Intake Gate\nValidate.',
    };
    const prompts = [contractEntry, promptWithoutGate];

    const { text, composition } = composePromptText(promptWithoutGate, prompts);
    const expectedFilled = contractEntry.text.replaceAll('[SERVICE]', promptWithoutGate.name);
    expect(text).toBe(`${expectedFilled}\n\n---\n\n${promptWithoutGate.text}`);
    expect(composition).toEqual([INTAKE_CONTRACT_NAME, promptWithoutGate.name]);
  });

  it('a prompt already containing ## Intake Gate is returned as-is (legacy)', () => {
    const promptWithGate: PromptEntry = {
      name: 'Gated Prompt',
      slug: 'gated-prompt',
      text: '## Intake Gate\nAlready has a gate.',
      // includes: undefined
    };
    const contractEntry: PromptEntry = {
      name: INTAKE_CONTRACT_NAME,
      slug: 'universal-intake-contract',
      text: 'You are activating [SERVICE]. ## Intake Gate\nValidate.',
    };

    const { text, composition } = composePromptText(promptWithGate, [contractEntry, promptWithGate]);
    expect(text).toBe(promptWithGate.text);
    expect(composition).toEqual([promptWithGate.name]);
  });
});

// ---------------------------------------------------------------------------
// 5. Unresolved include → marker emitted, no throw
// ---------------------------------------------------------------------------

describe('composePromptText: unresolved includes', () => {
  it('emits HTML comment for an unknown include id', () => {
    const prompt: PromptEntry = {
      name: 'My Prompt',
      slug: 'my-prompt',
      text: 'Prompt body.',
      includes: ['loops/nonexistent-block'],
    };
    const { text, composition } = composePromptText(prompt, []);
    expect(text).toContain('<!-- include unresolved: loops/nonexistent-block -->');
    expect(composition).toContain('unresolved:loops/nonexistent-block');
    expect(composition).toContain('My Prompt');
  });

  it('emits marker for universal-intake-contract when contract is missing from prompts', () => {
    const prompt: PromptEntry = {
      name: 'My Prompt',
      slug: 'my-prompt',
      text: 'Prompt body.',
      includes: ['universal-intake-contract'],
    };
    // Pass empty prompts array — contract is missing
    const { text, composition } = composePromptText(prompt, []);
    expect(text).toContain('<!-- include unresolved: universal-intake-contract -->');
    expect(composition).toContain('unresolved:universal-intake-contract');
  });

  it('does not throw on multiple unresolved includes', () => {
    const prompt: PromptEntry = {
      name: 'My Prompt',
      slug: 'my-prompt',
      text: 'Body.',
      includes: ['loops/a', 'loops/b', 'universal-intake-contract'],
    };
    expect(() => composePromptText(prompt, [])).not.toThrow();
    const { text } = composePromptText(prompt, []);
    expect(text).toContain('<!-- include unresolved: loops/a -->');
    expect(text).toContain('<!-- include unresolved: loops/b -->');
    expect(text).toContain('<!-- include unresolved: universal-intake-contract -->');
  });
});

// ---------------------------------------------------------------------------
// 6. Routing count: loop blocks are in UNROUTED_ALLOWED — resolveRoutes not affected
// ---------------------------------------------------------------------------

describe('routing: loop blocks do not change resolved route count', () => {
  it('UNROUTED_ALLOWED contains all 5 loop block names', () => {
    const expected = [
      'Loop Contract',
      'Plan-Implement-Verify',
      'Planner-Generator-Evaluator',
      'Reflexion',
      'Ralph Pattern',
    ];
    for (const name of expected) {
      expect(UNROUTED_ALLOWED.has(name), `"${name}" must be in UNROUTED_ALLOWED`).toBe(true);
    }
  });

  it('resolveRoutes with loop blocks added: 30 resolved, 0 missing', async () => {
    const generatedText = await fs.readFile(GENERATED_PATH, 'utf8');
    const { prompts: basePrompts } = parsePromptLibrary(generatedText);
    const loopBlocks = await loadLoopBlocks(LIBRARY_DIR);
    const allPrompts: PromptEntry[] = [...basePrompts, ...loopBlocks];

    const result = resolveRoutes(allPrompts);
    expect(result.missing_route_prompts, 'no missing routes').toEqual([]);
    expect(result.resolved).toHaveLength(30);
    // Loop blocks must NOT appear in unrouted_prompts
    for (const block of loopBlocks) {
      expect(
        result.unrouted_prompts,
        `loop block "${block.name}" must not appear in unrouted_prompts`,
      ).not.toContain(block.name);
    }
  });
});
