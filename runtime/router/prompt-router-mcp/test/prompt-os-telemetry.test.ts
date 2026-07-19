/**
 * Phase 4 tests: routing decision log (telemetry.ts)
 *
 * Invariants under test:
 *   1. Telemetry ON: logRoutingDecision appends a well-formed JSON line.
 *   2. Second call appends a second line (JSONL, not overwrite).
 *   3. Telemetry OFF (env unset): no file created, nothing written.
 *   4. Write failure (uncreateable path) does NOT throw.
 *   5. Env is restored in afterEach so other test suites are unaffected.
 */

import { existsSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { logRoutingDecision, type RoutingDecisionRecord } from '../src/prompt-os/telemetry.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempPath(filename: string): string {
  return path.join(os.tmpdir(), `apex-telemetry-test-${process.pid}-${filename}`);
}

function buildRecord(overrides?: Partial<RoutingDecisionRecord>): RoutingDecisionRecord {
  return {
    ts: '2026-06-16T00:00:00.000Z',
    input: 'deploy to prod | last gate: QA green',
    selected: { slug: 'release-run', name: 'Production Release Deploy Prompt' },
    confidence: 85,
    margin: 22,
    runner_up: 'Root Cause Debugging Prompt',
    fallback: false,
    mode: 'monolith',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Env save/restore
// ---------------------------------------------------------------------------

let savedTelemetry: string | undefined;
let savedTelemetryPath: string | undefined;

beforeEach(() => {
  savedTelemetry = process.env['APEX_PROMPT_TELEMETRY'];
  savedTelemetryPath = process.env['APEX_PROMPT_TELEMETRY_PATH'];
});

afterEach(() => {
  if (savedTelemetry === undefined) {
    delete process.env['APEX_PROMPT_TELEMETRY'];
  } else {
    process.env['APEX_PROMPT_TELEMETRY'] = savedTelemetry;
  }
  if (savedTelemetryPath === undefined) {
    delete process.env['APEX_PROMPT_TELEMETRY_PATH'];
  } else {
    process.env['APEX_PROMPT_TELEMETRY_PATH'] = savedTelemetryPath;
  }
});

// ---------------------------------------------------------------------------
// Suite 1: Telemetry ON — appends well-formed JSONL
// ---------------------------------------------------------------------------

describe('logRoutingDecision — telemetry ON', () => {
  it('appends a well-formed JSON line with all required fields', async () => {
    const tmpPath = makeTempPath('single.jsonl');
    try {
      process.env['APEX_PROMPT_TELEMETRY'] = '1';

      const record = buildRecord();
      await logRoutingDecision(record, { logPath: tmpPath });

      expect(existsSync(tmpPath)).toBe(true);
      const content = readFileSync(tmpPath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      expect(lines).toHaveLength(1);

      const parsed = JSON.parse(lines[0]!) as RoutingDecisionRecord;

      // Required fields present
      expect(typeof parsed.ts).toBe('string');
      expect(parsed.ts).toBe('2026-06-16T00:00:00.000Z');
      expect(typeof parsed.input).toBe('string');
      expect(parsed.selected).not.toBeNull();
      expect(parsed.selected?.slug).toBe('release-run');
      expect(parsed.selected?.name).toBe('Production Release Deploy Prompt');
      expect(parsed.confidence).toBe(85);
      expect(parsed.margin).toBe(22);
      expect(parsed.runner_up).toBe('Root Cause Debugging Prompt');
      expect(parsed.fallback).toBe(false);
      expect(parsed.mode).toBe('monolith');
    } finally {
      if (existsSync(tmpPath)) rmSync(tmpPath);
    }
  });

  it('appends a second line on second call (JSONL, not overwrite)', async () => {
    const tmpPath = makeTempPath('double.jsonl');
    try {
      process.env['APEX_PROMPT_TELEMETRY'] = '1';

      await logRoutingDecision(buildRecord({ input: 'first call' }), { logPath: tmpPath });
      await logRoutingDecision(buildRecord({ input: 'second call' }), { logPath: tmpPath });

      const content = readFileSync(tmpPath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      expect(lines).toHaveLength(2);

      const first = JSON.parse(lines[0]!) as RoutingDecisionRecord;
      const second = JSON.parse(lines[1]!) as RoutingDecisionRecord;
      expect(first.input).toBe('first call');
      expect(second.input).toBe('second call');
    } finally {
      if (existsSync(tmpPath)) rmSync(tmpPath);
    }
  });

  it('handles null selected (fallback record)', async () => {
    const tmpPath = makeTempPath('fallback.jsonl');
    try {
      process.env['APEX_PROMPT_TELEMETRY'] = '1';

      await logRoutingDecision(
        buildRecord({
          selected: null,
          confidence: null,
          margin: null,
          runner_up: null,
          fallback: true,
        }),
        { logPath: tmpPath },
      );

      const content = readFileSync(tmpPath, 'utf8');
      const parsed = JSON.parse(content.trim()) as RoutingDecisionRecord;
      expect(parsed.selected).toBeNull();
      expect(parsed.fallback).toBe(true);
      expect(parsed.confidence).toBeNull();
    } finally {
      if (existsSync(tmpPath)) rmSync(tmpPath);
    }
  });

  it('creates the parent directory if it does not exist', async () => {
    const tmpDir = makeTempPath('nested-dir');
    const tmpPath = path.join(tmpDir, 'sub', 'decisions.jsonl');
    try {
      process.env['APEX_PROMPT_TELEMETRY'] = '1';

      await logRoutingDecision(buildRecord(), { logPath: tmpPath });

      expect(existsSync(tmpPath)).toBe(true);
    } finally {
      if (existsSync(tmpPath)) rmSync(tmpPath);
      if (existsSync(path.join(tmpDir, 'sub')))
        rmSync(path.join(tmpDir, 'sub'), { recursive: true });
      if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
    }
  });

  it('records structured mode when mode field is structured', async () => {
    const tmpPath = makeTempPath('structured.jsonl');
    try {
      process.env['APEX_PROMPT_TELEMETRY'] = '1';

      await logRoutingDecision(buildRecord({ mode: 'structured' }), { logPath: tmpPath });

      const content = readFileSync(tmpPath, 'utf8');
      const parsed = JSON.parse(content.trim()) as RoutingDecisionRecord;
      expect(parsed.mode).toBe('structured');
    } finally {
      if (existsSync(tmpPath)) rmSync(tmpPath);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 2: Telemetry OFF — no-op
// ---------------------------------------------------------------------------

describe('logRoutingDecision — telemetry OFF', () => {
  it('writes nothing when APEX_PROMPT_TELEMETRY is unset', async () => {
    const tmpPath = makeTempPath('off-unset.jsonl');
    delete process.env['APEX_PROMPT_TELEMETRY'];

    await logRoutingDecision(buildRecord(), { logPath: tmpPath });

    expect(existsSync(tmpPath)).toBe(false);
  });

  it('writes nothing when APEX_PROMPT_TELEMETRY is "0"', async () => {
    const tmpPath = makeTempPath('off-zero.jsonl');
    process.env['APEX_PROMPT_TELEMETRY'] = '0';

    await logRoutingDecision(buildRecord(), { logPath: tmpPath });

    expect(existsSync(tmpPath)).toBe(false);
  });

  it('writes nothing when APEX_PROMPT_TELEMETRY is "false"', async () => {
    const tmpPath = makeTempPath('off-false.jsonl');
    process.env['APEX_PROMPT_TELEMETRY'] = 'false';

    await logRoutingDecision(buildRecord(), { logPath: tmpPath });

    expect(existsSync(tmpPath)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Write failure — must not throw
// ---------------------------------------------------------------------------

describe('logRoutingDecision — write failure resilience', () => {
  it('does not throw when the path is uncreateable', async () => {
    process.env['APEX_PROMPT_TELEMETRY'] = '1';

    // Point to a location that cannot be created: a path under a file (not a dir)
    const tmpFile = makeTempPath('not-a-dir.txt');
    const { writeFileSync } = await import('node:fs');
    writeFileSync(tmpFile, 'i am a file, not a dir\n');
    const uncreateable = path.join(tmpFile, 'decisions.jsonl'); // tmpFile is a file, not a dir

    try {
      // Must complete without throwing
      await expect(
        logRoutingDecision(buildRecord(), { logPath: uncreateable }),
      ).resolves.toBeUndefined();
    } finally {
      if (existsSync(tmpFile)) rmSync(tmpFile);
    }
  });
});
