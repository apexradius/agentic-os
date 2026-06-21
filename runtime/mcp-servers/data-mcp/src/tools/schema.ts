import { toolError, toolResult } from "@framework/mcp-shared";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PgClient } from "../client.js";

export function registerSchemaTools(server: McpServer, client: PgClient): void {
  server.tool("pg_list_schemas", "List all non-system schemas in the database.", {}, async () => {
    try {
      const result = await client.query(`
          SELECT
            s.schema_name,
            s.schema_owner,
            pg_size_pretty(SUM(pg_total_relation_size(c.oid))) AS total_size
          FROM information_schema.schemata s
          LEFT JOIN pg_class c ON c.relnamespace = (
            SELECT oid FROM pg_namespace WHERE nspname = s.schema_name
          )
          WHERE s.schema_name NOT IN ('pg_catalog','information_schema')
            AND s.schema_name NOT LIKE 'pg_toast%'
            AND s.schema_name NOT LIKE 'pg_temp%'
          GROUP BY s.schema_name, s.schema_owner
          ORDER BY s.schema_name
        `);

      if (result.rows.length === 0) return toolResult("No user schemas found.");
      const lines = result.rows.map(
        (r) =>
          `${String(r["schema_name"]).padEnd(30)} owner: ${r["schema_owner"]}  size: ${r["total_size"] ?? "0 bytes"}`,
      );
      return toolResult(`Schemas (${result.rows.length}):\n\n${lines.join("\n")}`);
    } catch (e) {
      return toolError(e);
    }
  });

  server.tool(
    "pg_list_tables",
    "List all tables and views in a schema with estimated row counts.",
    {
      schema: z.string().optional().describe("Schema name (default: public)"),
    },
    async ({ schema = "public" }) => {
      try {
        const result = await client.query(
          `
          SELECT
            t.table_name,
            t.table_type,
            COALESCE(s.n_live_tup, 0) AS estimated_rows,
            pg_size_pretty(pg_total_relation_size(
              (quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))::regclass
            )) AS total_size
          FROM information_schema.tables t
          LEFT JOIN pg_stat_user_tables s
            ON s.schemaname = t.table_schema AND s.relname = t.table_name
          WHERE t.table_schema = $1
          ORDER BY t.table_name
          `,
          [schema],
        );

        if (result.rows.length === 0) return toolResult(`No tables found in schema "${schema}".`);
        const lines = result.rows.map((r) => {
          const type = r["table_type"] === "VIEW" ? "VIEW" : "TABLE";
          return `${String(r["table_name"]).padEnd(40)} ${type.padEnd(6)} ~${String(r["estimated_rows"]).padStart(10)} rows  ${r["total_size"]}`;
        });
        return toolResult(`Tables in "${schema}" (${result.rows.length}):\n\n${lines.join("\n")}`);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    "pg_describe_table",
    "Show column definitions, types, constraints, and indexes for a table.",
    {
      table: z.string().min(1).describe("Table name"),
      schema: z.string().optional().describe("Schema name (default: public)"),
    },
    async ({ table, schema = "public" }) => {
      try {
        const cols = await client.query(
          `
          SELECT
            c.column_name,
            c.data_type,
            c.character_maximum_length,
            c.is_nullable,
            c.column_default,
            c.ordinal_position
          FROM information_schema.columns c
          WHERE c.table_schema = $1 AND c.table_name = $2
          ORDER BY c.ordinal_position
          `,
          [schema, table],
        );

        if (cols.rows.length === 0) {
          return toolResult(`Table "${schema}.${table}" not found or has no columns.`);
        }

        const constraints = await client.query(
          `
          SELECT
            kcu.column_name,
            tc.constraint_type,
            tc.constraint_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          WHERE tc.table_schema = $1 AND tc.table_name = $2
          `,
          [schema, table],
        );

        const constraintMap = new Map<string, string[]>();
        for (const r of constraints.rows) {
          const col = String(r["column_name"]);
          const type = String(r["constraint_type"]);
          if (!constraintMap.has(col)) constraintMap.set(col, []);
          constraintMap.get(col)!.push(type);
        }

        const lines = cols.rows.map((r) => {
          const col = String(r["column_name"]);
          const dt =
            String(r["data_type"]) +
            (r["character_maximum_length"] ? `(${r["character_maximum_length"]})` : "");
          const nullable = r["is_nullable"] === "YES" ? "NULL" : "NOT NULL";
          const def = r["column_default"] ? ` DEFAULT ${r["column_default"]}` : "";
          const ctypes = constraintMap.get(col)?.join(", ") ?? "";
          return `  ${col.padEnd(30)} ${dt.padEnd(25)} ${nullable}${def}${ctypes ? "  [" + ctypes + "]" : ""}`;
        });

        return toolResult(
          `Table: ${schema}.${table} (${cols.rows.length} columns)\n\n` +
            `${"Column".padEnd(30)} ${"Type".padEnd(25)} Nullable / Default / Constraints\n` +
            "-".repeat(90) +
            "\n" +
            lines.join("\n"),
        );
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    "pg_table_stats",
    "Get live/dead row counts, vacuum info, and size for a table.",
    {
      table: z.string().min(1).describe("Table name"),
      schema: z.string().optional().describe("Schema name (default: public)"),
    },
    async ({ table, schema = "public" }) => {
      try {
        const result = await client.query(
          `
          SELECT
            s.n_live_tup           AS live_rows,
            s.n_dead_tup           AS dead_rows,
            s.last_vacuum,
            s.last_autovacuum,
            s.last_analyze,
            s.last_autoanalyze,
            pg_size_pretty(pg_relation_size(c.oid))                AS table_size,
            pg_size_pretty(pg_indexes_size(c.oid))                 AS index_size,
            pg_size_pretty(pg_total_relation_size(c.oid))          AS total_size
          FROM pg_stat_user_tables s
          JOIN pg_class c ON c.relname = s.relname
          JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = s.schemaname
          WHERE s.schemaname = $1 AND s.relname = $2
          `,
          [schema, table],
        );

        if (result.rows.length === 0) {
          return toolResult(
            `No stats found for "${schema}.${table}". Table may not exist or have no activity.`,
          );
        }

        const r = result.rows[0]!;
        const lines = [
          `Table: ${schema}.${table}`,
          ``,
          `Live rows:     ${r["live_rows"]}`,
          `Dead rows:     ${r["dead_rows"]}`,
          `Table size:    ${r["table_size"]}`,
          `Index size:    ${r["index_size"]}`,
          `Total size:    ${r["total_size"]}`,
          ``,
          `Last vacuum:       ${r["last_vacuum"] ?? "never"}`,
          `Last autovacuum:   ${r["last_autovacuum"] ?? "never"}`,
          `Last analyze:      ${r["last_analyze"] ?? "never"}`,
          `Last autoanalyze:  ${r["last_autoanalyze"] ?? "never"}`,
        ];

        const deadRows = Number(r["dead_rows"]) || 0;
        if (deadRows > 1000) {
          lines.push(
            ``,
            `⚠ ${deadRows} dead rows — consider running VACUUM ANALYZE ${schema}.${table}`,
          );
        }

        return toolResult(lines.join("\n"));
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
