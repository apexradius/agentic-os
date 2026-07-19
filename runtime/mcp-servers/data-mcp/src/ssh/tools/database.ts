/**
 * SSH Database tools — ssh_db_list, ssh_db_query, ssh_db_dump, ssh_db_import
 */

import { toolError, toolResult } from '@framework/mcp-shared';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SSHClient } from '../client.js';
import type { ServerConfig } from '../pool.js';
import { rejectTraversalPath, rejectUnsafeSql, resolveServer, shellEscape } from './safety.js';

export function registerDatabaseTools(
  server: McpServer,
  ssh: SSHClient,
  servers: Map<string, ServerConfig>,
): void {
  server.tool(
    'ssh_db_list',
    'List databases on a remote server (PostgreSQL or MySQL)',
    {
      db_type: z.enum(['postgres', 'mysql']).describe('Database type'),
      server_id: z.string().optional().describe('Server alias'),
    },
    async ({ db_type, server_id }) => {
      try {
        const { config, error } = resolveServer(servers, server_id);
        if (error) return toolError(error);
        const cmd =
          db_type === 'postgres'
            ? 'sudo -u postgres psql -l --no-align --tuples-only 2>/dev/null || psql -l --no-align --tuples-only'
            : 'mysql -e "SHOW DATABASES;" 2>/dev/null';
        const result = await ssh.exec(cmd, { server: config });
        return result.exitCode === 0
          ? toolResult(result.stdout || 'No databases found.')
          : toolError(result.stderr);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ssh_db_query',
    'Execute a SQL query on a remote database via SSH',
    {
      db_type: z.enum(['postgres', 'mysql']).describe('Database type'),
      database: z.string().min(1).describe('Database name'),
      query: z.string().min(1).describe('SQL query to execute (SELECT only for safety)'),
      server_id: z.string().optional().describe('Server alias'),
    },
    async ({ db_type, database, query, server_id }) => {
      try {
        const sqlError = rejectUnsafeSql(query);
        if (sqlError) return toolError(sqlError);

        const { config, error } = resolveServer(servers, server_id);
        if (error) return toolError(error);
        const cmd =
          db_type === 'postgres'
            ? `psql -d ${shellEscape(database)} -c ${shellEscape(query)} --no-align 2>&1`
            : `mysql -D ${shellEscape(database)} -e ${shellEscape(query)} 2>&1`;
        const result = await ssh.exec(cmd, { server: config, timeout: 60_000 });
        return result.exitCode === 0
          ? toolResult(result.stdout || 'Query returned no results.')
          : toolError(result.stderr || result.stdout);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ssh_db_dump',
    'Create a database backup dump on a remote server',
    {
      db_type: z.enum(['postgres', 'mysql']).describe('Database type'),
      database: z.string().min(1).describe('Database name'),
      output_path: z
        .string()
        .optional()
        .describe('Remote path for the dump (default: /tmp/<db>_<timestamp>.sql.gz)'),
      compress: z.boolean().optional().describe('Compress with gzip (default: true)'),
      server_id: z.string().optional().describe('Server alias'),
    },
    async ({ db_type, database, output_path, compress = true, server_id }) => {
      try {
        const { config, error } = resolveServer(servers, server_id);
        if (error) return toolError(error);
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const ext = compress ? '.sql.gz' : '.sql';
        const outPath = output_path ?? `/tmp/${database}_${ts}${ext}`;
        const outputError = rejectTraversalPath(outPath, 'output_path');
        if (outputError) return toolError(outputError);
        const pipe = compress ? '| gzip' : '';

        const cmd =
          db_type === 'postgres'
            ? `pg_dump ${shellEscape(database)} ${pipe} > ${shellEscape(outPath)}`
            : `mysqldump ${shellEscape(database)} ${pipe} > ${shellEscape(outPath)}`;

        const result = await ssh.exec(cmd, {
          server: config,
          timeout: 600_000,
        });
        if (result.exitCode !== 0) return toolError(`Dump failed: ${result.stderr}`);

        const size = await ssh.exec(`ls -lh -- ${shellEscape(outPath)} | awk '{print $5}'`, {
          server: config,
        });
        return toolResult(`Backup created: ${outPath} (${size.stdout.trim()})`);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'ssh_db_import',
    'Import a SQL dump into a database on a remote server',
    {
      db_type: z.enum(['postgres', 'mysql']).describe('Database type'),
      database: z.string().min(1).describe('Target database name'),
      dump_path: z.string().min(1).describe('Path to the SQL dump file on the server'),
      server_id: z.string().optional().describe('Server alias'),
    },
    async ({ db_type, database, dump_path, server_id }) => {
      try {
        const dumpError = rejectTraversalPath(dump_path, 'dump_path');
        if (dumpError) return toolError(dumpError);
        const { config, error } = resolveServer(servers, server_id);
        if (error) return toolError(error);
        const isGzipped = dump_path.endsWith('.gz');
        const safeDump = shellEscape(dump_path);
        const decompress = isGzipped ? `gunzip -c ${safeDump} |` : `cat ${safeDump} |`;

        const cmd =
          db_type === 'postgres'
            ? `${decompress} psql -d ${shellEscape(database)}`
            : `${decompress} mysql -D ${shellEscape(database)}`;

        const result = await ssh.exec(cmd, {
          server: config,
          timeout: 600_000,
        });
        return result.exitCode === 0
          ? toolResult(`Import completed into ${database}`)
          : toolError(`Import failed: ${result.stderr}`);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
