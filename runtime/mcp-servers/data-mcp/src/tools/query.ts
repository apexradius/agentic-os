import { toolError, toolResult } from '@framework/mcp-shared';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { PgClient } from '../client.js';
import { formatTable } from '../utils.js';

export function registerQueryTools(server: McpServer, client: PgClient, maxRows: number): void {
  server.tool(
    'pg_query',
    'Execute a SQL query and return results as a formatted table. Read-only by default: ' +
      'only SELECT/EXPLAIN/SHOW/WITH/VALUES are permitted unless readOnly is explicitly set to ' +
      'false, which allows write statements (INSERT/UPDATE/DELETE/DDL).',
    {
      sql: z.string().min(1).describe('SQL query to execute'),
      params: z
        .string()
        .optional()
        .describe("JSON array of query parameters for parameterized queries, e.g. [1, 'abc']"),
      max_rows: z
        .number()
        .int()
        .min(1)
        .max(5000)
        .optional()
        .describe(`Maximum rows to return (default ${maxRows})`),
      readOnly: z
        .boolean()
        .optional()
        .default(true)
        .describe(
          'Restrict this query to read-only statements. Defaults to true; set false to ' +
            'deliberately permit writes. A server started with --read-only stays locked regardless.',
        ),
    },
    async ({ sql, params, max_rows, readOnly }) => {
      try {
        let parsedParams: unknown[] = [];
        if (params) {
          const p = JSON.parse(params) as unknown;
          if (!Array.isArray(p)) throw new Error('params must be a JSON array');
          parsedParams = p;
        }

        const limit = max_rows ?? maxRows;
        const result = await client.query(sql, parsedParams, readOnly);
        const columns = result.fields.map((f) => f.name);
        const text = formatTable(columns, result.rows, limit);
        return toolResult(text);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    'pg_explain',
    'Get the query execution plan. Use analyze=true to actually run the query and get real timings.',
    {
      sql: z.string().min(1).describe('SQL query to explain'),
      analyze: z
        .boolean()
        .optional()
        .describe('Run EXPLAIN ANALYZE (executes the query). Default false.'),
    },
    async ({ sql, analyze = false }) => {
      try {
        const prefix = analyze ? 'EXPLAIN (ANALYZE, FORMAT TEXT)' : 'EXPLAIN (FORMAT TEXT)';
        const result = await client.query(`${prefix} ${sql}`);
        const plan = result.rows.map((r) => Object.values(r).join('')).join('\n');
        const warning = analyze
          ? '\n⚠ EXPLAIN ANALYZE executed the query — any side effects occurred.\n\n'
          : '';
        return toolResult(`${warning}${plan}`);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
