/**
 * SSH Session tools — ssh_session_start, ssh_session_send, ssh_session_list, ssh_session_close
 *
 * Persistent interactive sessions that survive across tool calls.
 */

import { log, toolError, toolResult } from '@framework/mcp-shared';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SSHClient } from '../client.js';
import type { ServerConfig } from '../pool.js';
import { resolveServer } from './safety.js';

const MCP = 'apex-data-mcp';

interface Session {
  id: string;
  serverId: string;
  outputBuffer: string;
  createdAt: string;
  lastActivity: string;
}

const sessions = new Map<string, Session>();
let sessionCounter = 0;

export function registerSessionTools(
  server: McpServer,
  ssh: SSHClient,
  servers: Map<string, ServerConfig>,
): void {
  server.tool(
    'ssh_session_start',
    'Start a new persistent SSH session',
    {
      server_id: z.string().optional().describe('Server alias'),
      name: z.string().optional().describe('Session name (auto-generated if omitted)'),
    },
    async ({ server_id, name }) => {
      try {
        const id = name ?? `session-${++sessionCounter}`;
        const now = new Date().toISOString();
        sessions.set(id, {
          id,
          serverId: server_id ?? 'default',
          outputBuffer: '',
          createdAt: now,
          lastActivity: now,
        });
        log.info(
          MCP,
          'ssh',
          'session_start',
          `Session ${id} started for ${server_id ?? 'default'}`,
        );
        return toolResult(`Session started: ${id}`);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ssh_session_send',
    'Send a command to a persistent SSH session and get output',
    {
      session_id: z.string().min(1).describe('Session ID'),
      command: z.string().min(1).describe('Command to execute'),
      timeout: z.number().optional().describe('Timeout in ms (default: 120000)'),
    },
    async ({ session_id, command, timeout }) => {
      try {
        const session = sessions.get(session_id);
        if (!session) return toolError(`Session not found: ${session_id}`);

        const { config, error } = resolveServer(
          servers,
          session.serverId === 'default' ? undefined : session.serverId,
        );
        if (error) return toolError(error);
        const result = await ssh.exec(command, { timeout, server: config });

        session.lastActivity = new Date().toISOString();
        session.outputBuffer += `\n$ ${command}\n${result.stdout}`;
        if (session.outputBuffer.length > 50_000) {
          session.outputBuffer = `[buffer truncated - oldest output removed]\n${session.outputBuffer.slice(-30_000)}`;
        }

        const output = [
          result.stdout ? result.stdout : '',
          result.stderr ? `STDERR: ${result.stderr}` : '',
          `Exit: ${result.exitCode}`,
        ]
          .filter(Boolean)
          .join('\n');

        return result.exitCode === 0 ? toolResult(output) : toolError(output);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool('ssh_session_list', 'List all active SSH sessions', {}, async () => {
    try {
      if (sessions.size === 0) return toolResult('No active sessions.');
      const lines = [...sessions.values()].map(
        (s) => `  ${s.id}: server=${s.serverId}, created=${s.createdAt}, last=${s.lastActivity}`,
      );
      return toolResult(`Active sessions (${sessions.size}):\n${lines.join('\n')}`);
    } catch (e) {
      return toolError(e);
    }
  });

  server.tool(
    'ssh_session_close',
    'Close a persistent SSH session',
    {
      session_id: z.string().min(1).describe('Session ID to close'),
    },
    async ({ session_id }) => {
      try {
        if (!sessions.has(session_id)) return toolError(`Session not found: ${session_id}`);
        sessions.delete(session_id);
        return toolResult(`Session closed: ${session_id}`);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
