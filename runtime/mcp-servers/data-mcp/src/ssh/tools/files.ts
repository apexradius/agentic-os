/**
 * SSH File transfer tools — ssh_upload, ssh_download, ssh_sync
 */

import { execFile } from 'node:child_process';
import { toolError, toolResult } from '@framework/mcp-shared';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SSHClient } from '../client.js';
import type { ServerConfig } from '../pool.js';
import { rejectTraversalPath, resolveServer, shellEscape } from './safety.js';

interface LocalCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runLocalCommand(
  command: string,
  args: string[],
  timeout = 300_000,
): Promise<LocalCommandResult> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout, maxBuffer: 2 * 1024 * 1024 }, (error, stdout, stderr) => {
      const code =
        error && typeof (error as { code?: unknown }).code === 'number'
          ? (error as { code: number }).code
          : error
            ? 1
            : 0;
      resolve({ stdout, stderr, exitCode: code });
    });
  });
}

function parseRsyncOptions(options?: string): string[] {
  if (!options?.trim()) return [];
  const parts = options.trim().split(/\s+/);
  for (const part of parts) {
    if (!part.startsWith('-') || /[\0\r\n;&|`$<>]/.test(part)) {
      throw new Error(`Unsupported rsync option: ${part}`);
    }
  }
  return parts;
}

function isRemoteEndpoint(value: string): boolean {
  return /^[^@\s:]+@[^:\s]+:.+/.test(value);
}

function normalizeEndpoint(value: string, config?: ServerConfig): string {
  if (!value.startsWith('remote:')) return value;
  if (!config) throw new Error('remote: paths require server_id');
  return `${config.username}@${config.host}:${value.slice('remote:'.length)}`;
}

function sshTransport(config?: ServerConfig): string | undefined {
  if (!config) return undefined;
  const parts = [
    'ssh',
    '-p',
    shellEscape(String(config.port)),
    '-l',
    shellEscape(config.username),
    '-o',
    shellEscape('BatchMode=yes'),
  ];
  if (config.privateKeyPath) {
    parts.push('-i', shellEscape(config.privateKeyPath));
  }
  return parts.join(' ');
}

export function registerFileTools(
  server: McpServer,
  ssh: SSHClient,
  servers: Map<string, ServerConfig>,
): void {
  server.tool(
    'ssh_upload',
    'Upload a local file to a remote server via SFTP',
    {
      local_path: z.string().min(1).describe('Local file path'),
      remote_path: z.string().min(1).describe('Remote destination path'),
      server_id: z.string().optional().describe('Server alias'),
    },
    async ({ local_path, remote_path, server_id }) => {
      try {
        const localError = rejectTraversalPath(local_path, 'local_path');
        if (localError) return toolError(localError);
        const remoteError = rejectTraversalPath(remote_path, 'remote_path');
        if (remoteError) return toolError(remoteError);
        const { config, error } = resolveServer(servers, server_id);
        if (error) return toolError(error);
        await ssh.upload(local_path, remote_path, { server: config });
        return toolResult(`Uploaded ${local_path} → ${remote_path}`);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ssh_download',
    'Download a remote file to local filesystem via SFTP',
    {
      remote_path: z.string().min(1).describe('Remote file path'),
      local_path: z.string().min(1).describe('Local destination path'),
      server_id: z.string().optional().describe('Server alias'),
    },
    async ({ remote_path, local_path, server_id }) => {
      try {
        const remoteError = rejectTraversalPath(remote_path, 'remote_path');
        if (remoteError) return toolError(remoteError);
        const localError = rejectTraversalPath(local_path, 'local_path');
        if (localError) return toolError(localError);
        const { config, error } = resolveServer(servers, server_id);
        if (error) return toolError(error);
        await ssh.download(remote_path, local_path, { server: config });
        return toolResult(`Downloaded ${remote_path} → ${local_path}`);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ssh_sync',
    'Sync files between local and remote using rsync over SSH',
    {
      source: z.string().min(1).describe('Source path (local or remote user@host:path)'),
      destination: z.string().min(1).describe('Destination path'),
      options: z
        .string()
        .optional()
        .describe('Extra rsync flags (e.g. "--delete --exclude=node_modules")'),
      server_id: z.string().optional().describe('Server alias for remote paths'),
      dry_run: z.boolean().optional().describe('Show what would be transferred without doing it'),
    },
    async ({ source, destination, options, server_id, dry_run }) => {
      try {
        const sourceError = rejectTraversalPath(source, 'source');
        if (sourceError) return toolError(sourceError);
        const destinationError = rejectTraversalPath(destination, 'destination');
        if (destinationError) return toolError(destinationError);

        const { config, error } = resolveServer(servers, server_id);
        if (error) return toolError(error);

        const normalizedSource = normalizeEndpoint(source, config);
        const normalizedDestination = normalizeEndpoint(destination, config);
        const remoteCount = [normalizedSource, normalizedDestination].filter(
          isRemoteEndpoint,
        ).length;
        if (remoteCount > 1) {
          return toolError('ssh_sync supports one remote endpoint per sync');
        }
        if (config && remoteCount === 0) {
          return toolError(
            'ssh_sync with server_id requires one path to use remote:/path or user@host:/path',
          );
        }

        const args = ['-az', ...parseRsyncOptions(options), ...(dry_run ? ['-n'] : [])];
        const transport = sshTransport(config);
        if (transport) args.push('-e', transport);
        args.push('--', normalizedSource, normalizedDestination);

        const result = await runLocalCommand('rsync', args);
        return result.exitCode === 0
          ? toolResult(result.stdout || 'Sync completed.')
          : toolError(`Sync failed (exit ${result.exitCode}): ${result.stderr}`);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
