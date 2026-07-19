import { proofShape, toolResult, withProof } from '@framework/mcp-shared';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { CompletionRecord, Ledger } from '../ledger.js';

/** Wall clock, injectable so tests stay deterministic. */
export type Clock = () => string;
const systemClock: Clock = () => new Date().toISOString();

interface StageCompleteArgs {
  item_id: string;
  stage_id: string;
  proof?: unknown;
}

/**
 * The proof-gated completion handler, exported for direct unit testing.
 * `withProof` refuses an invalid/absent proof BEFORE the ledger is touched —
 * so a refused call records nothing. `matches_intent: false` is a refusal by
 * design: a completion recorder must not record a result that did not match.
 */
export function makeStageCompleteHandler(ledger: Ledger, clock: Clock = systemClock) {
  return withProof(async (args: StageCompleteArgs) => {
    const record: CompletionRecord = {
      item_id: args.item_id,
      stage_id: args.stage_id,
      proof: args.proof,
      recorded_at: clock(),
    };
    await ledger.append(record);
    return toolResult(
      `recorded stage complete — item=${args.item_id} stage=${args.stage_id} (proven)`,
    );
  });
}

export function registerStageTools(
  server: McpServer,
  ledger: Ledger,
  clock: Clock = systemClock,
): void {
  server.tool(
    'pipeline_stage_complete',
    'Record a pipeline stage as complete for an item. State-changing: requires a ' +
      'completion proof of { triggered, observed, matches_intent }. No record is ' +
      'written on an unproven call — attach what you actually ran and saw.',
    {
      item_id: z.string().min(1).describe('The pipeline item (lead, order, ticket, …) id.'),
      stage_id: z.string().min(1).describe('The stage being marked complete, e.g. "deliver".'),
      ...proofShape,
    },
    makeStageCompleteHandler(ledger, clock),
  );

  server.tool(
    'pipeline_status',
    'Read-only: list recorded stage completions, optionally filtered to one item. ' +
      'No proof required — this changes nothing.',
    {
      item_id: z.string().optional().describe('Filter to a single pipeline item id.'),
    },
    async ({ item_id }) => {
      const all = await ledger.readAll();
      const rows = item_id ? all.filter((r) => r.item_id === item_id) : all;
      if (rows.length === 0) return toolResult('no recorded completions');
      const lines = rows.map((r) => `${r.recorded_at}  ${r.item_id}  ${r.stage_id}`);
      return toolResult([`completions (${rows.length}):`, ...lines].join('\n'));
    },
  );
}
