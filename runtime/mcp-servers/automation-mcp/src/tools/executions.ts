import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ExecutionDetail, N8nClient } from "../client.js";
import { toolError, toolResult } from "@framework/mcp-shared";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseJsonObject(input: string, label: string): Record<string, unknown> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(input);
  } catch (error) {
    throw new Error(`Invalid JSON for ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!isRecord(parsed) || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }

  return parsed;
}

function durationText(startedAt: string, stoppedAt?: string): string {
  if (!stoppedAt) {
    return "running";
  }

  const start = new Date(startedAt).getTime();
  const stop = new Date(stoppedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(stop) || stop < start) {
    return "unknown";
  }

  return `${Math.round((stop - start) / 1000)}s`;
}

function formatExecutionList(
  executions: Array<{
    id: string;
    workflowId: string;
    status?: string;
    finished: boolean;
    mode: string;
    startedAt: string;
    stoppedAt?: string;
  }>,
  nextCursor?: string
): string {
  if (executions.length === 0) {
    return "No executions found.";
  }

  const lines = executions.map((execution) => {
    return [
      `ID: ${execution.id}`,
      `Workflow: ${execution.workflowId}`,
      `Status: ${execution.status ?? (execution.finished ? "success" : "running")}`,
      `Mode: ${execution.mode}`,
      `Started: ${execution.startedAt}`,
      `Duration: ${durationText(execution.startedAt, execution.stoppedAt)}`
    ].join(" | ");
  });

  if (nextCursor) {
    lines.push(`nextCursor: ${nextCursor}`);
  }

  return [`Executions (${executions.length})`, ...lines].join("\n");
}

function formatExecutionDetail(execution: ExecutionDetail): string {
  const runData = execution.data?.resultData.runData ?? {};
  const nodeSummaries = Object.entries(runData).map(([nodeName, items]) => {
    return `${nodeName}: ${items.length} run item(s)`;
  });
  const error = execution.data?.resultData.error;

  return [
    `Execution: ${execution.id}`,
    `Workflow ID: ${execution.workflowId}`,
    `Status: ${execution.status ?? (execution.finished ? "success" : "running")}`,
    `Finished: ${execution.finished ? "yes" : "no"}`,
    `Mode: ${execution.mode}`,
    `Started: ${execution.startedAt}`,
    `Stopped: ${execution.stoppedAt ?? "still running"}`,
    `Duration: ${durationText(execution.startedAt, execution.stoppedAt)}`,
    "",
    "Error:",
    error
      ? JSON.stringify(
          {
            message: error.message,
            lastNodeExecuted: error.lastNodeExecuted ?? null
          },
          null,
          2
        )
      : "None",
    "",
    "Node Runs:",
    nodeSummaries.length > 0 ? nodeSummaries.join("\n") : "No runData returned.",
    "",
    "Run Data:",
    JSON.stringify(runData, null, 2)
  ].join("\n");
}

export function registerExecutionTools(server: McpServer, client: N8nClient): void {
  server.tool(
    "n8n_execute_workflow",
    "Trigger an n8n workflow execution and wait for its completion. Returns full execution metadata.",
    {
      workflow_id: z.string().min(1),
      input_data: z.string().min(2).optional()
    },
    async ({ workflow_id, input_data }) => {
      try {
        const payload = input_data ? parseJsonObject(input_data, "input_data") : undefined;
        let execution = await client.executeWorkflow(workflow_id, payload);

        const maxWaitMs = 15000;
        const intervalMs = 500;
        let elapsed = 0;

        while (!execution.finished && elapsed < maxWaitMs) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
          elapsed += intervalMs;
          const detail = await client.getExecution(execution.id);
          execution = detail;
        }

        if (!execution.finished) {
          return toolResult(
            `Execution triggered but did not finish within ${maxWaitMs / 1000}s.\nExecution ID: ${execution.id}`
          );
        }

        const fullDetail = await client.getExecution(execution.id);
        return toolResult(formatExecutionDetail(fullDetail));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    "n8n_list_executions",
    "List execution history for all workflows or a single workflow.",
    {
      workflow_id: z.string().min(1).optional(),
      status: z.enum(["success", "error", "waiting", "running"]).optional(),
      limit: z.number().int().min(1).max(250).optional()
    },
    async ({ workflow_id, status, limit = 25 }) => {
      try {
        const response = await client.listExecutions(workflow_id, status, limit);
        return toolResult(formatExecutionList(response.data, response.nextCursor));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    "n8n_get_execution",
    "Fetch full execution detail including node-level results and errors.",
    {
      execution_id: z.string().min(1)
    },
    async ({ execution_id }) => {
      try {
        const execution = await client.getExecution(execution_id);
        return toolResult(formatExecutionDetail(execution));
      } catch (error) {
        return toolError(error);
      }
    }
  );
}
