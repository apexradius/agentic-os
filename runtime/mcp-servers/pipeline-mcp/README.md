# pipeline-mcp

A minimal MCP server that records **pipeline stage completions** — and the first
adopter of the completion-proof params
([`mcp-proof-params`](../../../standards/mcp-proof-params/), helper in
[`mcp-shared`](../../mcp-shared/src/proof/index.ts)). Its state-changing tool
refuses to record "done" without a `{ triggered, observed, matches_intent }` proof,
so the ownership standard is enforced *in the tool* — which means it bites every
surface that calls it, including hookless Claude Desktop.

It doubles as the **reference wiring** other servers copy: a state-changing tool
= `{ ...params, ...proofShape }` in the schema + `withProof(handler)`.

## Tools

| Tool | Kind | Proof? | Behavior |
|---|---|---|---|
| `pipeline_stage_complete` | state-changing | **required** | Appends a completion record to the ledger. Refused on absent/invalid proof — **nothing is written**. `matches_intent: false` refuses by design. |
| `pipeline_status` | read-only | no | Lists recorded completions, optionally filtered to one item. |
| `system_health` | read-only | no | Standard health tool (ledger reachability). |

The two enforcement layers cooperate: the zod schema rejects a call with **no
proof** at the protocol level (`-32602`), and `withProof` enforces the business
rule the type can't express — `matches_intent` must be exactly `true` — with a
plain-language refusal.

## Run

```bash
npm --prefix framework/runtime/mcp-servers/pipeline-mcp run build
node framework/runtime/mcp-servers/pipeline-mcp/dist/index.js --ledger /path/to/completions.jsonl
```

Ledger path resolves from `--ledger`, then `$PIPELINE_LEDGER`, then
`~/.local/state/pipeline-mcp/completions.jsonl`.

## The wiring (copy this into your server)

```ts
import { proofShape, withProof, toolResult } from "@framework/mcp-shared";
import { z } from "zod";

server.tool(
  "pipeline_stage_complete",
  "Record a stage complete. Requires completion proof.",
  { item_id: z.string().min(1), stage_id: z.string().min(1), ...proofShape },
  withProof(async ({ item_id, stage_id }) => {
    await ledger.append({ item_id, stage_id, /* … */ });  // reached only when proven
    return toolResult(`recorded ${stage_id} for ${item_id}`);
  }),
);
```

## Honest limit

The gate forces the caller to *attach and record* the evidence triple; it cannot
verify the evidence is true (`observed: "200 OK"` is accepted whether or not a
request was made). It is a forcing function for attestation plus an audit trail in
the ledger — not a truth oracle. Judging whether the proof is real stays with
review. Same posture as the [`completion-audit`](../../../standards/completion-audit/)
Stop hook and the [`mcp-proof-params`](../../../standards/mcp-proof-params/) gate.

## Verify

```bash
npm --prefix framework/runtime/mcp-servers/pipeline-mcp test   # vitest: refused call writes nothing to the ledger
npm --prefix framework/runtime/mcp-servers/pipeline-mcp run build
bash framework/runtime/verify-zone-purity.sh                   # zero instance coupling
```

> Last reviewed: 2026-07-14
