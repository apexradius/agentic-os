#!/usr/bin/env node
// validate.mjs — the service-adoption-gate standard. Enforces
// doctrine/standards/service-adoption.md with zero-dependency RED/GREEN fixtures.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  imageUsesFloatingLatest,
  scanPath,
  scanText,
  summarize,
  weakSecretValue,
} from './gate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const checks = [];
const ok = (name, cond, detail = '') => {
  checks.push({ name, pass: !!cond, detail });
  return !!cond;
};

const ruleIds = (findings) => new Set(findings.map((f) => f.rule));

ok('imageUsesFloatingLatest: catches explicit latest', imageUsesFloatingLatest('repo/app:latest'));
ok('imageUsesFloatingLatest: catches implicit latest', imageUsesFloatingLatest('postgres'));
ok('imageUsesFloatingLatest: accepts pinned semver', !imageUsesFloatingLatest('postgres:16.4'));
ok(
  'imageUsesFloatingLatest: accepts digest pin',
  !imageUsesFloatingLatest('repo/app@sha256:aaaaaaaa'),
);
ok('weakSecretValue: catches fallback defaults', weakSecretValue('${API_KEY:-changeme}'));
ok('weakSecretValue: accepts env indirection', !weakSecretValue('${API_KEY}'));

const redResults = scanPath(join(__dirname, 'fixtures', 'red'));
const red = summarize(redResults);
const redSet = ruleIds(red);
for (const id of [
  'docker-floating-latest',
  'docker-socket-mount',
  'docker-privileged',
  'docker-sys-admin',
  'docker-seccomp-unconfined',
  'browser-no-sandbox',
  'default-secret',
  'unsafe-cookie-defaults',
]) {
  ok(`fixtures/red: ${id} fires`, redSet.has(id), `fired: ${[...redSet].join(',')}`);
}

const greenResults = scanPath(join(__dirname, 'fixtures', 'green'));
const green = summarize(greenResults);
ok(
  'fixtures/green: no adoption findings',
  green.length === 0,
  green.map((f) => `${f.rule}@${f.line}`).join(', '),
);

const inlineCookie = scanText(
  "res.cookie('sid', token, { httpOnly: true, secure: true, sameSite: 'lax' });",
);
ok('scanText: secure cookie fixture stays clean', inlineCookie.length === 0);

const readme = readFileSync(join(__dirname, 'README.md'), 'utf8');
ok(
  'README: names every blocked deployment smell',
  [
    'latest',
    'Docker socket',
    'privileged',
    'SYS_ADMIN',
    'seccomp',
    '--no-sandbox',
    'default secrets',
    'cookies',
  ].every((needle) => readme.includes(needle)),
);

for (const f of ['validate.mjs', 'gate.mjs', 'README.md'])
  ok(`file present: ${f}`, existsSync(join(__dirname, f)));

const failed = checks.filter((c) => !c.pass);
for (const c of checks)
  if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ''}`);
console.log(
  `service-adoption-gate: ${checks.length - failed.length}/${checks.length} selftest checks passed`,
);
process.exit(failed.length ? 1 : 0);
