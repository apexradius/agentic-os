/**
 * SSH Tunnel tools — ssh_tunnel_create, ssh_tunnel_close, ssh_tunnel_list
 */

import * as net from "node:net";
import { log, toolError, toolResult } from "@framework/mcp-shared";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ServerConfig, SSHPool } from "../pool.js";

const MCP = "apex-data-mcp";

interface ActiveTunnel {
  id: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
  serverId: string;
  server: net.Server;
  createdAt: string;
}

const activeTunnels = new Map<string, ActiveTunnel>();
let tunnelCounter = 0;

export function registerTunnelTools(
  server: McpServer,
  pool: SSHPool,
  servers: Map<string, ServerConfig>,
): void {
  server.tool(
    "ssh_tunnel_create",
    "Create an SSH tunnel (local port forwarding)",
    {
      remote_host: z.string().min(1).describe("Remote host to tunnel to (e.g. localhost)"),
      remote_port: z.number().describe("Remote port to tunnel to"),
      local_port: z.number().optional().describe("Local port to bind (auto-assigned if omitted)"),
      server_id: z.string().optional().describe("Server alias for the SSH hop"),
    },
    async ({ remote_host, remote_port, local_port, server_id }) => {
      try {
        const config = server_id ? servers.get(server_id) : undefined;
        if (!config && server_id) return toolError(`Unknown server: ${server_id}`);

        const sshClient = config ? await pool.getConnection(config) : null;
        if (!sshClient) return toolError("No SSH connection available");

        const assignedPort = local_port ?? (await getFreePort());
        const id = `tunnel-${++tunnelCounter}`;

        const tcpServer = net.createServer((socket) => {
          sshClient.forwardOut(
            "127.0.0.1",
            assignedPort,
            remote_host,
            remote_port,
            (err, stream) => {
              if (err) {
                socket.destroy();
                return;
              }
              socket.pipe(stream).pipe(socket);
              stream.on("error", () => socket.destroy());
              socket.on("error", () => stream.destroy());
            },
          );
        });

        await new Promise<void>((resolve, reject) => {
          tcpServer.listen(assignedPort, "127.0.0.1", () => resolve());
          tcpServer.on("error", reject);
        });

        activeTunnels.set(id, {
          id,
          localPort: assignedPort,
          remoteHost: remote_host,
          remotePort: remote_port,
          serverId: server_id ?? "default",
          server: tcpServer,
          createdAt: new Date().toISOString(),
        });

        log.info(
          MCP,
          "ssh",
          "tunnel_create",
          `Tunnel ${id}: localhost:${assignedPort} → ${remote_host}:${remote_port}`,
        );
        return toolResult(
          `Tunnel created: ${id}\nLocal: localhost:${assignedPort} → ${remote_host}:${remote_port}`,
        );
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool("ssh_tunnel_list", "List all active SSH tunnels", {}, async () => {
    try {
      if (activeTunnels.size === 0) return toolResult("No active tunnels.");
      const lines = [...activeTunnels.values()].map(
        (t) =>
          `  ${t.id}: localhost:${t.localPort} → ${t.remoteHost}:${t.remotePort} (via ${t.serverId}, since ${t.createdAt})`,
      );
      return toolResult(`Active tunnels (${activeTunnels.size}):\n${lines.join("\n")}`);
    } catch (e) {
      return toolError(e);
    }
  });

  server.tool(
    "ssh_tunnel_close",
    "Close an SSH tunnel",
    {
      tunnel_id: z.string().min(1).describe("Tunnel ID to close"),
    },
    async ({ tunnel_id }) => {
      try {
        const tunnel = activeTunnels.get(tunnel_id);
        if (!tunnel) return toolError(`Tunnel not found: ${tunnel_id}`);
        tunnel.server.close();
        activeTunnels.delete(tunnel_id);
        log.info(MCP, "ssh", "tunnel_close", `Tunnel ${tunnel_id} closed`);
        return toolResult(`Tunnel closed: ${tunnel_id}`);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}

/** Close all tunnels (for graceful shutdown) */
export function closeAllTunnels(): void {
  for (const [id, tunnel] of activeTunnels) {
    try {
      tunnel.server.close();
    } catch {
      /* best effort */
    }
    activeTunnels.delete(id);
  }
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (!addr || typeof addr === "string") {
        srv.close();
        reject(new Error("Could not get free port"));
        return;
      }
      const port = addr.port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}
