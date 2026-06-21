#!/usr/bin/env node
/**
 * apex-canva-login — one-shot CLI to complete the Canva Connect OAuth dance.
 *
 * Usage:
 *   CANVA_CLIENT_ID=... CANVA_CLIENT_SECRET=... apex-canva-login
 *
 * Opens a browser to the Canva authorize URL, runs a local callback server on
 * 127.0.0.1:8765/callback, exchanges the auth code for tokens, and persists
 * the refresh token for the MCP server to use.
 */
import { createServer } from 'node:http';
import { exec } from 'node:child_process';
import {
  CANVA_AUTHORIZE_URL,
  DEFAULT_SCOPES,
  exchangeCodeForToken,
} from './oauth.js';
import { generatePkce, generateState } from './pkce.js';

const CALLBACK_HOST = '127.0.0.1';
const CALLBACK_PORT = 8765;
const CALLBACK_PATH = '/callback';
const REDIRECT_URI = `http://${CALLBACK_HOST}:${CALLBACK_PORT}${CALLBACK_PATH}`;

function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd =
    platform === 'darwin' ? `open "${url}"` : platform === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) {
      console.error('Failed to auto-open browser. Paste this URL into your browser:');
      console.error(url);
    }
  });
}

async function main(): Promise<void> {
  if (!process.env['CANVA_CLIENT_ID'] || !process.env['CANVA_CLIENT_SECRET']) {
    console.error('CANVA_CLIENT_ID and CANVA_CLIENT_SECRET must be set in the environment.');
    process.exit(2);
  }

  const pkce = generatePkce();
  const state = generateState();

  const authUrl = new URL(CANVA_AUTHORIZE_URL);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', process.env['CANVA_CLIENT_ID']!);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', DEFAULT_SCOPES);
  authUrl.searchParams.set('code_challenge', pkce.codeChallenge);
  authUrl.searchParams.set('code_challenge_method', pkce.method);
  authUrl.searchParams.set('state', state);

  const completed = new Promise<void>((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        if (!req.url || !req.url.startsWith(CALLBACK_PATH)) {
          res.statusCode = 404;
          res.end('not found');
          return;
        }
        const u = new URL(req.url, `http://${CALLBACK_HOST}:${CALLBACK_PORT}`);
        const code = u.searchParams.get('code');
        const returnedState = u.searchParams.get('state');
        const error = u.searchParams.get('error');

        if (error) throw new Error(`Canva returned error: ${error}`);
        if (!code) throw new Error('Missing authorization code');
        if (returnedState !== state) throw new Error('State mismatch — possible CSRF');

        const tok = await exchangeCodeForToken({
          code,
          codeVerifier: pkce.codeVerifier,
          redirectUri: REDIRECT_URI,
        });

        res.statusCode = 200;
        res.setHeader('content-type', 'text/html');
        res.end(
          '<html><body style="font-family:system-ui;padding:40px;max-width:600px"><h2>Canva authorized.</h2><p>Refresh token saved. You can close this tab.</p></body></html>',
        );

        console.log('✓ Token saved.');
        console.log(`  Scope:   ${tok.scope}`);
        console.log(`  Expires: ${new Date(tok.expiresAt).toISOString()}`);
        server.close();
        resolve();
      } catch (err) {
        res.statusCode = 500;
        res.end(`error: ${err instanceof Error ? err.message : String(err)}`);
        server.close();
        reject(err);
      }
    });
    server.listen(CALLBACK_PORT, CALLBACK_HOST, () => {
      console.log(`Listening on ${REDIRECT_URI}`);
      console.log('Opening browser…');
      openBrowser(authUrl.toString());
    });
    server.on('error', reject);
  });

  await completed;
}

main().catch((err) => {
  console.error('Login failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
