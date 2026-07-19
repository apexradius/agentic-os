/**
 * Proof params — the MCP-substrate half of the ownership standard's
 * "self-reported done is not enough".
 *
 * A state-changing / completion-recording MCP tool that spreads `proofShape`
 * into its input schema and wraps its handler in `withProof` cannot be invoked
 * to record a result without the caller attaching what it TRIGGERED, what it
 * OBSERVED, and a confirmation the observation matched intent. The server
 * refuses the call otherwise — and because the refusal lives in the tool, it
 * governs EVERY surface that calls the tool (Claude Code, Claude Desktop, any
 * MCP client) identically, not just the ones that can run a hook. This is the
 * only enforcement plane that reaches a hookless surface.
 *
 * Honest limit: this forces the agent to PRODUCE and RECORD the evidence
 * triple; it cannot verify the evidence is TRUE. `observed: "200 OK"` is
 * accepted whether or not a request was ever made. It is a forcing function for
 * attestation plus an audit trail, not a truth oracle — judging whether the
 * proof is real stays with review, exactly as the completion-audit Stop hook
 * documents for its own gate.
 */
import { z } from 'zod';
import { type ToolResult, type ToolTextResult, toolError } from '../results/index.js';

/**
 * Canonical proof field names — the single source the `mcp-proof-params`
 * standard's zero-dep selftest re-parses to catch drift between this runtime
 * helper and the rule its harness proves.
 */
export const PROOF_FIELDS = ['triggered', 'observed', 'matches_intent'] as const;

/** Zod object schema for the proof envelope. */
export const proofObject = z.object({
  triggered: z
    .string()
    .trim()
    .min(3)
    .describe('The real input or command that exercised the change (what you actually ran).'),
  observed: z
    .string()
    .trim()
    .min(3)
    .describe(
      'The output or side-effect you actually saw (logs, response body, a row, an endpoint).',
    ),
  matches_intent: z
    .boolean()
    .describe('True only if the observed output matched the intended behavior.'),
  evidence_ref: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Optional durable pointer: commit SHA, URL, DB id, or log path.'),
});

export type Proof = z.infer<typeof proofObject>;

/**
 * Zod raw-shape fragment. Spread into a state-changing tool's input schema:
 *
 *   server.tool(name, desc, { ...yourParams, ...proofShape }, withProof(handler));
 */
export const proofShape = { proof: proofObject } as const;

export interface ProofVerdict {
  ok: boolean;
  reason?: string;
}

/**
 * Pure decision: is this proof envelope acceptable? This is the rule the
 * standard's zero-dep selftest mirrors. Kept dependency-free (no zod) so the
 * business rule — not just the type — is the thing under test.
 */
export function evaluateProof(proof: unknown): ProofVerdict {
  if (proof == null || typeof proof !== 'object') {
    return {
      ok: false,
      reason: 'missing proof: attach a proof object with triggered, observed, and matches_intent.',
    };
  }
  const p = proof as Record<string, unknown>;
  const triggered = typeof p.triggered === 'string' ? p.triggered.trim() : '';
  const observed = typeof p.observed === 'string' ? p.observed.trim() : '';
  if (triggered.length < 3) {
    return {
      ok: false,
      reason: 'proof.triggered is empty: state what real input exercised the change.',
    };
  }
  if (observed.length < 3) {
    return {
      ok: false,
      reason: 'proof.observed is empty: state the output or side-effect you actually saw.',
    };
  }
  if (p.matches_intent !== true) {
    return {
      ok: false,
      reason:
        'proof.matches_intent is not true: do not record completion when the observed output did not ' +
        'match intent — fix it first, or report the gap instead of recording done.',
    };
  }
  return { ok: true };
}

/** Structured refusal result (isError) fed back to the caller. */
export function proofRefusal(reason: string): ToolTextResult {
  return toolError(
    new Error(
      `Refused — completion proof required (ownership standard). ${reason} ` +
        'A state-changing result is not recorded on self-report; attach ' +
        'proof = { triggered, observed, matches_intent }.',
    ),
  );
}

type ToolHandler<A> = (args: A) => Promise<ToolResult> | ToolResult;

/**
 * Wrap a state-changing tool handler so it refuses to run without valid proof.
 * The wrapped handler expects `args.proof`; on an invalid envelope it returns a
 * `proofRefusal` and NEVER calls the inner handler — so no side effect can occur
 * on an unproven call. `matches_intent: false` is a refusal by design: a
 * completion recorder must not record a result that did not match intent.
 */
export function withProof<A extends { proof?: unknown }>(handler: ToolHandler<A>): ToolHandler<A> {
  return (args: A) => {
    const verdict = evaluateProof(args?.proof);
    if (!verdict.ok) return proofRefusal(verdict.reason ?? 'invalid proof.');
    return handler(args);
  };
}
