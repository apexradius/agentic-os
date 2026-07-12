#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const timeoutMs = 30_000;

function redact(value) {
  return String(value)
    .replace(/userToken=[^&\s]+/gi, 'userToken=<redacted>')
    .replace(/([?&](?:token|key|secret)=)[^&\s]+/gi, '$1<redacted>')
    .replace(/https?:\/\/\S+/gi, '<remote-url>');
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [join(packageRoot, 'dist/index.js')],
  cwd: packageRoot,
  stderr: 'pipe',
});
const client = new Client(
  { name: 'apex-penpot-live-smoke', version: '1.0.0' },
  { capabilities: {} },
);

let stderr = '';
transport.stderr?.on('data', (chunk) => {
  stderr += redact(chunk);
});

let timeout;
try {
  const proof = await Promise.race([
    (async () => {
      await client.connect(transport);
      const { tools } = await client.listTools();
      if (!tools.some(({ name }) => name === 'high_level_overview')) {
        throw new Error('read-only high_level_overview tool is not advertised');
      }

      const result = await client.callTool({ name: 'high_level_overview', arguments: {} });
      const body = (result.content ?? [])
        .filter(({ type }) => type === 'text')
        .map(({ text }) => text)
        .join('\n');

      if (result.isError === true || body.length === 0) {
        throw new Error('read-only high_level_overview call returned no usable content');
      }

      return {
        initialized: true,
        toolCount: tools.length,
        toolNames: tools.map(({ name }) => name).sort(),
        readOnlyTool: 'high_level_overview',
        responseBytes: Buffer.byteLength(body),
        responseSha256: createHash('sha256').update(body).digest('hex'),
      };
    })(),
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);

  process.stdout.write(`${JSON.stringify(proof)}\n`);
} catch (error) {
  process.stderr.write(`penpot-smoke: ${redact(error instanceof Error ? error.message : error)}\n`);
  if (stderr.trim()) {
    process.stderr.write(`penpot-smoke upstream: ${stderr.trim()}\n`);
  }
  process.exitCode = 1;
} finally {
  if (timeout) {
    clearTimeout(timeout);
  }
  await client.close().catch(() => {});
}
