/**
 * SSH Monitoring tools — ssh_monitor, ssh_tail, ssh_alert_setup
 */

import { toolError, toolResult } from "@framework/mcp-shared";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SSHClient } from "../client.js";
import type { ServerConfig } from "../pool.js";
import { rejectTraversalPath, resolveServer, shellEscape } from "./safety.js";

export function registerMonitoringTools(
  server: McpServer,
  ssh: SSHClient,
  servers: Map<string, ServerConfig>,
): void {
  server.tool(
    "ssh_monitor",
    "Get system metrics from a remote server (CPU, memory, disk, network)",
    {
      server_id: z.string().optional().describe("Server alias"),
      metrics: z
        .array(z.enum(["cpu", "memory", "disk", "network", "all"]))
        .optional()
        .describe("Metrics to collect (default: all)"),
    },
    async ({ server_id, metrics = ["all"] }) => {
      try {
        const { config, error } = resolveServer(servers, server_id);
        if (error) return toolError(error);
        const collectAll = metrics.includes("all");
        const parts: string[] = [];

        if (collectAll || metrics.includes("cpu")) {
          const r = await ssh.exec("top -bn1 | head -5", { server: config });
          parts.push(`=== CPU ===\n${r.stdout}`);
        }
        if (collectAll || metrics.includes("memory")) {
          const r = await ssh.exec("free -h", { server: config });
          parts.push(`=== Memory ===\n${r.stdout}`);
        }
        if (collectAll || metrics.includes("disk")) {
          const r = await ssh.exec("df -h", { server: config });
          parts.push(`=== Disk ===\n${r.stdout}`);
        }
        if (collectAll || metrics.includes("network")) {
          const r = await ssh.exec("ss -tuln | head -20", { server: config });
          parts.push(`=== Network (listening) ===\n${r.stdout}`);
        }

        return toolResult(parts.join("\n\n"));
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    "ssh_tail",
    "Tail a log file on a remote server (returns last N lines)",
    {
      file: z.string().min(1).describe("Path to log file"),
      lines: z.number().optional().describe("Number of lines to show (default: 50)"),
      grep: z.string().optional().describe("Filter output by pattern"),
      server_id: z.string().optional().describe("Server alias"),
    },
    async ({ file, lines = 50, grep, server_id }) => {
      try {
        const fileError = rejectTraversalPath(file, "file");
        if (fileError) return toolError(fileError);
        const { config, error } = resolveServer(servers, server_id);
        if (error) return toolError(error);
        const lineCount = Math.max(1, Math.min(Math.trunc(lines), 5000));
        let cmd = `tail -n ${lineCount} -- ${shellEscape(file)}`;
        if (grep) cmd += ` | grep -i -- ${shellEscape(grep)}`;
        const result = await ssh.exec(cmd, { server: config });
        return result.exitCode === 0
          ? toolResult(result.stdout || "(empty)")
          : toolError(result.stderr);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    "ssh_alert_setup",
    "Set up basic monitoring alerts on a remote server",
    {
      type: z.enum(["disk", "memory", "load"]).describe("Alert type"),
      threshold: z
        .number()
        .describe("Threshold percentage (0-100) for disk/memory, or load average"),
      server_id: z.string().optional().describe("Server alias"),
    },
    async ({ type, threshold, server_id }) => {
      try {
        const { config, error } = resolveServer(servers, server_id);
        if (error) return toolError(error);
        let check: string;
        switch (type) {
          case "disk":
            check = `df / | awk 'NR==2{print $5}' | sed 's/%//'`;
            break;
          case "memory":
            check = `free | awk '/Mem:/{printf("%.0f", $3/$2*100)}'`;
            break;
          case "load":
            check = `cat /proc/loadavg | awk '{print $1}'`;
            break;
        }
        const result = await ssh.exec(check, { server: config });
        const current = parseFloat(result.stdout.trim());
        const status = current >= threshold ? "ALERT" : "OK";
        return toolResult(
          `${type} check: ${current}${type !== "load" ? "%" : ""} (threshold: ${threshold}${type !== "load" ? "%" : ""}) — ${status}`,
        );
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
