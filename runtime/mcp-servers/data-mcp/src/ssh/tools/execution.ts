/**
 * SSH Execution tools — ssh_execute, ssh_execute_sudo, ssh_execute_group, ssh_command_alias
 */

import { toolError, toolResult } from '@framework/mcp-shared';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SSHClient } from '../client.js';
import type { ServerConfig } from '../pool.js';
import { resolveServer } from './safety.js';
import { recordHistory } from './server.js';

const commandAliases = new Map<string, string>();

export function registerExecutionTools(
  server: McpServer,
  ssh: SSHClient,
  servers: Map<string, ServerConfig>,
): void {
  server.tool(
    'ssh_execute',
    'Execute a command on a remote server via SSH',
    {
      command: z.string().min(1).describe('Shell command to execute'),
      server_id: z.string().optional().describe('Server alias (default: primary server)'),
      timeout: z.number().optional().describe('Timeout in ms (default: 120000)'),
      cwd: z.string().optional().describe('Working directory on remote server'),
    },
    async ({ command, server_id, timeout, cwd }) => {
      try {
        const { config, label, error } = resolveServer(servers, server_id);
        if (error) return toolError(error);
        const resolved = commandAliases.get(command) ?? command;
        const result = await ssh.exec(resolved, {
          timeout,
          cwd,
          server: config,
        });
        recordHistory(label, resolved, result.exitCode);
        const output = [
          result.stdout ? `STDOUT:\n${result.stdout}` : '',
          result.stderr ? `STDERR:\n${result.stderr}` : '',
          `Exit code: ${result.exitCode}`,
        ]
          .filter(Boolean)
          .join('\n\n');
        return result.exitCode === 0 ? toolResult(output) : toolError(output);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ssh_execute_sudo',
    'Execute a command with sudo on a remote server',
    {
      command: z.string().min(1).describe('Command to execute with sudo'),
      server_id: z.string().optional().describe('Server alias'),
      timeout: z.number().optional().describe('Timeout in ms'),
    },
    async ({ command, server_id, timeout }) => {
      try {
        const { config, label, error } = resolveServer(servers, server_id);
        if (error) return toolError(error);
        const result = await ssh.execSudo(command, { timeout, server: config });
        recordHistory(label, `sudo ${command}`, result.exitCode);
        const output = [
          result.stdout ? `STDOUT:\n${result.stdout}` : '',
          result.stderr ? `STDERR:\n${result.stderr}` : '',
          `Exit code: ${result.exitCode}`,
        ]
          .filter(Boolean)
          .join('\n\n');
        return result.exitCode === 0 ? toolResult(output) : toolError(output);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ssh_execute_group',
    'Execute a command on multiple servers simultaneously',
    {
      command: z.string().min(1).describe('Command to execute on all servers'),
      server_ids: z.array(z.string()).min(1).describe('List of server aliases'),
      timeout: z.number().optional().describe('Timeout in ms per server'),
    },
    async ({ command, server_ids, timeout }) => {
      try {
        const results = await Promise.allSettled(
          server_ids.map(async (id) => {
            const config = servers.get(id);
            if (!config) return { server: id, error: `Unknown server: ${id}` };
            const result = await ssh.exec(command, { timeout, server: config });
            recordHistory(id, command, result.exitCode);
            return { server: id, ...result };
          }),
        );

        const lines = results.map((r, i) => {
          if (r.status === 'rejected') return `[${server_ids[i]}] ERROR: ${r.reason}`;
          const val = r.value as {
            server: string;
            stdout?: string;
            stderr?: string;
            exitCode?: number;
            error?: string;
          };
          if (val.error) return `[${val.server}] ERROR: ${val.error}`;
          return `[${val.server}] Exit: ${val.exitCode}\n${val.stdout ?? ''}${val.stderr ? `\nSTDERR: ${val.stderr}` : ''}`;
        });

        return toolResult(lines.join('\n---\n'));
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ssh_command_alias',
    'Create or list command aliases for SSH execution',
    {
      action: z
        .enum(['set', 'list', 'delete'])
        .describe("'set' to create, 'list' to show all, 'delete' to remove"),
      name: z.string().optional().describe('Alias name (required for set/delete)'),
      command: z.string().optional().describe('Full command (required for set)'),
    },
    async ({ action, name, command }) => {
      try {
        if (action === 'list') {
          if (commandAliases.size === 0) return toolResult('No command aliases configured.');
          const lines = [...commandAliases.entries()].map(([k, v]) => `  ${k} → ${v}`);
          return toolResult(`Command aliases:\n${lines.join('\n')}`);
        }
        if (!name) return toolError('name is required for set/delete');
        if (action === 'set') {
          if (!command) return toolError('command is required for set');
          commandAliases.set(name, command);
          return toolResult(`Alias set: ${name} → ${command}`);
        }
        if (action === 'delete') {
          commandAliases.delete(name);
          return toolResult(`Alias deleted: ${name}`);
        }
        return toolError('Invalid action');
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
