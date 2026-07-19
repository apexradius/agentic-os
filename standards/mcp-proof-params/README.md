# mcp-proof-params

The **MCP-substrate half** of the ownership standard's "self-reported done is not
enough" ([`framework/loop/verification.md`](../../loop/verification.md)). A
state-changing / completion-recording MCP tool that adopts the proof helper cannot be
invoked to record a result without the caller attaching what it **triggered**, what it
**observed**, and a confirmation the observation **matched intent** — the server
refuses otherwise.

This is the enforcement plane that reaches a **hookless surface**. A `PreToolUse` or
`Stop` hook governs only Claude Code; it cannot touch Claude Desktop, which has no hook
plane. But every surface — Claude Code, Claude Desktop, any MCP client — calls the same
MCP server, so a refusal that lives *in the tool* bites them all identically. Proof
params are the only cross-surface structural teeth for the ownership mentality.

The runtime helper ships in
[`framework/runtime/mcp-shared`](../../runtime/mcp-shared/src/proof/index.ts) so any
first-party server composes it in one line.

## Run it

```bash
# Selftest only (proves the rule + the runtime helper's adoption/wiring, zero deps):
node framework/standards/mcp-proof-params/validate.mjs

# Full harness (runs this alongside every other primitive and standard):
node framework/primitives/_lib/validate.mjs --all

# The runtime BEHAVIOR (zod schema + handler wrapping) — proven in the TS workspace:
npm --prefix framework/runtime/mcp-shared test   # vitest: test/proof.test.ts
```

## How a server adopts it

Spread `proofShape` into the tool's input schema and wrap the handler in `withProof`:

```ts
import { proofShape, withProof, toolResult } from "@framework/mcp-shared";
import { z } from "zod";

server.tool(
  "pipeline_mark_stage_complete",
  "Record a lifecycle stage as complete. Requires completion proof.",
  {
    stage_id: z.string().min(1),
    ...proofShape,          // adds a required `proof` object to the schema
  },
  withProof(async ({ stage_id }) => {
    // Only reached once proof is present and valid — no side effect on an unproven call.
    await recordStageComplete(stage_id);
    return toolResult(`stage ${stage_id} recorded complete`);
  }),
);
```

The `proof` envelope (the completion triple, plus an optional durable pointer):

| Field | Type | Rule |
|---|---|---|
| `triggered` | string (≥3, trimmed) | the real input/command that exercised the change |
| `observed` | string (≥3, trimmed) | the output/side-effect actually seen |
| `matches_intent` | boolean | must be **exactly `true`** to record completion |
| `evidence_ref` | string (optional) | durable pointer: commit SHA, URL, DB id, log path |

`matches_intent: false` is a refusal **by design** — a completion recorder must not
record a result that did not match intent. Fix it first, or report the gap through a
different (non-completion) path.

## What this gate checks

- **The rule** (RED/GREEN, zero-dep mirror of `evaluateProof`): missing / null /
  non-object / empty-`triggered` / empty-`observed` / `matches_intent` not-exactly-true
  all refuse; a complete matching envelope passes.
- **Adoption + wiring** (static scan of the runtime helper): the module exists, exports
  the full contract (`PROOF_FIELDS`, `proofObject`, `proofShape`, `evaluateProof`,
  `proofRefusal`, `withProof`), builds its refusal from the shared `isError` result,
  bases the envelope on a zod schema, refuses before calling the inner handler, and is
  re-exported from the package index.
- **Drift guard**: the helper's `PROOF_FIELDS` must equal the rule's field triple — so
  the runtime and the harnessed rule can never silently diverge.

## What it deliberately does NOT do

Honesty is the point — the same posture as the [`completion-audit`](../completion-audit/)
Stop hook:

- **No verification that the proof is true.** The server forces the agent to *produce
  and record* the evidence triple; it cannot know a request was ever made.
  `observed: "200 OK"` is accepted whether or not it happened. This is a forcing
  function for attestation and an audit trail, **not** a truth oracle — judging whether
  the proof is real stays with review.
- **No automatic adoption.** This gate proves the helper is *available and intact*; it
  does not force any given server to wrap a given tool. Which tools are state-changing
  enough to require proof is an authoring decision (see the wiring example). A future
  revision can add a per-server manifest of "these tools must be proof-gated" and check
  it here.
- **No opinion on read-only tools.** Proof params are for tools that *change state or
  record completion*. Wrapping a read-only query in `withProof` would be noise.

## Verify

```bash
node framework/standards/mcp-proof-params/validate.mjs   # rule + adoption scan
node framework/primitives/_lib/validate.mjs --all         # full harness
npm --prefix framework/runtime/mcp-shared test            # runtime behavior (vitest)
bash framework/runtime/verify-zone-purity.sh              # zero instance coupling
```

> Last reviewed: 2026-07-14
