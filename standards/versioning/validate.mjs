#!/usr/bin/env node
// validate.mjs — the versioning standard selftest, run bare or by `validate.mjs --all`. Enforces the
// machine-checkable half of doctrine/standards/versioning.md: a single valid SemVer in framework/VERSION,
// a Keep-a-Changelog framework/CHANGELOG.md whose latest *released* entry matches VERSION, and an
// [Unreleased] section — so the version a consumer pins and the changelog they read can never drift apart.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..'); // framework/
const checks = [];
const ok = (name, cond, detail = '') => {
  checks.push({ name, pass: !!cond, detail });
  return !!cond;
};

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

// ── VERSION ─────────────────────────────────────────────────────────────────────
const versionPath = join(ROOT, 'VERSION');
let version = '';
if (ok('VERSION exists at framework root', existsSync(versionPath))) {
  version = readFileSync(versionPath, 'utf8').trim();
  ok(
    'VERSION is a single valid semver line',
    SEMVER.test(version) && !version.includes('\n'),
    version,
  );
}

// ── CHANGELOG ───────────────────────────────────────────────────────────────────
const clPath = join(ROOT, 'CHANGELOG.md');
if (ok('CHANGELOG.md exists at framework root', existsSync(clPath))) {
  const cl = readFileSync(clPath, 'utf8');
  // Released entries, in file order (newest first): `## [X.Y.Z] - DATE`. [Unreleased] is excluded.
  const released = [...cl.matchAll(/^##\s+\[(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\]/gim)].map(
    (m) => m[1],
  );
  ok('CHANGELOG has at least one released version entry', released.length > 0);
  ok('CHANGELOG carries an [Unreleased] section', /^##\s+\[Unreleased\]/im.test(cl));
  if (version && released.length) {
    ok(
      "CHANGELOG's latest released entry matches VERSION",
      released[0] === version,
      `VERSION=${version} latest=${released[0]}`,
    );
    ok('VERSION has its own CHANGELOG entry', released.includes(version), version);
  }
}

// ── the semver matcher itself: RED/GREEN, so the gate can't rot ──────────────────
ok('semver: accepts 1.2.3', SEMVER.test('1.2.3'));
ok('semver: accepts 0.1.0-rc.1', SEMVER.test('0.1.0-rc.1'));
ok("semver: rejects 'v1.2.3' (no leading v)", !SEMVER.test('v1.2.3'));
ok("semver: rejects '1.2' (not three parts)", !SEMVER.test('1.2'));

const failed = checks.filter((c) => !c.pass);
for (const c of checks)
  if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ''}`);
console.log(`versioning: ${checks.length - failed.length}/${checks.length} selftest checks passed`);
process.exit(failed.length ? 1 : 0);
