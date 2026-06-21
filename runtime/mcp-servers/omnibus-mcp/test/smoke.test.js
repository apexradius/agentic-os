// Smoke tests for apex-omnibus-mcp — no external test framework, pure Node assert.
// Runs against the module imported (no server bound). Covers the 8 bugs fixed 2026-05-17.
//
// Run: `npm test` or `node test/smoke.test.js`
// Wired into `npm run check` so lint+test run together.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Point the indexer at a temp dir BEFORE requiring index.js (env is read at module load).
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'omnibus-smoke-'));
const APEX_ROOT = path.join(TMP, 'apex');
const CURATED_ROOT = path.join(TMP, 'curated');
const AGENTS_ROOT = path.join(TMP, 'agents');
fs.mkdirSync(APEX_ROOT, { recursive: true });
fs.mkdirSync(CURATED_ROOT, { recursive: true });
fs.mkdirSync(AGENTS_ROOT, { recursive: true });
process.env.OMNIBUS_SKILL_ROOTS = `apex=${APEX_ROOT},curated=${CURATED_ROOT},agents=${AGENTS_ROOT}`;

// Fixtures: build a directory tree that exercises every dedup edge case.
function fxIn(root, rel, body) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
  return p;
}
function fx(rel, body) {
  return fxIn(APEX_ROOT, rel, body);
}
const SKILL_A_BODY = '---\nname: a\ndescription: "the A skill"\nmcp_dependencies: mcp-core, mcp-data\nuser-invocable: true\n---\n\n# A\n';
const SKILL_A_DIFF = '---\nname: a\ndescription: "a different A"\nmcp_dependencies: mcp-core\n---\n\n# A v2\n';
const SKILL_B_BODY = '---\nname: b\ndescription: "the B skill"\nmcp_dependencies: mcp-missing\n---\n';
const SKILL_ROOT_BODY = '---\nname: rootlevel\ndescription: "lives at root"\n---\n';
const SKILL_MD2_BODY = '---\nname: markdown-2-gate\ndescription: "Enforce the Apex Markdown 2.0 documentation standard for long Markdown, docs over 100 lines, dashboard artifact sidecars, planning boards, reports, Kanban, and status docs."\nmcp_dependencies: mcp-core\n---\n';
const SKILL_APPLE_BODY = '---\nname: apple-local\ndescription: "desktop local Apple MCP skill"\nmcp_dependencies: mcp-apple\n---\n';

// Identical content at 3 paths → dedup to ONE canonical at shortest path
fx('a/SKILL.md', SKILL_A_BODY);
fx('long-category/a/SKILL.md', SKILL_A_BODY);
fx('engineering-skills/a/SKILL.md', SKILL_A_BODY);
// Same name but DIFFERENT content → distinct entry, not a dup
fx('zzz/a/SKILL.md', SKILL_A_DIFF);
// Skill referencing a subserver that won't exist → orphan
fx('b/SKILL.md', SKILL_B_BODY);
// Skill referencing a desktop-local plugin → external dependency, not a VPS orphan
fx('apple-local/SKILL.md', SKILL_APPLE_BODY);
// Search fixture: phrase should be discoverable even when query terms are not contiguous
fx('markdown-2-gate/SKILL.md', SKILL_MD2_BODY);
fxIn(AGENTS_ROOT, 'markdown-2-gate/SKILL.md', SKILL_MD2_BODY);
// Edge case: SKILL.md at root of source
fs.writeFileSync(path.join(APEX_ROOT, 'SKILL.md'), SKILL_ROOT_BODY);
// Categories sidecar with mixed value types (Bug F #3 normalization)
fs.writeFileSync(path.join(APEX_ROOT, '.categories.json'), JSON.stringify({
  'apex:a': ['from-sidecar-arr'],
  'bare-key': ['inferred'],
  'apex:weird-string-val': 'string-not-array',
  'apex:weird-null-val': null,
}));
// Persistent aliases keep pruned duplicate skill ids resolvable after disk cleanup.
fs.writeFileSync(path.join(APEX_ROOT, '.aliases.json'), JSON.stringify({
  'legacy/a': 'a',
  'apex:legacy-object/a': { target: 'apex:a', reason: 'test alias object form' },
}));

