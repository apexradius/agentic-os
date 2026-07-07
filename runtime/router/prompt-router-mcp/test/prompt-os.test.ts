import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { buildCapabilityIndex, buildProofReport, type IndexRecord } from '../src/prompt-os/build.js';
import { parseFrontmatter } from '../src/prompt-os/frontmatter.js';
import { lintRecord } from '../src/prompt-os/lint.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '../../../..');
const ENV_LIBRARY_PATH = process.env['APEX_PROMPT_LIBRARY_PATH'];
const LIBRARY_DIR =
  ENV_LIBRARY_PATH?.endsWith('index.generated.md')
    ? path.dirname(ENV_LIBRARY_PATH)
    : path.join(REPO_ROOT, 'apex/config/prompt-router/library');
const REFERENCE_FILE = path.join(
  LIBRARY_DIR,
  'prompts/lifecycle/production-deploy-verify.prompt.md',
);

// ---------------------------------------------------------------------------
// Reference record must pass with 0 errors
// ---------------------------------------------------------------------------

describe('reference record: production-deploy-verify.prompt.md', () => {
  it('lints with 0 errors and ok=true', async () => {
    const text = await fs.readFile(REFERENCE_FILE, 'utf8');
    const result = lintRecord(text, { filePath: REFERENCE_FILE });

    if (result.errors.length > 0) {
      console.error('Reference record errors:', result.errors);
    }
    if (result.warnings.length > 0) {
      console.warn('Reference record warnings:', result.warnings);
    }

    expect(result.errors, 'Reference record must have 0 errors').toHaveLength(0);
    expect(result.ok, 'Reference record ok must be true').toBe(true);

    // Warnings must be a subset of known acceptable warning codes
    const ACCEPTABLE_WARNING_CODES = new Set(['R7', 'R12', 'R-INV']);
    for (const w of result.warnings) {
      expect(ACCEPTABLE_WARNING_CODES.has(w.code), `Unexpected warning code: ${w.code}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// parseFrontmatter unit tests
// ---------------------------------------------------------------------------

describe('parseFrontmatter', () => {
  it('parses a valid front-matter block with scalars, quoted, arrays', () => {
    const text = `---
id: my-prompt
version: 1.0.0
owner: sam
model_targets: [claude-opus-4-8, gpt-5.2]
status: draft
quoted_double: "hello world"
quoted_single: 'another value'
---

## Body here
`;
    const result = parseFrontmatter(text);
    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    expect(result.data!['id']).toBe('my-prompt');
    expect(result.data!['version']).toBe('1.0.0');
    expect(result.data!['model_targets']).toEqual(['claude-opus-4-8', 'gpt-5.2']);
    expect(result.data!['quoted_double']).toBe('hello world');
    expect(result.data!['quoted_single']).toBe('another value');
    expect(result.body.trim()).toBe('## Body here');
  });

  it('strips trailing comments from unquoted scalars', () => {
    const text = `---
id: my-prompt # this is a comment
status: draft # another comment
---
body
`;
    const result = parseFrontmatter(text);
    expect(result.error).toBeNull();
    expect(result.data!['id']).toBe('my-prompt');
    expect(result.data!['status']).toBe('draft');
  });

  it('returns error for missing front-matter (no leading ---)', () => {
    const text = `## Heading
body content
`;
    const result = parseFrontmatter(text);
    expect(result.error).toBe('missing front-matter');
    expect(result.data).toBeNull();
  });

  it('parses inline flow arrays with quoted items', () => {
    const text = `---
items: ["a b", 'c d', plain]
---
body
`;
    const result = parseFrontmatter(text);
    expect(result.error).toBeNull();
    expect(result.data!['items']).toEqual(['a b', 'c d', 'plain']);
  });

  it('rejects nested/multiline: key with empty value (block scalar indicator)', () => {
    const text = `---
id: my-prompt
nested:
  sub: value
---
body
`;
    const result = parseFrontmatter(text);
    expect(result.error).not.toBeNull();
    expect(result.data).toBeNull();
  });

  it('rejects indented continuation lines', () => {
    const text = `---
id: my-prompt
description: |
  multi
  line
---
body
`;
    const result = parseFrontmatter(text);
    expect(result.error).not.toBeNull();
  });

  it('returns body correctly after closing ---', () => {
    const text = `---
id: foo
---
## Section
body content here
`;
    const result = parseFrontmatter(text);
    expect(result.error).toBeNull();
    expect(result.body).toContain('## Section');
    expect(result.body).toContain('body content here');
  });
});

// ---------------------------------------------------------------------------
// Broken fixture tests — each asserts a specific error code
// ---------------------------------------------------------------------------

// Minimal valid prompt template
function makeValidPrompt(overrides: {
  fmExtra?: string;
  id?: string;
  status?: string;
  evalRefs?: string;
  includes?: string;
  domain?: string;
  heading?: string;
  bodySections?: string;
  deprecated?: string;
}): string {
  const {
    fmExtra = '',
    id = 'my-test-prompt',
    status = 'draft',
    evalRefs = 'eval_refs: []',
    includes = 'includes: [universal-intake-contract]',
    domain = 'services',
    heading = 'My Test Prompt',
    bodySections = `<role>
You are a test agent.
</role>

<output_contract>
Output a report.
</output_contract>

<constraints>
Follow the contract.
</constraints>

<exit_criteria>
Done when complete.
</exit_criteria>`,
    deprecated = '',
  } = overrides;

  return `---
id: ${id}
version: 1.0.0
domain: ${domain}
owner: sam
model_targets: [claude-opus-4-8]
status: ${status}
contract_version: "1.0"
${evalRefs}
${includes}
created: 2026-01-01
updated: 2026-01-01${deprecated ? '\n' + deprecated : ''}${fmExtra ? '\n' + fmExtra : ''}
---

## ${heading}

\`\`\`text
${bodySections}
\`\`\`
`;
}

describe('broken fixtures — error code assertions', () => {
  it('(a) R1: missing required field (domain)', () => {
    const text = `---
id: my-test-prompt
version: 1.0.0
owner: sam
model_targets: [claude-opus-4-8]
status: draft
contract_version: "1.0"
eval_refs: []
includes: []
created: 2026-01-01
updated: 2026-01-01
---

## My Test Prompt

\`\`\`text
<role>You are a test agent.</role>
<output_contract>Output a report.</output_contract>
<constraints>Follow the contract.</constraints>
<exit_criteria>Done when complete.</exit_criteria>
\`\`\`
`;
    const result = lintRecord(text, { filePath: '/fake/my-test-prompt.prompt.md' });
    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain('R1');
  });

  it('(b) R2: id does not match slugify(heading)', () => {
    // id = 'my-test-prompt' but heading = 'Different Heading Name'
    const text = makeValidPrompt({ id: 'my-test-prompt', heading: 'Different Heading Name' });
    const result = lintRecord(text, { filePath: '/fake/my-test-prompt.prompt.md' });
    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain('R2');
  });

  it('(c) R3: id does not match file basename', () => {
    // id = 'wrong-id' but file = 'my-test-prompt.prompt.md'
    const text = makeValidPrompt({ id: 'wrong-id', heading: 'Wrong Id' });
    const result = lintRecord(text, { filePath: '/fake/my-test-prompt.prompt.md' });
    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain('R3');
  });

  it('(d) R4: missing required section <output_contract> (in_review -> error)', () => {
    const text = makeValidPrompt({
      status: 'in_review',
      bodySections: `<role>
You are a test agent.
</role>
<constraints>
Follow the contract.
</constraints>
<exit_criteria>
Done when complete.
</exit_criteria>`,
    });
    const result = lintRecord(text, { filePath: '/fake/my-test-prompt.prompt.md' });
    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain('R4');
    // Should be specifically about output_contract
    const r4Errors = result.errors.filter((e) => e.code === 'R4');
    expect(r4Errors.some((e) => e.message.includes('output_contract'))).toBe(true);
  });

  // Workflow body missing <verify> (and only <verify>). domain=lifecycle makes it
  // a workflow; status decides whether R6 is an error or a warning.
  const WORKFLOW_MISSING_VERIFY = `<role>
You are a test agent.
</role>
<output_contract>
Output a report.
</output_contract>
<constraints>
Follow the contract.
</constraints>
<exit_criteria>
Done when complete.
</exit_criteria>
<intake_gate>
Verify inputs.
</intake_gate>
<plan>
Step 1.
</plan>
<implement>
Do it.
</implement>`;

  it('(e) R6: in_review workflow prompt missing <verify> section is an ERROR', () => {
    const text = makeValidPrompt({
      domain: 'lifecycle',
      status: 'in_review',
      includes: 'includes: [loops/loop-contract]',
      bodySections: WORKFLOW_MISSING_VERIFY,
    });
    const result = lintRecord(text, { filePath: '/fake/my-test-prompt.prompt.md' });
    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain('R6');
    const r6Errors = result.errors.filter((e) => e.code === 'R6');
    expect(r6Errors.some((e) => e.message.includes('verify'))).toBe(true);
    // Must NOT be downgraded to a warning for a review-ready record.
    expect(result.warnings.map((w) => w.code)).not.toContain('R6');
  });

  it('(f) R8: status published with empty eval_refs', () => {
    const text = makeValidPrompt({
      status: 'published',
      evalRefs: 'eval_refs: []',
    });
    const result = lintRecord(text, { filePath: '/fake/my-test-prompt.prompt.md' });
    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain('R8');
  });

  it('(g) R9a: status deprecated but no deprecated date', () => {
    const text = makeValidPrompt({
      status: 'deprecated',
      evalRefs: 'eval_refs: [golden/my-test-prompt.jsonl]',
      // No deprecated date
    });
    const result = lintRecord(text, { filePath: '/fake/my-test-prompt.prompt.md' });
    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain('R9a');
  });

  it('(h) R10 or R1: bad date format', () => {
    const text = `---
id: my-test-prompt
version: 1.0.0
domain: services
owner: sam
model_targets: [claude-opus-4-8]
status: draft
contract_version: "1.0"
eval_refs: []
includes: []
created: 2026/01/01
updated: 2026-01-01
---

## My Test Prompt

\`\`\`text
<role>You are a test agent.</role>
<output_contract>Output a report.</output_contract>
<constraints>Follow the contract.</constraints>
<exit_criteria>Done when complete.</exit_criteria>
\`\`\`
`;
    const result = lintRecord(text, { filePath: '/fake/my-test-prompt.prompt.md' });
    const codes = result.errors.map((e) => e.code);
    expect(codes.some((c) => c === 'R10' || c === 'R1')).toBe(true);
  });

  it('(i) R11: unbalanced ```text fence (missing closing ```)', () => {
    const text = `---
id: my-test-prompt
version: 1.0.0
domain: services
owner: sam
model_targets: [claude-opus-4-8]
status: draft
contract_version: "1.0"
eval_refs: []
includes: []
created: 2026-01-01
updated: 2026-01-01
---

## My Test Prompt

\`\`\`text
<role>You are a test agent.</role>
<output_contract>Output.</output_contract>
<constraints>Constraints.</constraints>
<exit_criteria>Done.</exit_criteria>
`;
    // Note: no closing ```
    const result = lintRecord(text, { filePath: '/fake/my-test-prompt.prompt.md' });
    const codes = result.errors.map((e) => e.code);
    // R11 comes from parsePromptLibrary warnings (unbalanced fence)
    // The partial text is still kept so we may get no R11 on count=1 but warnings trigger it
    // Since parsePromptLibrary keeps partial text, prompts.length=1 but warnings has the unbalanced message
    expect(codes).toContain('R11');
  });

  it('(j) R12 warning: include not in allowed set', () => {
    const text = makeValidPrompt({
      includes: 'includes: [some-unknown-block]',
    });
    const result = lintRecord(text, { filePath: '/fake/my-test-prompt.prompt.md' });
    const warnCodes = result.warnings.map((w) => w.code);
    expect(warnCodes).toContain('R12');
  });

  it('(k) Prompt OS 1.1 optional metadata fields lint cleanly', () => {
    const text = makeValidPrompt({
      fmExtra: [
        'tags: [deploy, proof]',
        'trigger_phrases: ["ship to prod", "verify release"]',
        'risk_level: high',
        'allowed_tools: [shell, http]',
        'proof_required: [test, live_endpoint, log]',
        'strategy_overlays: [proof, ship]',
      ].join('\n'),
    });
    const result = lintRecord(text, { filePath: '/fake/my-test-prompt.prompt.md' });
    expect(result.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Capability index builder
// ---------------------------------------------------------------------------

describe('buildCapabilityIndex', () => {
  it('groups Prompt OS metadata into deterministic lookup maps', () => {
    const records: IndexRecord[] = [
      {
        id: 'alpha',
        name: 'Alpha',
        slug: 'alpha',
        domain: 'services',
        status: 'published',
        version: '1.0.0',
        file: 'prompts/services/alpha.prompt.md',
        sections: ['role', 'verify'],
        eval_refs: ['golden/alpha.jsonl'],
        includes: ['universal-intake-contract'],
        tags: ['revenue', 'proof'],
        trigger_phrases: ['ship alpha'],
        risk_level: 'critical',
        allowed_tools: ['record_store'],
        proof_required: ['live_endpoint', 'log'],
        strategy_overlays: ['proof', 'ship'],
      },
      {
        id: 'beta',
        name: 'Beta',
        slug: 'beta',
        domain: 'operations',
        status: 'draft',
        version: '1.0.0',
        file: 'prompts/operations/beta.prompt.md',
        sections: ['role'],
        eval_refs: [],
        includes: [],
        tags: ['proof'],
        trigger_phrases: [],
        risk_level: null,
        allowed_tools: ['filesystem'],
        proof_required: ['log'],
        strategy_overlays: ['proof'],
      },
    ];

    const index = buildCapabilityIndex(records);
    expect(index.schema_version).toBe('prompt-capability-index.v1');
    expect(index.summary.records).toBe(2);
    expect(index.summary.published).toBe(1);
    expect(index.summary.by_risk).toEqual({ critical: 1, unrated: 1 });
    expect(index.summary.proof_required).toEqual({ live_endpoint: 1, log: 2 });
    expect(index.lookups.by_proof.log).toEqual(['alpha', 'beta']);
    expect(index.lookups.by_strategy.proof).toEqual(['alpha', 'beta']);
    expect(index.lookups.by_tag.proof).toEqual(['alpha', 'beta']);
    expect(index.lookups.by_tool.record_store).toEqual(['alpha']);
  });

  it('builds a deterministic proof coverage report from capability metadata', () => {
    const index = buildCapabilityIndex([
      {
        id: 'alpha',
        name: 'Alpha',
        slug: 'alpha',
        domain: 'services',
        status: 'published',
        version: '1.0.0',
        file: 'prompts/services/alpha.prompt.md',
        sections: ['role', 'verify'],
        eval_refs: ['golden/alpha.jsonl'],
        includes: ['universal-intake-contract'],
        tags: [],
        trigger_phrases: [],
        risk_level: 'critical',
        allowed_tools: [],
        proof_required: ['live_endpoint', 'log'],
        strategy_overlays: ['proof'],
      },
      {
        id: 'beta',
        name: 'Beta',
        slug: 'beta',
        domain: 'operations',
        status: 'published',
        version: '1.0.0',
        file: 'prompts/operations/beta.prompt.md',
        sections: ['role'],
        eval_refs: ['golden/beta.jsonl'],
        includes: [],
        tags: [],
        trigger_phrases: [],
        risk_level: 'high',
        allowed_tools: [],
        proof_required: [],
        strategy_overlays: [],
      },
    ]);

    const report = buildProofReport(index);
    expect(report.schema_version).toBe('prompt-proof-report.v1');
    expect(report.summary).toEqual({
      records: 2,
      proof_required: 1,
      proof_missing: 1,
      high_risk_missing: 1,
      by_proof: { live_endpoint: 1, log: 1 },
    });
    expect(report.missing.map((record) => record.slug)).toEqual(['beta']);
    expect(report.records.map((record) => [record.slug, record.proof_status])).toEqual([
      ['alpha', 'required'],
      ['beta', 'missing'],
    ]);
  });
});

// ---------------------------------------------------------------------------
// Status-gated R4/R6: ERROR only for in_review/published; WARNING for draft.
// Migrated legacy prompts land as draft and must not break CI; the gate still
// bites for anything claiming published/in_review.
// ---------------------------------------------------------------------------

describe('status-gated R4/R6 severity', () => {
  // Workflow body that omits ONLY <verify> (drives R6).
  const WORKFLOW_NO_VERIFY = `<role>
You are a test agent.
</role>
<output_contract>
Output a report.
</output_contract>
<constraints>
Follow the contract.
</constraints>
<exit_criteria>
Done when complete.
</exit_criteria>
<intake_gate>
Verify inputs.
</intake_gate>
<plan>
Step 1.
</plan>
<implement>
Do it.
</implement>`;

  // Body that omits ONLY <output_contract> (drives R4).
  const BODY_NO_OUTPUT_CONTRACT = `<role>
You are a test agent.
</role>
<constraints>
Follow the contract.
</constraints>
<exit_criteria>
Done when complete.
</exit_criteria>`;

  it('R6: draft workflow missing <verify> yields a WARNING, not an error', () => {
    const text = makeValidPrompt({
      domain: 'lifecycle',
      status: 'draft',
      includes: 'includes: [loops/loop-contract]',
      bodySections: WORKFLOW_NO_VERIFY,
    });
    const result = lintRecord(text, { filePath: '/fake/my-test-prompt.prompt.md' });
    expect(result.errors.map((e) => e.code)).not.toContain('R6');
    const r6Warnings = result.warnings.filter((w) => w.code === 'R6');
    expect(r6Warnings.length).toBeGreaterThan(0);
    expect(r6Warnings.some((w) => w.message.includes('verify'))).toBe(true);
    // A draft with only the missing-verify finding still lints ok=true (no errors).
    expect(result.ok).toBe(true);
  });

  it('R6: published workflow missing <verify> yields an ERROR', () => {
    const text = makeValidPrompt({
      domain: 'lifecycle',
      status: 'published',
      evalRefs: 'eval_refs: [golden/my-test-prompt.jsonl]',
      includes: 'includes: [loops/loop-contract]',
      bodySections: WORKFLOW_NO_VERIFY,
    });
    const result = lintRecord(text, { filePath: '/fake/my-test-prompt.prompt.md' });
    const r6Errors = result.errors.filter((e) => e.code === 'R6');
    expect(r6Errors.length).toBeGreaterThan(0);
    expect(r6Errors.some((e) => e.message.includes('verify'))).toBe(true);
    expect(result.warnings.map((w) => w.code)).not.toContain('R6');
  });

  it('R4: draft missing <output_contract> yields a WARNING, not an error', () => {
    const text = makeValidPrompt({
      status: 'draft',
      bodySections: BODY_NO_OUTPUT_CONTRACT,
    });
    const result = lintRecord(text, { filePath: '/fake/my-test-prompt.prompt.md' });
    expect(result.errors.map((e) => e.code)).not.toContain('R4');
    const r4Warnings = result.warnings.filter((w) => w.code === 'R4');
    expect(r4Warnings.length).toBeGreaterThan(0);
    expect(r4Warnings.some((w) => w.message.includes('output_contract'))).toBe(true);
    expect(result.ok).toBe(true);
  });

  it('R4: in_review missing <output_contract> yields an ERROR', () => {
    const text = makeValidPrompt({
      status: 'in_review',
      bodySections: BODY_NO_OUTPUT_CONTRACT,
    });
    const result = lintRecord(text, { filePath: '/fake/my-test-prompt.prompt.md' });
    const r4Errors = result.errors.filter((e) => e.code === 'R4');
    expect(r4Errors.length).toBeGreaterThan(0);
    expect(r4Errors.some((e) => e.message.includes('output_contract'))).toBe(true);
    expect(result.warnings.map((w) => w.code)).not.toContain('R4');
  });
});
