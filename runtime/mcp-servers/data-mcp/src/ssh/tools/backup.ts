/**
 * SSH Backup tools — ssh_backup_create, ssh_backup_list, ssh_backup_restore, ssh_backup_schedule
 */

import { toolError, toolResult } from "@framework/mcp-shared";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SSHClient } from "../client.js";
import type { ServerConfig } from "../pool.js";
import { rejectTraversalPath, resolveServer, shellEscape } from "./safety.js";

const CRON_FIELDS = [
  { name: "minute", min: 0, max: 59 },
  { name: "hour", min: 0, max: 23 },
  { name: "day-of-month", min: 1, max: 31 },
  { name: "month", min: 1, max: 12 },
  { name: "day-of-week", min: 0, max: 7 },
] as const;

function parseCronNumber(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function validateCronField(field: string, range: (typeof CRON_FIELDS)[number]): string | null {
  const entries = field.split(",");
  if (entries.length === 0 || entries.some((entry) => entry.length === 0)) {
    return `${range.name} field contains an empty list entry`;
  }

  for (const entry of entries) {
    const stepParts = entry.split("/");
    if (stepParts.length > 2) return `${range.name} field contains multiple steps`;
    const [base, step] = stepParts;

    if (step !== undefined) {
      const parsedStep = parseCronNumber(step);
      if (parsedStep === null || parsedStep < 1 || parsedStep > range.max - range.min + 1) {
        return `${range.name} field contains an invalid step`;
      }
      if (base !== "*" && !base.includes("-")) {
        return `${range.name} field step must use * or a range`;
      }
    }

    if (base === "*") continue;

    if (base.includes("-")) {
      const rangeParts = base.split("-");
      if (rangeParts.length !== 2) return `${range.name} field contains an invalid range`;
      const [rawStart, rawEnd] = rangeParts;
      const start = parseCronNumber(rawStart);
      const end = parseCronNumber(rawEnd);
      if (start === null || end === null || start < range.min || end > range.max || start > end) {
        return `${range.name} field contains an out-of-range value`;
      }
      continue;
    }

    const value = parseCronNumber(base);
    if (value === null || value < range.min || value > range.max) {
      return `${range.name} field contains an out-of-range value`;
    }
  }

  return null;
}

export function validateCronSchedule(schedule: string): string | null {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) {
    return "schedule must be a five-field cron expression";
  }
  for (const [index, field] of fields.entries()) {
    if (!/^[0-9*/,-]+$/.test(field)) {
      return "schedule contains unsupported cron characters";
    }
    const fieldError = validateCronField(field, CRON_FIELDS[index]);
    if (fieldError) return `schedule ${fieldError}`;
  }
  return null;
}

function normalizeCronSchedule(schedule: string): string {
  return schedule.trim().split(/\s+/).join(" ");
}

