/**
 * SSH Connection Pool
 *
 * Manages persistent SSH connections with:
 * - Connection reuse (don't reconnect for every command)
 * - Keepalive pings (detect stale connections)
 * - Idle timeout cleanup (free resources)
 * - Auto-reconnect on failure
 */

import * as fs from "node:fs";
import { log } from "@framework/mcp-shared";
import { Client as SshClient } from "ssh2";

const MCP = "apex-data-mcp";

export interface ServerConfig {
  host: string;
  port: number;
  username: string;
  privateKeyPath?: string;
  password?: string;
  /** Alias for this server (e.g. 'vps') */
  alias?: string;
}

interface PooledConnection {
  client: SshClient;
  config: ServerConfig;
  lastUsed: number;
  keepaliveTimer?: ReturnType<typeof setInterval>;
  connected: boolean;
}

export class SSHPool {
  private pool = new Map<string, PooledConnection>();
  private readonly idleTimeout: number;
  private readonly keepaliveInterval: number;
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(opts?: { idleTimeoutMs?: number; keepaliveIntervalMs?: number }) {
    this.idleTimeout = opts?.idleTimeoutMs ?? 30 * 60 * 1000; // 30 min
    this.keepaliveInterval = opts?.keepaliveIntervalMs ?? 5 * 60 * 1000; // 5 min

    // Clean up idle connections every 10 minutes
    this.cleanupTimer = setInterval(() => this.cleanupIdle(), 10 * 60 * 1000);
  }

  /** Get the pool key for a server config */
  private key(config: ServerConfig): string {
    return `${config.username}@${config.host}:${config.port}`;
  }

  /** Get or create a connection to a server */
  async getConnection(config: ServerConfig): Promise<SshClient> {
    const k = this.key(config);
    const existing = this.pool.get(k);

    if (existing?.connected) {
      existing.lastUsed = Date.now();
      return existing.client;
    }

    // If there's a stale entry, clean it up
    if (existing) {
      this.closeConnection(k);
    }

    return this.connect(config);
  }

  /** Establish a new SSH connection */
  private connect(config: ServerConfig): Promise<SshClient> {
    const k = this.key(config);

    return new Promise((resolve, reject) => {
      const client = new SshClient();
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          client.end();
          reject(new Error(`SSH connection to ${k} timed out after 10s`));
        }
      }, 10_000);

      client.on("ready", () => {
        resolved = true;
        clearTimeout(timeout);

        const entry: PooledConnection = {
          client,
          config,
          lastUsed: Date.now(),
          connected: true,
        };

        // Start keepalive
        entry.keepaliveTimer = setInterval(() => {
          if (!entry.connected) return;
          client.exec("echo keepalive", (err) => {
            if (err) {
              log.warn(MCP, "ssh", "keepalive", `Keepalive failed for ${k}: ${err.message}`);
              entry.connected = false;
            } else {
              entry.lastUsed = Date.now();
            }
          });
        }, this.keepaliveInterval);

        this.pool.set(k, entry);
        log.info(MCP, "ssh", "connect", `Connected to ${k}`);
        resolve(client);
      });

      client.on("error", (err) => {
        clearTimeout(timeout);
        const entry = this.pool.get(k);
        if (entry) entry.connected = false;

        if (!resolved) {
          reject(new Error(`SSH connection to ${k} failed: ${err.message}`));
        } else {
          log.warn(MCP, "ssh", "error", `Connection error on ${k}: ${err.message}`);
        }
      });

      client.on("close", () => {
        const entry = this.pool.get(k);
        if (entry) entry.connected = false;
      });

      const connectOpts: Parameters<SshClient["connect"]>[0] = {
        host: config.host,
        port: config.port,
        username: config.username,
        keepaliveInterval: this.keepaliveInterval,
        keepaliveCountMax: 3,
        readyTimeout: 20000,
      };

      const agentSocket = process.env["SSH_AUTH_SOCK"];
      if (agentSocket && fs.existsSync(agentSocket)) {
        connectOpts.agent = agentSocket;
      }

      if (config.privateKeyPath) {
        try {
          const keyStat = fs.statSync(config.privateKeyPath);
          if ((keyStat.mode & 0o077) !== 0) {
            log.warn(
              MCP,
              "ssh",
              "key_permissions",
              `SSH key ${config.privateKeyPath} is readable by group or others`,
            );
          }
          connectOpts.privateKey = fs.readFileSync(config.privateKeyPath);
        } catch (e) {
          reject(
            new Error(
              `Cannot read SSH key at ${config.privateKeyPath}: ${e instanceof Error ? e.message : String(e)}`,
            ),
          );
          return;
        }
      } else if (config.password) {
        connectOpts.password = config.password;
      }

      client.connect(connectOpts);
    });
  }

  /** Close a specific connection */
  closeConnection(key: string): void {
    const entry = this.pool.get(key);
    if (!entry) return;
    try {
      entry.client.end();
    } catch {
      /* best effort */
    }
    entry.connected = false;
    this.pool.delete(key);
    log.info(MCP, "ssh", "disconnect", `Closed connection to ${key}`);
  }

  /** Clean up idle connections */
  private cleanupIdle(): void {
    const now = Date.now();
    for (const [key, entry] of this.pool) {
      if (now - entry.lastUsed > this.idleTimeout) {
        log.info(MCP, "ssh", "cleanup", `Closing idle connection to ${key}`);
        this.closeConnection(key);
      }
    }
  }

  /** Get pool status for health checks */
  status(): {
    active: number;
    connections: Array<{ server: string; idleMs: number; connected: boolean }>;
  } {
    const connections = [];
    for (const [key, entry] of this.pool) {
      connections.push({
        server: key,
        idleMs: Date.now() - entry.lastUsed,
        connected: entry.connected,
      });
    }
    return {
      active: connections.filter((c) => c.connected).length,
      connections,
    };
  }

  /** Close all connections */
  async shutdown(): Promise<void> {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    for (const key of [...this.pool.keys()]) {
      this.closeConnection(key);
    }
  }
}
