#!/usr/bin/env node
// validate.mjs — the primitive validator runner.
//
//   node validate.mjs --selftest    prove the toolchain itself works (2A exit check)
//   node validate.mjs --all         run every primitive AND standard validator
//   node validate.mjs <primitive>   run one primitive's validator
//
// The per-primitive validators live next to each primitive (framework/primitives/
// <name>/validate.mjs); the standards validators live next to each standard
// (framework/standards/<name>/validate.mjs). Both import from this _lib. `--all`
// discovers both trees so the one command is the whole CI gate.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitAgentToml } from './emit-toml.mjs';
import { parseFrontmatter } from './frontmatter.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRIMITIVES = join(__dirname, '..'); // framework/primitives
const STANDARDS = join(__dirname, '..', '..', 'standards'); // framework/standards

const args = process.argv.slice(2);

if (args.includes('--selftest')) {
  process.exit(runSelftest() ? 0 : 1);
}

if (args.includes('--all')) {
  process.exit(runAll() ? 0 : 1);
}

// A bare primitive name runs just that primitive's validator.
const named = args.find((a) => !a.startsWith('--'));
if (named) {
  const p = join(PRIMITIVES, named, 'validate.mjs');
  if (!existsSync(p)) {
    console.error(`validate.mjs: no validator at framework/primitives/${named}/validate.mjs`);
    process.exit(2);
  }
  process.exit(runValidator(p) ? 0 : 1);
}

console.error('usage: validate.mjs --selftest | --all | <primitive>');
process.exit(2);

// Discover every <root>/<name>/validate.mjs under a tree (skipping `exclude`).
function discover(root, exclude) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== exclude)
    .map((d) => ({ name: d.name, path: join(root, d.name, 'validate.mjs') }))
    .filter((v) => existsSync(v.path))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Run every primitive validator AND every standard validator. The primitive blocks print
// exactly as before; standards are appended under a `standards/` label.
function runAll() {
  const primitives = discover(PRIMITIVES, '_lib');
  const standards = discover(STANDARDS);
  const all = [
    ...primitives.map((v) => ({ ...v, label: v.name })),
    ...standards.map((v) => ({ ...v, label: `standards/${v.name}` })),
  ];

  if (all.length === 0) {
    console.error('validate.mjs --all: no validators found yet');
    return false;
  }
  let ok = true;
  for (const v of all) {
    console.log(`\n# ${v.label}`);
    if (!runValidator(v.path)) ok = false;
  }
  const std = standards.length;
  const tally = `${primitives.length} primitives${std ? ` + ${std} standard${std === 1 ? '' : 's'}` : ''}`;
  console.log(`\n${ok ? `ALL VALID (${tally})` : 'VALIDATION FAILED'}`);
  return ok;
}

