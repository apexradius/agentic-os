#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const DEFAULT_SERVER_URL = 'https://design.penpot.app/mcp/stream';
const TOKEN_SERVICE = 'apex.penpot.mcp.userToken';
const URL_SERVICE = 'apex.penpot.mcp.serverUrl';

function readKeychain(service: string): string | undefined {
  try {
    return execFileSync(
      '/usr/bin/security',
      ['find-generic-password', '-a', process.env.USER ?? '', '-s', service, '-w'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ).trim();
  } catch {
    return undefined;
  }
}

function withoutUserToken(rawUrl: string): { url: URL; token?: string } {
  const url = new URL(rawUrl);
  const token = url.searchParams.get('userToken') ?? undefined;
  url.searchParams.delete('userToken');
  return { url, token };
}

function resolveRemoteUrl(): string {
  const exactUrl = process.env.PENPOT_MCP_REMOTE_URL?.trim();
  if (exactUrl) {
    return exactUrl;
  }

  const configuredUrl =
    process.env.PENPOT_MCP_SERVER_URL?.trim() ?? readKeychain(URL_SERVICE) ?? DEFAULT_SERVER_URL;
  const { url, token: urlToken } = withoutUserToken(configuredUrl);
  const token =
    process.env.PENPOT_MCP_USER_TOKEN?.trim() ?? readKeychain(TOKEN_SERVICE) ?? urlToken;

  if (!token) {
    throw new Error(
      'Penpot MCP key not found. Store it with apex/config/mcp/penpot/capture-penpot-mcp-key.applescript or set PENPOT_MCP_USER_TOKEN.',
    );
  }

  url.searchParams.set('userToken', token);
  return url.toString();
}

try {
  const remoteUrl = resolveRemoteUrl();
  process.argv = [process.execPath, 'mcp-remote', remoteUrl];
  await import('mcp-remote/dist/proxy.js');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `penpot-mcp: ${message.replace(/userToken=[^&\s]+/g, 'userToken=<redacted>')}\n`,
  );
  process.exit(1);
}
