import { spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";

export interface SshTunnelConfig {
  sshHost: string;
  sshPort: number;
  sshUser: string;
  remoteHost: string;
  remotePort: number;
}

export interface SshTunnel {
  localPort: number;
  close(): void;
}

function selectSshKey(): string | undefined {
  const home = os.homedir();
  const candidates = [
    process.env.APEX_N8N_SSH_KEY,
    process.env.APEX_OMNIBUS_SSH_KEY,
    `${home}/.ssh/id_ed25519`,
  ].filter((keyPath): keyPath is string => typeof keyPath === "string" && keyPath.length > 0);
  return candidates.find(keyPath => fs.existsSync(keyPath));
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate local tunnel port"));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

function waitForPort(port: number, proc: ChildProcess, timeoutMs = 10_000): Promise<void> {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      if (proc.exitCode !== null) {
        reject(new Error(`ssh tunnel exited with code ${proc.exitCode}`));
        return;
      }

      const socket = net.createConnection({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`ssh tunnel did not open localhost:${port} within ${timeoutMs}ms`));
          return;
        }
        setTimeout(tryConnect, 200);
      });
    };

    tryConnect();
  });
}

export async function openSshTunnel(config: SshTunnelConfig): Promise<SshTunnel> {
  const localPort = await getFreePort();
  const forward = `${localPort}:${config.remoteHost}:${config.remotePort}`;
  const destination = `${config.sshUser}@${config.sshHost}`;
  const keyPath = selectSshKey();
  const identityArgs = keyPath ? ["-i", keyPath, "-o", "IdentitiesOnly=yes", "-o", "IdentityAgent=none"] : [];
  const proc = spawn("ssh", [
    "-N",
    "-L",
    forward,
    "-p",
    String(config.sshPort),
    "-o",
    "ExitOnForwardFailure=yes",
    "-o",
    "ServerAliveInterval=30",
    "-o",
    "ServerAliveCountMax=2",
    ...identityArgs,
    destination,
  ], {
    stdio: ["ignore", "ignore", "pipe"],
  });

  await waitForPort(localPort, proc);

  return {
    localPort,
    close() {
      if (proc.exitCode === null) proc.kill("SIGTERM");
    },
  };
}
