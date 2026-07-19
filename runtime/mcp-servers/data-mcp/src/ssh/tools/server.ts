/**
 * SSH Server management tools — ssh_list_servers, ssh_connection_status, ssh_health_check,
 * ssh_service_status, ssh_alias, ssh_key_manage, ssh_group_manage, ssh_profile,
 * ssh_process_manager, ssh_history, ssh_deploy
 */

import { toolError, toolResult } from '@framework/mcp-shared';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SSHClient } from '../client.js';
import type { ServerConfig, SSHPool } from '../pool.js';
import { resolveServer, shellEscape, validateGitBranch } from './safety.js';

const serverProfiles = new Map<string, Record<string, string>>();
const serverGroups = new Map<string, string[]>();
const commandHistory: Array<{
  server: string;
  command: string;
  timestamp: string;
  exitCode: number;
}> = [];
const MAX_HISTORY = 100;

export function recordHistory(server: string, command: string, exitCode: number): void {
  commandHistory.unshift({
    server,
    command,
    timestamp: new Date().toISOString(),
    exitCode,
  });
  if (commandHistory.length > MAX_HISTORY) commandHistory.pop();
}

export function registerServerTools(
  server: McpServer,
  ssh: SSHClient,
  pool: SSHPool,
  servers: Map<string, ServerConfig>,
): void {
  server.tool('ssh_list_servers', 'List all configured SSH servers', {}, async () => {
    try {
      if (servers.size === 0) return toolResult('No servers configured.');
      const lines = [...servers.entries()].map(
        ([id, c]) => `  ${id}: ${c.username}@${c.host}:${c.port}${c.alias ? ` (${c.alias})` : ''}`,
      );
      return toolResult(`Configured servers (${servers.size}):\n${lines.join('\n')}`);
    } catch (e) {
      return toolError(e);
    }
  });

  server.tool(
    'ssh_connection_status',
    'Check connection status for all pooled SSH connections',
    {},
    async () => {
      try {
        const status = pool.status();
        if (status.connections.length === 0) return toolResult('No active connections.');
        const lines = status.connections.map(
          (c) =>
            `  ${c.server}: ${c.connected ? 'connected' : 'disconnected'} (idle ${Math.round(c.idleMs / 1000)}s)`,
        );
        return toolResult(`SSH Pool (${status.active} active):\n${lines.join('\n')}`);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ssh_health_check',
    'Run health checks on a remote server (disk, memory, load, uptime)',
    {
      server_id: z.string().optional().describe('Server alias'),
    },
    async ({ server_id }) => {
      try {
        const { config, error } = resolveServer(servers, server_id);
        if (error) return toolError(error);
        const checks = await Promise.all([
          ssh.exec('uptime', { server: config }),
          ssh.exec('free -h', { server: config }),
          ssh.exec('df -h /', { server: config }),
          ssh.exec('cat /proc/loadavg', { server: config }),
        ]);
        const [uptime, memory, disk, load] = checks;
        return toolResult(
          [
            `=== Health Check: ${server_id ?? 'default'} ===`,
            `Uptime: ${uptime.stdout.trim()}`,
            `\nMemory:\n${memory.stdout}`,
            `Disk:\n${disk.stdout}`,
            `Load: ${load.stdout.trim()}`,
          ].join('\n'),
        );
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ssh_service_status',
    'Check the status of a systemd service on a remote server',
    {
      service: z.string().min(1).describe('Service name (e.g. nginx, postgresql, docker)'),
      server_id: z.string().optional().describe('Server alias'),
    },
    async ({ service, server_id }) => {
      try {
        const { config, error } = resolveServer(servers, server_id);
        if (error) return toolError(error);
        if (!/^[A-Za-z0-9_.@:-]+$/.test(service))
          return toolError('service contains unsupported characters');
        const result = await ssh.exec(`systemctl status ${shellEscape(service)} --no-pager -l`, {
          server: config,
        });
        return toolResult(result.stdout || result.stderr);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ssh_alias',
    'Create or manage server aliases',
    {
      action: z.enum(['set', 'list', 'delete']),
      alias: z.string().optional().describe('Alias name'),
      host: z.string().optional(),
      port: z.number().optional(),
      username: z.string().optional(),
      key_path: z.string().optional(),
    },
    async ({ action, alias, host, port, username, key_path }) => {
      try {
        if (action === 'list') {
          const lines = [...servers.entries()].map(
            ([id, c]) => `  ${id}: ${c.username}@${c.host}:${c.port}`,
          );
          return toolResult(lines.length ? lines.join('\n') : 'No aliases.');
        }
        if (!alias) return toolError('alias is required');
        if (action === 'delete') {
          servers.delete(alias);
          return toolResult(`Deleted alias: ${alias}`);
        }
        if (!host || !username) return toolError('host and username required for set');
        servers.set(alias, {
          host,
          port: port ?? 22,
          username,
          privateKeyPath: key_path,
        });
        return toolResult(`Alias set: ${alias} → ${username}@${host}:${port ?? 22}`);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ssh_key_manage',
    'Manage SSH keys on a remote server (list, add authorized key)',
    {
      action: z.enum(['list', 'add']).describe("'list' authorized keys or 'add' a new one"),
      public_key: z.string().optional().describe('Public key to add (required for add)'),
      server_id: z.string().optional(),
    },
    async ({ action, public_key, server_id }) => {
      try {
        const { config, error } = resolveServer(servers, server_id);
        if (error) return toolError(error);
        if (action === 'list') {
          const result = await ssh.exec(
            'cat ~/.ssh/authorized_keys 2>/dev/null || echo "No authorized_keys file"',
            { server: config },
          );
          return toolResult(result.stdout);
        }
        if (!public_key) return toolError('public_key required for add');
        const result = await ssh.exec(
          `mkdir -p ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && printf '%s\\n' ${shellEscape(public_key)} >> ~/.ssh/authorized_keys`,
          { server: config },
        );
        return result.exitCode === 0 ? toolResult('Key added.') : toolError(result.stderr);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ssh_group_manage',
    'Manage server groups for batch operations',
    {
      action: z.enum(['create', 'list', 'delete', 'add_server', 'remove_server']),
      group: z.string().optional().describe('Group name'),
      server_id: z.string().optional().describe('Server alias to add/remove'),
    },
    async ({ action, group, server_id }) => {
      try {
        if (action === 'list') {
          if (serverGroups.size === 0) return toolResult('No groups.');
          const lines = [...serverGroups.entries()].map(
            ([g, ids]) => `  ${g}: [${ids.join(', ')}]`,
          );
          return toolResult(lines.join('\n'));
        }
        if (!group) return toolError('group name required');
        if (action === 'create') {
          serverGroups.set(group, []);
          return toolResult(`Group created: ${group}`);
        }
        if (action === 'delete') {
          serverGroups.delete(group);
          return toolResult(`Group deleted: ${group}`);
        }
        const members = serverGroups.get(group);
        if (!members) return toolError(`Group not found: ${group}`);
        if (!server_id) return toolError('server_id required');
        if (action === 'add_server') {
          members.push(server_id);
          return toolResult(`Added ${server_id} to ${group}`);
        }
        if (action === 'remove_server') {
          const idx = members.indexOf(server_id);
          if (idx >= 0) members.splice(idx, 1);
          return toolResult(`Removed ${server_id} from ${group}`);
        }
        return toolError('Invalid action');
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ssh_profile',
    'View or set server profile metadata (tags, notes, env)',
    {
      server_id: z.string().describe('Server alias'),
      action: z.enum(['get', 'set']),
      key: z.string().optional(),
      value: z.string().optional(),
    },
    async ({ server_id, action, key, value }) => {
      try {
        if (action === 'get') {
          const profile = serverProfiles.get(server_id);
          if (!profile) return toolResult(`No profile for ${server_id}`);
          return toolResult(JSON.stringify(profile, null, 2));
        }
        if (!key) return toolError('key required for set');
        const profile = serverProfiles.get(server_id) ?? {};
        profile[key] = value ?? '';
        serverProfiles.set(server_id, profile);
        return toolResult(`Set ${server_id}.${key} = ${value}`);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ssh_process_manager',
    'List, find, or kill processes on a remote server',
    {
      action: z.enum(['list', 'find', 'kill']).describe('list all, find by name, or kill by PID'),
      query: z.string().optional().describe('Process name pattern (for find) or PID (for kill)'),
      signal: z.string().optional().describe('Signal for kill (default: TERM)'),
      server_id: z.string().optional(),
    },
    async ({ action, query, signal, server_id }) => {
      try {
        const { config, error } = resolveServer(servers, server_id);
        if (error) return toolError(error);
        if (action === 'list') {
          const r = await ssh.exec('ps aux --sort=-%mem | head -30', {
            server: config,
          });
          return toolResult(r.stdout);
        }
        if (!query) return toolError('query required for find/kill');
        if (action === 'find') {
          const r = await ssh.exec(`pgrep -la -- ${shellEscape(query)}`, {
            server: config,
          });
          return toolResult(r.stdout || 'No matching processes.');
        }
        const sig = signal ?? 'TERM';
        if (!/^[A-Z0-9]+$/i.test(sig)) return toolError('signal contains unsupported characters');
        if (!/^[0-9]+$/.test(query)) return toolError('kill requires a numeric PID');
        const r = await ssh.exec(`kill -${sig} ${query}`, { server: config });
        return r.exitCode === 0 ? toolResult(`Sent ${sig} to PID ${query}`) : toolError(r.stderr);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ssh_history',
    'View SSH command execution history',
    {
      limit: z.number().optional().describe('Number of entries to show (default: 20)'),
    },
    async ({ limit = 20 }) => {
      try {
        const entries = commandHistory.slice(0, limit);
        if (entries.length === 0) return toolResult('No command history.');
        const lines = entries.map(
          (e) => `[${e.timestamp}] ${e.server} (exit ${e.exitCode}): ${e.command.slice(0, 100)}`,
        );
        return toolResult(lines.join('\n'));
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ssh_deploy',
    'Deploy an application on a remote server (git pull + restart)',
    {
      server_id: z.string().optional().describe('Server alias'),
      path: z.string().describe('Application directory path on the server'),
      branch: z.string().optional().describe('Git branch to deploy (default: main)'),
      restart_command: z
        .string()
        .optional()
        .describe(
          'Trusted remote shell command to restart the service after deploy; intentionally unvalidated',
        ),
      pre_deploy: z
        .string()
        .optional()
        .describe(
          'Trusted remote shell command to run before deploy (e.g. backup); intentionally unvalidated',
        ),
    },
    async ({ server_id, path, branch = 'main', restart_command, pre_deploy }) => {
      try {
        const { config, error } = resolveServer(servers, server_id);
        if (error) return toolError(error);
        const branchError = validateGitBranch(branch);
        if (branchError) return toolError(branchError);
        const steps: string[] = [];

        if (pre_deploy) {
          const pre = await ssh.exec(pre_deploy, { server: config, cwd: path });
          steps.push(`Pre-deploy: exit ${pre.exitCode}`);
          if (pre.exitCode !== 0) return toolError(`Pre-deploy failed: ${pre.stderr}`);
        }

        const safeBranch = shellEscape(branch);
        const pull = await ssh.exec(
          `git fetch origin && git checkout ${safeBranch} && git pull --ff-only origin ${safeBranch}`,
          { server: config, cwd: path },
        );
        steps.push(`Git pull: exit ${pull.exitCode}`);
        if (pull.exitCode !== 0) return toolError(`Git pull failed: ${pull.stderr}`);
        steps.push(pull.stdout.trim());

        if (restart_command) {
          const restart = await ssh.exec(restart_command, {
            server: config,
            cwd: path,
          });
          steps.push(`Restart: exit ${restart.exitCode}`);
          if (restart.stdout) steps.push(restart.stdout.trim());
        }

        return toolResult(`Deploy completed:\n${steps.join('\n')}`);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
