import { createHash, randomBytes } from 'node:crypto';

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
  method: 'S256';
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generatePkce(): PkcePair {
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(createHash('sha256').update(codeVerifier).digest());
  return { codeVerifier, codeChallenge, method: 'S256' };
}

export function generateState(): string {
  return base64url(randomBytes(16));
}