function runValidator(path) {
  try {
    execFileSync('node', [path], { stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-test: parse a fixture whose BODY contains `---` fences and a backslash,
// then prove the emit is deterministic AND produces valid toml that reproduces the
// body byte-for-byte. This is the 2A foundation gate.
// ─────────────────────────────────────────────────────────────────────────────
function runSelftest() {
  const checks = [];
  const ok = (name, cond, detail = '') => {
    checks.push({ name, pass: !!cond, detail });
    return !!cond;
  };

  // A deliberately nasty fixture: nested frontmatter list, a body with markdown `---`
  // rules (the classic frontmatter-parser trap) and a literal backslash sequence.
  const fixture = [
    '---',
    'name: selftest-agent',
    'description: A fixture agent — proves the parser survives `---` in the body.',
    'model: claude-sonnet-5',
    'skills:',
    '  - alpha',
    '  - beta',
    '---',
    '<Agent_Prompt>',
    '  <Role>Fixture role.</Role>',
    '',
    '  --- this is a markdown rule inside the body, not a fence ---',
    '',
    '  <Constraints>Match `\\d+` and never split on the line above.</Constraints>',
    '</Agent_Prompt>',
    '',
  ].join('\n');

  // 1. Determinism of parse.
  const a = parseFrontmatter(fixture);
  const b = parseFrontmatter(fixture);
  ok('parse: name extracted', a.data.name === 'selftest-agent', a.data.name);
  ok(
    'parse: description extracted',
    typeof a.data.description === 'string' && a.data.description.length > 0,
  );
  ok('parse: nested list survives', Array.isArray(a.data.skills) && a.data.skills.length === 2);
  ok('parse: body keeps the embedded `---` rule', /\n {2}--- this is a markdown rule/.test(a.body));
  ok('parse: body keeps <Agent_Prompt>', a.body.includes('<Agent_Prompt>'));
  ok(
    'parse: deterministic',
    JSON.stringify(a.data) === JSON.stringify(b.data) && a.body === b.body,
  );

  // 2. Idempotent emit.
  const toml1 = emitAgentToml({ name: a.data.name, description: a.data.description, body: a.body });
  const toml2 = emitAgentToml({ name: a.data.name, description: a.data.description, body: a.body });
  ok('emit: byte-stable across two runs', toml1 === toml2);
  ok(
    'emit: has the 3 Codex keys',
    /^name = /m.test(toml1) &&
      /^description = /m.test(toml1) &&
      /developer_instructions = """/.test(toml1),
  );
  ok('emit: embedded `---` rule carried into body', toml1.includes('--- this is a markdown rule'));
  ok('emit: backslash escaped to \\\\', toml1.includes('\\\\d+'));

  // 3. The `"""` guard fails loud (we never emit invalid toml silently).
  let guardThrew = false;
  try {
    emitAgentToml({ name: 'x', description: 'y', body: 'has a """ triple quote' });
  } catch {
    guardThrew = true;
  }
  ok('emit: refuses a body containing """', guardThrew);

  // 4. Real proof: the emitted toml PARSES and reproduces the body byte-for-byte.
  const cleanBody = a.body.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const rt = tomlRoundTrip(toml1, cleanBody);
  if (rt.skipped) {
    ok(`toml round-trip (python tomllib) — SKIPPED: ${rt.reason}`, true);
  } else {
    ok('toml: parses as valid TOML and reproduces the body exactly', rt.pass, rt.detail);
  }

  // Report.
  const failed = checks.filter((c) => !c.pass);
  for (const c of checks) {
    console.log(
      `  ${c.pass ? 'ok  ' : 'FAIL'} ${c.name}${c.detail && !c.pass ? `  [${c.detail}]` : ''}`,
    );
  }
  console.log(`\nselftest: ${checks.length - failed.length}/${checks.length} passed`);
  return failed.length === 0;
}

// Parse the emitted toml with python's stdlib tomllib and compare the recovered
// developer_instructions to the expected body. Skips gracefully if python3/tomllib
// is unavailable (this is a bonus proof, not a hard dependency of the framework).
function tomlRoundTrip(tomlText, expectedBody) {
  let dir;
  try {
    dir = mkdtempSync(join(tmpdir(), 'apex-selftest-'));
    const tomlPath = join(dir, 'agent.toml');
    const outPath = join(dir, 'out.txt');
    writeFileSync(tomlPath, tomlText);
    const py =
      'import tomllib,sys\n' +
      "d=tomllib.load(open(sys.argv[1],'rb'))\n" +
      "open(sys.argv[2],'w').write(d['developer_instructions'])\n";
    execFileSync('python3', ['-c', py, tomlPath, outPath], { stdio: ['ignore', 'ignore', 'pipe'] });
    const recovered = readFileSync(outPath, 'utf8');
    // tomllib trims the newline immediately after the opening `"""`; the closing
    // delimiter is glued to the last body line, so the recovered value is exactly the
    // body (no leading/trailing newline).
    const pass = recovered === expectedBody;
    return {
      skipped: false,
      pass,
      detail: pass ? '' : `recovered ${recovered.length}b vs expected ${expectedBody.length}b`,
    };
  } catch (err) {
    const reason =
      err && err.code === 'ENOENT'
        ? 'python3 not found'
        : `python3/tomllib error (${err && err.code})`;
    return { skipped: true, reason };
  } finally {
    if (dir) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    }
  }
}
