import { toolError, toolResult } from '@framework/mcp-shared';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { PgClient } from '../client.js';

export function registerHealthTools(server: McpServer, client: PgClient): void {
  server.tool(
    'pg_db_health',
    'Run a comprehensive database health check: version, size, connections, lock waits, and vacuum status.',
    {},
    async () => {
      try {
        const [version, dbSize, connStats, lockWaits, vacuumNeeded] = await Promise.all([
          client.query('SELECT version()'),
          client.query(
            'SELECT pg_size_pretty(pg_database_size(current_database())) AS size, current_database() AS db_name',
          ),
          client.query(`
            SELECT
              COUNT(*) FILTER (WHERE state != 'idle') AS active,
              COUNT(*) AS total,
              (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_conn
            FROM pg_stat_activity
          `),
          client.query(`
            SELECT COUNT(*) AS lock_waits
            FROM pg_stat_activity
            WHERE wait_event_type = 'Lock'
          `),
          client.query(`
            SELECT COUNT(*) AS tables_needing_vacuum
            FROM pg_stat_user_tables
            WHERE n_dead_tup > 1000
          `),
        ]);

        const ver = String(version.rows[0]?.['version'] ?? 'unknown');
        const dbName = String(dbSize.rows[0]?.['db_name'] ?? 'unknown');
        const size = String(dbSize.rows[0]?.['size'] ?? 'unknown');

        const active = Number(connStats.rows[0]?.['active'] ?? 0);
        const total = Number(connStats.rows[0]?.['total'] ?? 0);
        const maxConn = Number(connStats.rows[0]?.['max_conn'] ?? 100);
        const connPct = maxConn > 0 ? (active / maxConn) * 100 : 0;

        const lockWaitCount = Number(lockWaits.rows[0]?.['lock_waits'] ?? 0);
        const vacuumCount = Number(vacuumNeeded.rows[0]?.['tables_needing_vacuum'] ?? 0);

        const findings: string[] = [];
        let status = 'HEALTHY';

        if (connPct >= 90) {
          status = 'CRITICAL';
          findings.push(
            `CRITICAL: Connections at ${connPct.toFixed(0)}% (${active} active / ${maxConn} max)`,
          );
        } else if (connPct >= 80) {
          if (status !== 'CRITICAL') status = 'WARNING';
          findings.push(
            `WARNING: Connections at ${connPct.toFixed(0)}% (${active} active / ${maxConn} max)`,
          );
        }

        if (lockWaitCount > 0) {
          if (status !== 'CRITICAL') status = 'WARNING';
          findings.push(`WARNING: ${lockWaitCount} session(s) waiting on locks`);
        }

        if (vacuumCount > 0) {
          if (status !== 'CRITICAL') status = 'WARNING';
          findings.push(
            `WARNING: ${vacuumCount} table(s) have >1000 dead rows — run VACUUM ANALYZE`,
          );
        }

        const lines = [
          `Database Health: ${status}`,
          `Database: ${dbName}`,
          `Size: ${size}`,
          ``,
          `Connections: ${active} active / ${total} total / ${maxConn} max (${connPct.toFixed(0)}%)`,
          `Lock waits: ${lockWaitCount}`,
          `Tables needing vacuum: ${vacuumCount}`,
          ``,
          `Version: ${ver.split(',')[0]}`,
          ``,
          'Findings:',
          findings.length > 0
            ? findings.map((f) => `  • ${f}`).join('\n')
            : '  • No issues detected.',
        ];

        return toolResult(lines.join('\n'));
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
