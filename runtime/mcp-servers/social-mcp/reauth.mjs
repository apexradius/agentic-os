#!/usr/bin/env node
// Reauth helper — bypasses missing `npm run setup` script.
// Adds login_hint to skip Google account chooser, and validates the
// returned email matches what was requested before saving the label.

import { OAuth2Client } from "google-auth-library";
import { oauth2 as oauth2Api } from "@googleapis/oauth2";
import http from "http";
import { URL } from "url";
import open from "open";
import { saveTokens, saveAccountConfig } from "./dist/services/gmail/token-store.js";
import { GMAIL_SCOPES, OAUTH_REDIRECT_URI, OAUTH_PORT } from "./dist/services/gmail/constants.js";
import { getGoogleOAuthConfig } from "./dist/services/gmail/auth.js";

const expectedEmail = process.argv[2];
const label = process.argv[3] ?? "personal";

if (!expectedEmail) {
  console.error("Usage: node reauth.mjs <email> <label>");
  process.exit(1);
}

const { clientId, clientSecret } = getGoogleOAuthConfig();
if (!clientId || !clientSecret) {
  console.error("Missing Google OAuth credentials.");
  console.error("Set APEX_GOOGLE_CLIENT_ID and APEX_GOOGLE_CLIENT_SECRET.");
  process.exit(1);
}

const client = new OAuth2Client(clientId, clientSecret, OAUTH_REDIRECT_URI);
const authUrl = client.generateAuthUrl({
  access_type: "offline",
  scope: GMAIL_SCOPES,
  prompt: "consent",
  login_hint: expectedEmail
});

console.error(`\n[auth] Re-authorizing: ${expectedEmail} (label: ${label})`);
console.error(`[auth] Sign in as ${expectedEmail} if prompted.\n`);

const codePromise = new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    if (!req.url) return reject(new Error("No URL"));
    const url = new URL(req.url, `http://localhost:${OAUTH_PORT}`);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    if (error) {
      res.writeHead(400);
      res.end(`<h2>Auth failed: ${error}</h2>`);
      server.close();
      return reject(new Error(`OAuth error: ${error}`));
    }
    if (code) {
      res.writeHead(200);
      res.end("<h2>Connected. You can close this tab.</h2>");
      server.close();
      resolve(code);
    }
  });
  server.listen(OAUTH_PORT);
  setTimeout(() => { server.close(); reject(new Error("Timeout")); }, 5 * 60 * 1000);
});

console.error(`[auth] URL: ${authUrl}\n`);
if (process.env.APEX_OAUTH_NO_OPEN !== "1") {
  await open(authUrl);
}
const code = await codePromise;
const { tokens } = await client.getToken(code);
if (!tokens.refresh_token) {
  console.error("\n✗ No refresh_token. Revoke at https://myaccount.google.com/permissions and retry.\n");
  process.exit(1);
}
client.setCredentials(tokens);
const { data: userInfo } = await oauth2Api({ version: "v2", auth: client }).userinfo.get();
const actualEmail = userInfo.email;

if (actualEmail !== expectedEmail) {
  console.error(`\n✗ MISMATCH: expected ${expectedEmail}, got ${actualEmail}`);
  console.error(`  Tokens NOT saved. Try again and pick the correct Google account.\n`);
  process.exit(1);
}

await saveTokens(actualEmail, {
  access_token: tokens.access_token ?? "",
  refresh_token: tokens.refresh_token,
  expiry_date: tokens.expiry_date ?? 0,
  token_type: tokens.token_type ?? "Bearer",
  scope: tokens.scope ?? GMAIL_SCOPES.join(" ")
});
await saveAccountConfig({ email: actualEmail, label, addedAt: new Date().toISOString() });

console.error(`\n✓ ${actualEmail} reauth'd with label "${label}"\n`);
process.exit(0);
