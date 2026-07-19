#!/usr/bin/env node

import {
  classifyPostgres,
  classifySSH,
  EXIT_CODES,
  log,
  registerHealthTool,
  UnifiedErrorHandler,
} from '@framework/mcp-shared';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { PgClient } from './client.js';
import { initSSH, type SSHModule } from './ssh/index.js';
import { registerExcelTools } from './tools/excel.js';
import { registerHealthTools } from './tools/health.js';
import { registerQueryTools } from './tools/query.js';
import { registerSchemaTools } from './tools/schema.js';
import type { Tunnel } from './tunnel.js';
import { openTunnel } from './tunnel.js';

const MCP_NAME = 'apex-data-mcp';
const MCP_VERSION = '3.0.0';
const SSH_OPTIONAL = process.env['OMNIBUS_DATA_SSH'] === '0';

interface CliConfig {
  pgUrl?: string;
  pgHost: string;
  pgPort: number;
  pgDb?: string;
  pgUser?: string;
  pgPassword?: string;
  ssl: boolean;
  readOnly: boolean;
  maxRows: number;
  timeout: number;
  sshHost?: string;
  sshPort: number;
  sshUser?: string;
  sshKey?: string;
  sshPassword?: string;
}

function parseArgs(argv: string[]): CliConfig {
  const config: CliConfig = {
    pgUrl: process.env['APEX_PG_URL'],
    pgHost: 'localhost',
    pgPort: 5432,
    pgPassword: process.env['APEX_PG_PASSWORD'],
    ssl: false,
    readOnly: false,
    maxRows: 500,
    timeout: 30_000,
    sshPort: 22,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const next = argv[i + 1];

    const consume = (val: string | undefined, name: string): string => {
      if (!val) throw new Error(`Missing value for ${name}`);
      i++;
      return val;
    };

    if (arg === '--pg-url') {
      config.pgUrl = consume(next, '--pg-url');
      continue;
    }
    if (arg === '--pg-host') {
      config.pgHost = consume(next, '--pg-host');
      continue;
    }
    if (arg === '--pg-port') {
      config.pgPort = parseInt(consume(next, '--pg-port'), 10);
      continue;
    }
    if (arg === '--pg-db') {
      config.pgDb = consume(next, '--pg-db');
      continue;
    }
    if (arg === '--pg-user') {
      config.pgUser = consume(next, '--pg-user');
      continue;
    }
    if (arg === '--pg-password') {
      config.pgPassword = consume(next, '--pg-password');
      continue;
    }
    if (arg === '--ssl') {
      config.ssl = true;
      continue;
    }
    if (arg === '--read-only') {
      config.readOnly = true;
      continue;
    }
    if (arg === '--max-rows') {
      config.maxRows = parseInt(consume(next, '--max-rows'), 10);
      continue;
    }
    if (arg === '--timeout') {
      config.timeout = parseInt(consume(next, '--timeout'), 10);
      continue;
    }
    if (arg === '--ssh-host') {
      config.sshHost = consume(next, '--ssh-host');
      continue;
    }
    if (arg === '--ssh-port') {
      config.sshPort = parseInt(consume(next, '--ssh-port'), 10);
      continue;
    }
    if (arg === '--ssh-user') {
      config.sshUser = consume(next, '--ssh-user');
      continue;
    }
    if (arg === '--ssh-key') {
      config.sshKey = consume(next, '--ssh-key');
      continue;
    }
    if (arg === '--ssh-password') {
      config.sshPassword = consume(next, '--ssh-password');
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return config;
}

async function main(): Promise<void> {
  const config = parseArgs(process.argv.slice(2));

  const errorHandler = new UnifiedErrorHandler({
    mcpName: MCP_NAME,
    retryOverrides: {
      postgres: { maxRetries: 3, initialDelayMs: 50 },
      ssh: { maxRetries: 2, initialDelayMs: 1000 },
    },
  });
  errorHandler.registerClassifier(classifyPostgres);
  errorHandler.registerClassifier(classifySSH);

  const serviceStatus: Record<string, boolean> = {
    postgres: false,
    ssh: false,
  };
  let tunnel: Tunnel | undefined;
  let sshModule: SSHModule | undefined;

  if (config.sshHost) {
    if (!config.sshUser) throw new Error('--ssh-user is required when using SSH tunnel');
    try {
      tunnel = await openTunnel({
        sshHost: config.sshHost,
        sshPort: config.sshPort,
        sshUser: config.sshUser,
        sshKey: config.sshKey,
        sshPassword: config.sshPassword,
        pgHost: config.pgHost,
        pgPort: config.pgPort,
      });
      // Redirect Postgres connection through the tunnel
      config.pgHost = '127.0.0.1';
      config.pgPort = tunnel.localPort;
      serviceStatus.ssh = true;
    } catch (e) {
      log.warn(
        MCP_NAME,
        'ssh',
        'startup',
        `SSH tunnel failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  const pgClient = new PgClient({
    connectionString: config.pgUrl,
    host: config.pgHost,
    port: config.pgPort,
    database: config.pgDb,
    user: config.pgUser,
    password: config.pgPassword,
    ssl: config.ssl,
    maxRows: config.maxRows,
    queryTimeout: config.timeout,
    readOnly: config.readOnly,
  });

  // Test PG connectivity
  try {
    await pgClient.query('SELECT 1');
    serviceStatus.postgres = true;
  } catch (e) {
    log.warn(
      MCP_NAME,
      'postgres',
      'startup',
      `PostgreSQL unavailable: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  log.startup(MCP_NAME, MCP_VERSION, serviceStatus);

  const server = new McpServer({
    name: MCP_NAME,
    version: MCP_VERSION,
  });

  // PostgreSQL tools (7 existing)
  registerQueryTools(server, pgClient, config.maxRows);
  registerSchemaTools(server, pgClient);
  registerHealthTools(server, pgClient);
  registerExcelTools(server);

  // SSH tools (37 new)
  // Scan env vars for extra servers: APEX_SSH_<ALIAS>_HOST, _USER, _KEY, _PASSWORD, _PORT
  const extraServers: Record<
    string,
    {
      host: string;
      port?: number;
      user: string;
      keyPath?: string;
      password?: string;
    }
  > = {};
  const hostPattern = /^APEX_SSH_([A-Z0-9_]+)_HOST$/;
  for (const [key, val] of Object.entries(process.env)) {
    const m = key.match(hostPattern);
    if (m && val) {
      const alias = m[1]!.toLowerCase();
      const user = process.env[`APEX_SSH_${m[1]}_USER`];
      if (!user) {
        log.warn(MCP_NAME, 'ssh', 'config', `Skipping APEX_SSH_${m[1]} because USER is missing`);
        continue;
      }
      extraServers[alias] = {
        host: val,
        port: process.env[`APEX_SSH_${m[1]}_PORT`]
          ? parseInt(process.env[`APEX_SSH_${m[1]}_PORT`]!, 10)
          : undefined,
        user,
        keyPath: process.env[`APEX_SSH_${m[1]}_KEY`],
        password: process.env[`APEX_SSH_${m[1]}_PASSWORD`],
      };
    }
  }

  if (config.sshHost && config.sshUser) {
    sshModule = initSSH(server, {
      host: config.sshHost,
      port: config.sshPort,
      user: config.sshUser,
      keyPath: config.sshKey,
      password: config.sshPassword,
      extraServers: Object.keys(extraServers).length > 0 ? extraServers : undefined,
    });
  } else if (Object.keys(extraServers).length > 0) {
    // No primary SSH server but extra servers exist — use the first extra as primary
    const [firstAlias, firstSrv] = Object.entries(extraServers)[0]!;
    delete extraServers[firstAlias];
    sshModule = initSSH(server, {
      host: firstSrv.host,
      port: firstSrv.port ?? 22,
      user: firstSrv.user,
      keyPath: firstSrv.keyPath,
      password: firstSrv.password,
      extraServers: Object.keys(extraServers).length > 0 ? extraServers : undefined,
    });
  }

  // System health check
  registerHealthTool(server, {
    mcpName: MCP_NAME,
    version: MCP_VERSION,
    errorHandler,
    checks: {
      postgres: async () => {
        try {
          await pgClient.query('SELECT 1');
          return null;
        } catch (e) {
          return e instanceof Error ? e.message : String(e);
        }
      },
      ssh: async () => {
        if (SSH_OPTIONAL) return null;
        if (!sshModule) return 'SSH not configured';
        try {
          const result = await sshModule.client.exec('echo ok', {
            timeout: 10_000,
          });
          return result.exitCode === 0 && result.stdout.trim() === 'ok'
            ? null
            : `SSH echo check failed: exit ${result.exitCode}`;
        } catch (e) {
          return e instanceof Error ? e.message : String(e);
        }
      },
    },
  });

  const cleanup = async () => {
    log.info(MCP_NAME, 'system', 'shutdown', 'Shutting down gracefully');
    await pgClient.end();
    tunnel?.close();
    if (sshModule) await sshModule.shutdown();
  };

  process.on('SIGINT', () => {
    cleanup().finally(() => process.exit(EXIT_CODES.SUCCESS));
  });
  process.on('SIGTERM', () => {
    cleanup().finally(() => process.exit(EXIT_CODES.SUCCESS));
  });
  process.on('uncaughtException', (err) => {
    log.error(MCP_NAME, 'system', 'uncaught_exception', err.message);
  });
  process.on('unhandledRejection', (reason) => {
    log.error(
      MCP_NAME,
      'system',
      'unhandled_rejection',
      reason instanceof Error ? reason.message : String(reason),
    );
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  const totalTools = 7 + 3 + (sshModule ? 37 : 0) + 1;
  log.ready(MCP_NAME, totalTools, serviceStatus);
}

main().catch((err) => {
  log.error(MCP_NAME, 'system', 'fatal', err instanceof Error ? err.message : String(err));
  process.exit(EXIT_CODES.FATAL_CONFIG_ERROR);
});