export function registerBackupTools(
  server: McpServer,
  ssh: SSHClient,
  servers: Map<string, ServerConfig>,
): void {
  server.tool(
    "ssh_backup_create",
    "Create a backup of a directory on a remote server",
    {
      source_path: z.string().min(1).describe("Directory to back up"),
      backup_dir: z
        .string()
        .optional()
        .describe("Backup destination directory (default: /tmp/backups)"),
      compress: z.boolean().optional().describe("Compress backup with tar.gz (default: true)"),
      server_id: z.string().optional().describe("Server alias"),
    },
    async ({ source_path, backup_dir = "/tmp/backups", compress = true, server_id }) => {
      try {
        const sourceError = rejectTraversalPath(source_path, "source_path");
        if (sourceError) return toolError(sourceError);
        const backupError = rejectTraversalPath(backup_dir, "backup_dir");
        if (backupError) return toolError(backupError);
        const { config, error } = resolveServer(servers, server_id);
        if (error) return toolError(error);
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const name = source_path.split("/").filter(Boolean).pop() ?? "backup";
        const ext = compress ? ".tar.gz" : ".tar";
        const outPath = `${backup_dir}/${name}_${ts}${ext}`;

        await ssh.exec(`mkdir -p -- ${shellEscape(backup_dir)}`, {
          server: config,
        });
        const flags = compress ? "czf" : "cf";
        const result = await ssh.exec(
          `tar ${flags} ${shellEscape(outPath)} -C "$(dirname -- ${shellEscape(source_path)})" "$(basename -- ${shellEscape(source_path)})"`,
          { server: config, timeout: 600_000 },
        );
        if (result.exitCode !== 0) return toolError(`Backup failed: ${result.stderr}`);

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
    "ssh_backup_list",
    "List available backups in a directory on a remote server",
    {
      backup_dir: z
        .string()
        .optional()
        .describe("Backup directory to list (default: /tmp/backups)"),
      server_id: z.string().optional().describe("Server alias"),
    },
    async ({ backup_dir = "/tmp/backups", server_id }) => {
      try {
        const backupError = rejectTraversalPath(backup_dir, "backup_dir");
        if (backupError) return toolError(backupError);
        const { config, error } = resolveServer(servers, server_id);
        if (error) return toolError(error);
        const result = await ssh.exec(`ls -lhtr -- ${shellEscape(backup_dir)}/ 2>/dev/null`, {
          server: config,
        });
        return toolResult(result.stdout || "No backups found.");
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    "ssh_backup_restore",
    "Restore a backup from a tar archive on a remote server",
    {
      backup_path: z.string().min(1).describe("Path to the backup archive"),
      restore_path: z.string().min(1).describe("Directory to restore to"),
      dry_run: z.boolean().optional().describe("List contents without extracting"),
      server_id: z.string().optional().describe("Server alias"),
    },
    async ({ backup_path, restore_path, dry_run, server_id }) => {
      try {
        const backupError = rejectTraversalPath(backup_path, "backup_path");
        if (backupError) return toolError(backupError);
        const restoreError = rejectTraversalPath(restore_path, "restore_path");
        if (restoreError) return toolError(restoreError);
        const { config, error } = resolveServer(servers, server_id);
        if (error) return toolError(error);
        if (dry_run) {
          const safeBackup = shellEscape(backup_path);
          const result = await ssh.exec(
            `tar tzf ${safeBackup} 2>/dev/null || tar tf ${safeBackup}`,
            { server: config },
          );
          return toolResult(`Contents of ${backup_path}:\n${result.stdout}`);
        }
        await ssh.exec(`mkdir -p -- ${shellEscape(restore_path)}`, {
          server: config,
        });
        const safeBackup = shellEscape(backup_path);
        const safeRestore = shellEscape(restore_path);
        const result = await ssh.exec(
          `tar xzf ${safeBackup} -C ${safeRestore} 2>/dev/null || tar xf ${safeBackup} -C ${safeRestore}`,
          { server: config, timeout: 600_000 },
        );
        return result.exitCode === 0
          ? toolResult(`Restored ${backup_path} → ${restore_path}`)
          : toolError(`Restore failed: ${result.stderr}`);
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.tool(
    "ssh_backup_schedule",
    "View or create a cron job for automated backups on a remote server",
    {
      action: z
        .enum(["list", "create"])
        .describe("'list' existing cron jobs or 'create' a new backup schedule"),
      schedule: z.string().optional().describe("Cron expression (e.g. '0 2 * * *' for 2 AM daily)"),
      source_path: z.string().optional().describe("Directory to back up (required for create)"),
      backup_dir: z.string().optional().describe("Backup destination (default: /tmp/backups)"),
      server_id: z.string().optional().describe("Server alias"),
    },
    async ({ action, schedule, source_path, backup_dir = "/tmp/backups", server_id }) => {
      try {
        const { config, error } = resolveServer(servers, server_id);
        if (error) return toolError(error);
        if (action === "list") {
          const result = await ssh.exec("crontab -l 2>/dev/null", {
            server: config,
          });
          return toolResult(result.stdout || "No cron jobs configured.");
        }
        if (!schedule || !source_path)
          return toolError("schedule and source_path required for create");
        const scheduleError = validateCronSchedule(schedule);
        if (scheduleError) return toolError(scheduleError);
        const safeSchedule = normalizeCronSchedule(schedule);
        const sourceError = rejectTraversalPath(source_path, "source_path");
        if (sourceError) return toolError(sourceError);
        const backupError = rejectTraversalPath(backup_dir, "backup_dir");
        if (backupError) return toolError(backupError);
        const name = source_path.split("/").filter(Boolean).pop() ?? "backup";
        const cronCmd = `${safeSchedule} tar czf ${shellEscape(`${backup_dir}/${name}_`)}$(date +\\%Y\\%m\\%d_\\%H\\%M\\%S).tar.gz -C "$(dirname -- ${shellEscape(source_path)})" "$(basename -- ${shellEscape(source_path)})"`;
        const result = await ssh.exec(
          `(crontab -l 2>/dev/null; printf '%s\\n' ${shellEscape(cronCmd)}) | crontab -`,
          { server: config },
        );
        return result.exitCode === 0
          ? toolResult(`Backup schedule created: ${cronCmd}`)
          : toolError(result.stderr);
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
