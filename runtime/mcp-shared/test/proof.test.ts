import { describe, expect, it, vi } from 'vitest';
import { evaluateProof, PROOF_FIELDS, proofShape, withProof } from '../src/proof/index.js';

const goodProof = {
  triggered: 'ran `pytest tests/test_auth.py -q`',
  observed: '3 passed in 0.42s, exit 0',
  matches_intent: true,
};

describe('evaluateProof', () => {
  it('accepts a complete, matching proof', () => {
    expect(evaluateProof(goodProof)).toEqual({ ok: true });
  });

  it('rejects a null/absent envelope', () => {
    expect(evaluateProof(undefined).ok).toBe(false);
    expect(evaluateProof(null).ok).toBe(false);
    expect(evaluateProof('nope').ok).toBe(false);
  });

  it('rejects an empty or too-short triggered', () => {
    expect(evaluateProof({ ...goodProof, triggered: '  ' }).ok).toBe(false);
    expect(evaluateProof({ ...goodProof, triggered: 'x' }).ok).toBe(false);
  });

  it('rejects an empty observed', () => {
    expect(evaluateProof({ ...goodProof, observed: '' }).ok).toBe(false);
  });

  it('rejects matches_intent that is not exactly true', () => {
    expect(evaluateProof({ ...goodProof, matches_intent: false }).ok).toBe(false);
    // truthy-but-not-true must not slip through
    expect(evaluateProof({ ...goodProof, matches_intent: 'yes' as unknown as boolean }).ok).toBe(
      false,
    );
  });

  it('names the failing field in the reason', () => {
    expect(evaluateProof({ ...goodProof, observed: '' }).reason).toMatch(/observed/);
    expect(evaluateProof({ ...goodProof, matches_intent: false }).reason).toMatch(/matches_intent/);
  });
});

describe('withProof', () => {
  it('calls the inner handler exactly once on valid proof', async () => {
    const inner = vi.fn(async () => ({ content: [{ type: 'text' as const, text: 'recorded' }] }));
    const wrapped = withProof(inner);
    const res = await wrapped({ proof: goodProof });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(res.content[0]).toMatchObject({ type: 'text', text: 'recorded' });
    expect(res.isError).toBeUndefined();
  });

  it('never invokes the inner handler on invalid proof (no side effect)', async () => {
    const inner = vi.fn(async () => ({ content: [{ type: 'text' as const, text: 'recorded' }] }));
    const wrapped = withProof(inner);
    const res = await wrapped({ proof: { ...goodProof, matches_intent: false } });
    expect(inner).not.toHaveBeenCalled();
    expect(res.isError).toBe(true);
    expect(res.content[0]).toMatchObject({ type: 'text' });
  });

  it('refuses a call with no proof at all', async () => {
    const inner = vi.fn(async () => ({ content: [{ type: 'text' as const, text: 'recorded' }] }));
    const wrapped = withProof(inner as any);
    const res = await wrapped({} as any);
    expect(inner).not.toHaveBeenCalled();
    expect(res.isError).toBe(true);
  });
});

describe('contract surface', () => {
  it('proofShape exposes exactly a `proof` key', () => {
    expect(Object.keys(proofShape)).toEqual(['proof']);
  });

  it('PROOF_FIELDS is the canonical triple', () => {
    expect([...PROOF_FIELDS]).toEqual(['triggered', 'observed', 'matches_intent']);
  });
});
