const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '../../../../..');
process.env.OMNIBUS_SKILL_ROOTS = [
  `apex=${path.join(REPO_ROOT, 'apex/skills')}`,
  `framework=${path.join(REPO_ROOT, 'framework/skills')}`,
].join(',');

const omnibus = require('../src/index.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    failed++;
  }
}

function topIds(query, limit = 5) {
  return omnibus.searchSkills({ query, limit }).map(skill => skill.id);
}

function expectWithinTop(query, expectedId, maxIndexInclusive) {
  const ids = topIds(query, Math.max(5, maxIndexInclusive + 1));
  const idx = ids.indexOf(expectedId);
  assert.ok(
    idx !== -1 && idx <= maxIndexInclusive,
    `expected ${expectedId} within top ${maxIndexInclusive + 1} for "${query}", got: ${ids.join(', ')}`
  );
}

console.log('\n— live repo discoverability regression —');

test('runtime parity routes to runtime-surface-triage at the top', () => {
  expectWithinTop('runtime parity', 'apex:runtime-surface-triage', 0);
});

test('claude codex hooks keeps runtime-surface-triage discoverable near the top', () => {
  expectWithinTop('claude codex hooks', 'apex:runtime-surface-triage', 2);
});

test('qbo zoho cutover routes to books-cutover-reconciliation at the top', () => {
  expectWithinTop('qbo zoho cutover', 'apex:books-cutover-reconciliation', 0);
});

test('stale references routes to workspace-boundary-audit at the top', () => {
  expectWithinTop('stale references', 'apex:workspace-boundary-audit', 0);
});

test('launch readiness routes to launch-readiness-gate at the top', () => {
  expectWithinTop('launch readiness', 'apex:launch-readiness-gate', 0);
});

test('gtm readiness routes to launch-readiness-gate at the top', () => {
  expectWithinTop('gtm readiness', 'apex:launch-readiness-gate', 0);
});

test('legacy local-growth-audit alias still resolves to seo-audit at the top', () => {
  expectWithinTop('local-growth-audit', 'apex:seo-audit', 0);
});

if (failed > 0) {
  console.error(`\n${failed} discoverability test(s) failed.`);
  process.exit(1);
}

console.log(`\n${passed} discoverability test(s) passed.`);
