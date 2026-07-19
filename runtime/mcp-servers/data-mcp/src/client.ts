import postgres from 'postgres';
import { isReadOnlyQuery } from './utils.js';

export interface PgConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
  maxRows: number;
  queryTimeout: number;
  readOnly: boolean;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  fields: Array<{ name: string; dataTypeID: number }>;
}

export class PgClient {
  private sql: postgres.Sql;
  private config: PgConfig;

  constructor(config: PgConfig) {
    this.config = config;

    const opts: postgres.Options<Record<string, never>> = {
      max: 5,
      idle_timeout: 30,
      connect_timeout: 10,
      connection: {
        statement_timeout: config.queryTimeout,
      },
    };

    if (config.ssl) {
      opts.ssl = 'require';
    }

    if (config.connectionString) {
      this.sql = postgres(config.connectionString, opts);
    } else {
      opts.host = config.host;
      opts.port = config.port;
      opts.database = config.database;
      opts.username = config.user;
      opts.password = config.password;
      this.sql = postgres(opts);
    }
  }

  async query(queryStr: string, params: unknown[] = [], readOnly?: boolean): Promise<QueryResult> {
    // Enforce read-only when the server is globally locked (config.readOnly) OR the
    // caller requested it for this query. A per-call `readOnly: false` can relax the
    // per-call default but can never override a globally locked server.
    const enforceReadOnly = this.config.readOnly || readOnly === true;
    if (enforceReadOnly && !isReadOnlyQuery(queryStr)) {
      throw new Error(
        'Read-only mode: only SELECT, EXPLAIN, SHOW, WITH, and VALUES queries are allowed.',
      );
    }

    try {
      const result = await this.sql.unsafe<postgres.Row[]>(
        queryStr,
        params as postgres.ParameterOrJSON<never>[],
      );

      return {
        rows: Array.from(result),
        rowCount: result.count,
        fields: result.columns.map((col) => ({ name: col.name, dataTypeID: col.type })),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Query failed: ${message}`, { cause: error });
    }
  }

  async end(): Promise<void> {
    await this.sql.end();
  }
}
