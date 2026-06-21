/**
 * SSH Client — wraps ssh2 for command execution, file transfer, etc.
 *
 * All SSH tools use this client, which is backed by the connection pool.
 */

import type { ServerConfig, SSHPool } from "./pool.js";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class SSHClient {
  constructor(
    private readonly pool: SSHPool,
    private readonly defaultServer: ServerConfig,
  ) {}

  /** Execute a command on the server */
  async exec(
    command: string,
    opts?: { timeout?: number; cwd?: string; server?: ServerConfig },
  ): Promise<ExecResult> {
    const config = opts?.server ?? this.defaultServer;
    const client = await this.pool.getConnection(config);
    const timeout = opts?.timeout ?? 120_000;

    const fullCmd = opts?.cwd ? `cd ${shellEscape(opts.cwd)} && ${command}` : command;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Command timed out after ${timeout}ms: ${command.slice(0, 80)}`));
      }, timeout);

      client.exec(fullCmd, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          reject(err);
          return;
        }

        let stdout = "";
        let stderr = "";

        stream.on("data", (data: Buffer) => {
          stdout += data.toString();
        });
        stream.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on("close", (code: number) => {
          clearTimeout(timer);
          resolve({ stdout, stderr, exitCode: code ?? 0 });
        });

        stream.on("error", (e: Error) => {
          clearTimeout(timer);
          reject(e);
        });
      });
    });
  }

  /** Execute with sudo */
  async execSudo(
    command: string,
    opts?: { timeout?: number; server?: ServerConfig },
  ): Promise<ExecResult> {
    // If running as root, sudo is unnecessary
    const config = opts?.server ?? this.defaultServer;
    if (config.username === "root") {
      return this.exec(command, opts);
    }
    return this.exec(`sudo -n ${command}`, opts);
  }

  /** Upload a file via SFTP */
  async upload(
    localPath: string,
    remotePath: string,
    opts?: { server?: ServerConfig },
  ): Promise<void> {
    const config = opts?.server ?? this.defaultServer;
    const client = await this.pool.getConnection(config);

    return new Promise((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) {
          reject(err);
          return;
        }
        sftp.fastPut(localPath, remotePath, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  /** Download a file via SFTP */
  async download(
    remotePath: string,
    localPath: string,
    opts?: { server?: ServerConfig },
  ): Promise<void> {
    const config = opts?.server ?? this.defaultServer;
    const client = await this.pool.getConnection(config);

    return new Promise((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) {
          reject(err);
          return;
        }
        sftp.fastGet(remotePath, localPath, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  /** Read a remote file's contents */
  async readFile(remotePath: string, opts?: { server?: ServerConfig }): Promise<string> {
    const result = await this.exec(`cat ${shellEscape(remotePath)}`, opts);
    if (result.exitCode !== 0) throw new Error(`Failed to read ${remotePath}: ${result.stderr}`);
    return result.stdout;
  }

  /** List files in a remote directory */
  async ls(remotePath: string, opts?: { server?: ServerConfig }): Promise<string> {
    const result = await this.exec(`ls -la ${shellEscape(remotePath)}`, opts);
    if (result.exitCode !== 0) throw new Error(`Failed to list ${remotePath}: ${result.stderr}`);
    return result.stdout;
  }

  get server(): ServerConfig {
    return this.defaultServer;
  }
}

/** Escape a string for shell use */
function shellEscape(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}