// Now require the module (skill index built on load)
const omnibus = require('../src/index.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}

console.log('\n— pure function tests —');

test('parseSkillDeps strips mcp- prefix and trims', () => {
  assert.deepEqual(omnibus.parseSkillDeps('mcp-core, mcp-tools, mcp-data'), ['core', 'tools', 'data']);
  assert.deepEqual(omnibus.parseSkillDeps(''), []);
  assert.deepEqual(omnibus.parseSkillDeps(null), []);
  assert.deepEqual(omnibus.parseSkillDeps('  mcp-Core  ,  mcp-Data  '), ['Core', 'Data']);
});

test('parseFrontMatter extracts name/description', () => {
  const m = omnibus.parseFrontMatter('---\nname: foo\ndescription: "bar"\n---\nbody');
  assert.equal(m.name, 'foo');
  assert.equal(m.description, 'bar');
});

test('parseFrontMatter returns {} on missing or malformed frontmatter', () => {
  assert.deepEqual(omnibus.parseFrontMatter('no frontmatter at all'), {});
  assert.deepEqual(omnibus.parseFrontMatter('---\nno closing dashes'), {});
});

test('tokenizeSkillSearchQuery normalizes multi-word operator queries', () => {
  assert.deepEqual(omnibus.tokenizeSkillSearchQuery('Long Markdown dashboard artifact standard'), [
    'long', 'markdown', 'dashboard', 'artifact', 'standard',
  ]);
});

test('minimumSkillSearchMatches tolerates non-routing action words in long queries', () => {
  assert.equal(omnibus.minimumSkillSearchMatches(1), 1);
  assert.equal(omnibus.minimumSkillSearchMatches(2), 2);
  assert.equal(omnibus.minimumSkillSearchMatches(6), 3);
});

console.log('\n— sidecar normalization (Gemini finding #3) —');

test('loadCategorySidecar normalizes string/null/array values', () => {
  const map = omnibus.loadCategorySidecar([{ source: 'apex', root: APEX_ROOT }]);
  assert.deepEqual(map['apex:a'], ['from-sidecar-arr']);
  assert.deepEqual(map['apex:bare-key'], ['inferred']);          // bare key auto-prefixed
  assert.deepEqual(map['apex:weird-string-val'], ['string-not-array']);  // string → [string]
  assert.deepEqual(map['apex:weird-null-val'], []);              // null → []
});

test('loadCategorySidecar tolerates missing sidecar', () => {
  const map = omnibus.loadCategorySidecar([{ source: 'apex', root: '/tmp/does-not-exist-xyz' }]);
  assert.deepEqual(map, {});
});

test('loadAliasSidecar normalizes bare and object alias entries', () => {
  const map = omnibus.loadAliasSidecar([{ source: 'apex', root: APEX_ROOT }]);
  assert.equal(map['apex:legacy/a'], 'apex:a');
  assert.equal(map['apex:legacy-object/a'], 'apex:a');
});

console.log('\n— dedup + categories (core indexer) —');

const { canonicals, aliasMap, rawCount } = omnibus.buildSkillIndex([
  { source: 'apex', root: APEX_ROOT },
]);
const byId = new Map(canonicals.map(c => [c.id, c]));

test('rawCount preserves total skill file count before canonical dedup', () => {
  assert.equal(rawCount, 8);
});

test('three identical "a" files dedupe to ONE canonical at shortest path', () => {
  const matches = canonicals.filter(c => c.name === 'a' && c.description === 'the A skill');
  assert.equal(matches.length, 1, `expected 1 canonical, got ${matches.length}`);
  assert.equal(matches[0].id, 'apex:a', 'canonical should be the shortest-path id');
  assert.ok(matches[0].aliases.includes('apex:long-category/a'));
  assert.ok(matches[0].aliases.includes('apex:engineering-skills/a'));
});

test('different-content "a" stays distinct (apex:zzz/a)', () => {
  assert.ok(byId.has('apex:zzz/a'), 'distinct-content skill kept');
  assert.equal(byId.get('apex:zzz/a').description, 'a different A');
});

test('Gemini #1: canonical retains categories merged from aliased paths', () => {
  const canon = byId.get('apex:a');
  // Should include categories from the aliased path-prefixes AND the sidecar
  assert.ok(canon.categories.includes('long-category'), 'category from aliased path missing');
  assert.ok(canon.categories.includes('engineering-skills'), 'category from aliased path missing');
  assert.ok(canon.categories.includes('from-sidecar-arr'), 'category from sidecar missing');
});

test('aliasMap registers both alias ids → canonical entry', () => {
  assert.ok(aliasMap.has('apex:long-category/a'));
  assert.ok(aliasMap.has('apex:engineering-skills/a'));
  assert.strictEqual(aliasMap.get('apex:long-category/a'), byId.get('apex:a'));
});

test('persisted aliases resolve to canonical entries after duplicate files are pruned', () => {
  assert.ok(aliasMap.has('apex:legacy/a'));
  assert.ok(aliasMap.has('apex:legacy-object/a'));
  assert.strictEqual(aliasMap.get('apex:legacy/a'), byId.get('apex:a'));
  assert.ok(byId.get('apex:a').aliases.includes('apex:legacy/a'));
});

test('Gemini #5: root-level SKILL.md gets a non-empty skillPath', () => {
  // skillPath fell back to basename of root → "apex"
  const rootEntries = canonicals.filter(c => c.name === 'rootlevel');
  assert.equal(rootEntries.length, 1);
  assert.ok(rootEntries[0].skillPath.length > 0, 'skillPath should not be empty');
});

console.log('\n— skill search —');

test('searchSkills matches all query tokens instead of requiring exact full-query substring', () => {
  const results = omnibus.searchSkills({ query: 'long markdown dashboard artifact standard', limit: 5 });
  assert.equal(results[0].id, 'apex:markdown-2-gate');
});

test('searchSkills tolerates natural action words around routing terms', () => {
  const results = omnibus.searchSkills({ query: 'markdown 2.0 rollout long artifact standard', limit: 5 });
  assert.equal(results[0].id, 'apex:markdown-2-gate');
});

test('searchSkills suppresses duplicate mirror hits and prefers Apex canonical skills', () => {
  const results = omnibus.searchSkills({ query: 'markdown', limit: 5 });
  const markdownResults = results.filter(skill => skill.name === 'markdown-2-gate');
  assert.equal(markdownResults.length, 1);
  assert.equal(markdownResults[0].id, 'apex:markdown-2-gate');
});

test('dedupeSkillEntries suppresses duplicate mirror list entries and prefers Apex', () => {
  const { canonicals } = omnibus.buildSkillIndex([
    { source: 'apex', root: APEX_ROOT },
    { source: 'agents', root: AGENTS_ROOT },
  ]);
  const deduped = omnibus.dedupeSkillEntries(canonicals);
  const markdownResults = deduped.filter(skill => skill.name === 'markdown-2-gate');
  assert.equal(markdownResults.length, 1);
  assert.equal(markdownResults[0].id, 'apex:markdown-2-gate');
});

test('searchSkills still supports exact phrase matching', () => {
  const results = omnibus.searchSkills({ query: 'the A skill', limit: 5 });
  assert.equal(results[0].id, 'apex:a');
});

console.log('\n— validator (orphans, unused) —');

test('validateSkillDependencies surfaces missing-dep orphans', () => {
  // Mock children: provide "core" and "data" but NOT "missing"
  omnibus.__setChildrenForTest([
    { name: 'core', alive: true, tools: [] },
    { name: 'data', alive: true, tools: [] },
    { name: 'unused-subserver', alive: true, tools: [] },
  ]);
  const health = omnibus.validateSkillDependencies();
  const bOrphan = health.orphans.find(o => o.id === 'apex:b');
  assert.ok(bOrphan, 'apex:b should be flagged as orphan');
  assert.deepEqual(bOrphan.missing, ['missing']);
  assert.ok(health.unusedSubservers.includes('unused-subserver'));
  assert.ok(!health.unusedSubservers.includes('core'), 'core is referenced, should not be unused');
});

test('validateSkillDependencies reports external plugin deps without marking them missing', () => {
  omnibus.__setChildrenForTest([
    { name: 'core', alive: true, tools: [] },
    { name: 'data', alive: true, tools: [] },
  ]);
  const health = omnibus.validateSkillDependencies();
  const appleExternal = health.externalDependencyHits.find(o => o.id === 'apex:apple-local');
  assert.ok(appleExternal, 'apex:apple-local should be reported as external');
  assert.deepEqual(appleExternal.external, ['apple']);
  assert.equal(health.orphans.some(o => o.id === 'apex:apple-local'), false);
  assert.ok(health.externalDependencies.some(dep => dep.name === 'apple'));
});

test('validateSkillDependencies distinguishes "down" from "missing"', () => {
  omnibus.__setChildrenForTest([
    { name: 'core', alive: false, tools: [] },  // configured but not running
    { name: 'data', alive: true, tools: [] },
  ]);
  const health = omnibus.validateSkillDependencies();
  const aDown = health.orphans.find(o => o.id === 'apex:a');
  assert.ok(aDown, 'apex:a depends on "core" which is down — should be flagged');
  assert.ok(aDown.down.includes('core'));
});

console.log('\n— RPC envelope (Bug F: parse-error + null-body) —');

test('handleRpcMessage returns -32600 for non-object body', async () => {
  const r1 = await omnibus.handleRpcMessage(null);
  assert.equal(r1.error.code, -32600);
  assert.equal(r1.id, null);
  const r2 = await omnibus.handleRpcMessage('not an object');
  assert.equal(r2.error.code, -32600);
});

test('handleRpcMessage reflects msg.id back', async () => {
  const r = await omnibus.handleRpcMessage({ jsonrpc: '2.0', id: 42, method: 'ping' });
  assert.equal(r.id, 42);
});

test('handleRpcMessage returns method-not-found for unknown method', async () => {
  const r = await omnibus.handleRpcMessage({ jsonrpc: '2.0', id: 'x', method: 'totally-not-a-method' });
  assert.equal(r.error.code, -32601);
});

test('handleRpcMessage returns local tool result for skills__list', async () => {
  const r = await omnibus.handleRpcMessage({
    jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'skills__list', arguments: {} },
  });
  assert.ok(r.result, 'expected result');
  const payload = JSON.parse(r.result.content[0].text);
  assert.equal(typeof payload.total, 'number');
  const markdownResults = payload.skills.filter(skill => skill.name === 'markdown-2-gate');
  assert.equal(markdownResults.length, 1);
  assert.equal(markdownResults[0].id, 'apex:markdown-2-gate');
});

// cleanup
fs.rmSync(TMP, { recursive: true, force: true });

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
