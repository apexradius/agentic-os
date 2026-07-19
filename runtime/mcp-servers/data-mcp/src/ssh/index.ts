/**
 * SSH module index - initializes the connection pool, client, and registers all SSH tools.
 */

import { log } from '@framework/mcp-shared';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSHClient } from './client.js';
import { type ServerConfig, SSHPool } from './pool.js';
import { registerBackupTools } from './tools/backup.js';
import { registerDatabaseTools } from './tools/database.js';
import { registerExecutionTools } from './tools/execution.js';
import { registerFileTools } from './tools/files.js';
import { registerMonitoringTools } from './tools/monitoring.js';
import { registerServerTools } from './tools/server.js';
import { registerSessionTools } from './tools/sessions.js';
import { closeAllTunnels, registerTunnelTools } from './tools/tunnels.js';

const MCP = 'apex-data-mcp';

export interface SSHConfig {
  host: string;
  port: number;
  user: string;
  keyPath?: string;
  password?: string;
  extraServers?: Record<
    string,
    {
      host: string;
      port?: number;
      user: string;
      keyPath?: string;
      password?: string;
    }
  >;
}

export interface SSHModule {
  pool: SSHPool;
  client: SSHClient;
  shutdown(): Promise<void>;
}

/**
 * Initialize the SSH subsystem and register all SSH tools on the MCP server.
 */
export function initSSH(server: McpServer, config: SSHConfig): SSHModule {
  const pool = new SSHPool();

  const defaultServer: ServerConfig = {
    host: config.host,
    port: config.port,
    username: config.user,
    privateKeyPath: config.keyPath,
    password: config.password,
    alias: 'vps',
  };

  const servers = new Map<string, ServerConfig>();
  servers.set('vps', defaultServer);

  // Register extra servers (e.g. staging or storage hosts) from config
  if (config.extraServers) {
    for (const [alias, srv] of Object.entries(config.extraServers)) {
      servers.set(alias, {
        host: srv.host,
        port: srv.port ?? 22,
        username: srv.user,
        privateKeyPath: srv.keyPath,
        password: srv.password,
        alias,
      });
      log.info(MCP, 'ssh', 'init', `Registered extra server: ${alias} (${srv.host})`);
    }
  }

  const client = new SSHClient(pool, defaultServer);

  // Register all tool groups
  registerExecutionTools(server, client, servers); // 4 tools
  registerSessionTools(server, client, servers); // 4 tools
  registerTunnelTools(server, pool, servers); // 3 tools
  registerFileTools(server, client, servers); // 3 tools
  registerDatabaseTools(server, client, servers); // 4 tools
  registerBackupTools(server, client, servers); // 4 tools
  registerMonitoringTools(server, client, servers); // 3 tools
  registerServerTools(server, client, pool, servers); // 11 tools

  log.info(MCP, 'ssh', 'init', 'Registered 36 SSH tools');

  return {
    pool,
    client,
    async shutdown() {
      closeAllTunnels();
      await pool.shutdown();
    },
  };
}

export { SSHClient } from './client.js';
export { type ServerConfig, SSHPool } from './pool.js';
