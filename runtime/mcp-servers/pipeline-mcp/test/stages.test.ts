import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Ledger } from '../src/ledger.js';
import { makeStageCompleteHandler } from '../src/tools/stages.js';

const goodProof = {
  triggered: 'ran `curl -s app.example/api/deliver`',
  observed: 'HTTP 200 {"status":"delivered"}',
  matches_intent: true,
};

let dir: string;
let ledger: Ledger;
const fixedClock = () => '2026-01-01T00:00:00.000Z';

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pipeline-mcp-'));
  ledger = new Ledger(join(dir, 'sub', 'completions.jsonl'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('pipeline_stage_complete (withProof)', () => {
  it('records exactly one completion on valid proof', async () => {
    const handler = makeStageCompleteHandler(ledger, fixedClock);
    const res = await handler({ item_id: 'lead-42', stage_id: 'deliver', proof: goodProof });
    expect(res.isError).toBeUndefined();
    const rows = await ledger.readAll();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      item_id: 'lead-42',
      stage_id: 'deliver',
      recorded_at: fixedClock(),
    });
  });

  it('writes NOTHING to the ledger when proof is invalid (no side effect)', async () => {
    const handler = makeStageCompleteHandler(ledger, fixedClock);
    const res = await handler({
      item_id: 'lead-42',
      stage_id: 'deliver',
      proof: { ...goodProof, matches_intent: false },
    });
    expect(res.isError).toBe(true);
    expect(await ledger.readAll()).toHaveLength(0);
  });

  it('refuses a call with no proof at all — ledger stays empty', async () => {
    const handler = makeStageCompleteHandler(ledger, fixedClock);
    const res = await handler({ item_id: 'lead-42', stage_id: 'deliver' });
    expect(res.isError).toBe(true);
    expect(await ledger.readAll()).toHaveLength(0);
  });

  it('appends across multiple proven completions', async () => {
    const handler = makeStageCompleteHandler(ledger, fixedClock);
    await handler({ item_id: 'lead-1', stage_id: 'qualify', proof: goodProof });
    await handler({ item_id: 'lead-1', stage_id: 'deliver', proof: goodProof });
    const rows = await ledger.readAll();
    expect(rows.map((r) => r.stage_id)).toEqual(['qualify', 'deliver']);
  });
});
