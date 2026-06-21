import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { Execution, ExecutionDetail, N8nClient, Workflow } from "../client.js";
import { getTemplate, listTemplates } from "../templates/index.js";
import { toolError, toolResult } from "@framework/mcp-shared";

type HealthSeverity = "HEALTHY" | "WARNING" | "CRITICAL";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getNodeType(node: unknown): string {
  if (!isRecord(node)) {
    return "";
  }

  return typeof node.type === "string" ? node.type.toLowerCase() : "";
}

function getNodeName(node: unknown): string {
  if (!isRecord(node)) {
    return "";
  }

  return typeof node.name === "string" ? node.name : "";
}

function isTriggerWorkflow(workflow: Workflow): boolean {
  return workflow.nodes.some((node) => {
    const type = getNodeType(node);
    return (
      type.includes("webhook") ||
      type.includes("schedule") ||
      type.includes("cron") ||
      type.includes("trigger")
    );
  });
}

function hasErrorTrigger(workflow: Workflow): boolean {
  return workflow.nodes.some((node) => getNodeType(node).includes("errortrigger"));
}

function nodesContinuingOnFail(workflow: Workflow): string[] {
  return workflow.nodes
    .filter((node) => isRecord(node))
    .filter((node) => {
      return node.continueOnFail === true || (isRecord(node.parameters) && node.parameters.continueOnFail === true);
    })
    .map((node) => getNodeName(node))
    .filter((name) => name.length > 0);
}

function parseExecutionStatus(execution: Execution): string {
  return execution.status ?? (execution.finished ? "success" : "running");
}

function executionDurationMs(execution: Pick<Execution, "startedAt" | "stoppedAt">): number | undefined {
  if (!execution.stoppedAt) {
    return undefined;
  }

  const start = new Date(execution.startedAt).getTime();
  const stop = new Date(execution.stoppedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(stop) || stop < start) {
    return undefined;
  }

  return stop - start;
}

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) {
    return "n/a";
  }

  return `${Math.round(ms / 1000)}s`;
}

function classifyErrorRate(failed: number, total: number): HealthSeverity | undefined {
  if (total === 0) {
    return undefined;
  }

  const rate = failed / total;
  if (rate > 0.3) {
    return "CRITICAL";
  }
  if (rate > 0.1) {
    return "WARNING";
  }
  return undefined;
}

function maxSeverity(a: HealthSeverity, b: HealthSeverity): HealthSeverity {
  const rank: Record<HealthSeverity, number> = {
    HEALTHY: 0,
    WARNING: 1,
    CRITICAL: 2
  };

  return rank[a] >= rank[b] ? a : b;
}

function extractExecutionError(execution: ExecutionDetail): { message: string; lastNodeExecuted?: string } | undefined {
  const error = execution.data?.resultData.error;
  if (!error?.message) {
    return undefined;
  }

  return {
    message: error.message,
    lastNodeExecuted: error.lastNodeExecuted
  };
}

function summarizeFailureKey(message: string): string {
  const [firstLine] = message.split("\n");
  return firstLine.trim() || "Unknown error";
}

async function fetchExecutionDetails(
  client: N8nClient,
  executions: Execution[]
): Promise<ExecutionDetail[]> {
  const details: ExecutionDetail[] = [];
  for (const execution of executions) {
    details.push(await client.getExecution(execution.id));
  }
  return details;
}

async function collectExecutionsSince(
  client: N8nClient,
  workflowId: string,
  cutoffMs: number
): Promise<Execution[]> {
  const results: Execution[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 20; page += 1) {
    const response = await client.listExecutions(workflowId, undefined, 100, cursor);
    if (response.data.length === 0) {
      break;
    }

    let olderThanCutoffSeen = false;

    for (const execution of response.data) {
      const startedAtMs = new Date(execution.startedAt).getTime();
      if (Number.isFinite(startedAtMs) && startedAtMs >= cutoffMs) {
        results.push(execution);
      } else {
        olderThanCutoffSeen = true;
      }
    }

    if (!response.nextCursor || olderThanCutoffSeen) {
      break;
    }

    cursor = response.nextCursor;
  }

  return results;
}

function formatHealthReport(
  severity: HealthSeverity,
  workflow: Workflow,
  executions: ExecutionDetail[],
  findings: string[]
): string {
  const latestExecution = executions[0];
  const lastRun = latestExecution ? latestExecution.startedAt : "never";

  return [
    `Workflow Health: ${severity}`,
    `Workflow: ${workflow.name}`,
    `Workflow ID: ${workflow.id}`,
    `Active: ${workflow.active ? "yes" : "no"}`,
    `Recent executions inspected: ${executions.length}`,
    `Last execution: ${lastRun}`,
    "",
    "Findings:",
    findings.length > 0 ? findings.map((finding) => `- ${finding}`).join("\n") : "- No issues detected."
  ].join("\n");
}

function formatStatsReport(
  workflow: Workflow,
  days: number,
  executions: Execution[],
  failedDetails: ExecutionDetail[]
): string {
  const total = executions.length;
  const successful = executions.filter((execution) => parseExecutionStatus(execution) === "success").length;
  const failed = executions.filter((execution) => parseExecutionStatus(execution) === "error").length;
  const durations = executions
    .map((execution) => executionDurationMs(execution))
    .filter((value): value is number => value !== undefined);
  const averageDuration = durations.length
    ? Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length)
    : undefined;

  const failureBreakdown = new Map<string, number>();
  for (const execution of failedDetails) {
    const message = extractExecutionError(execution)?.message ?? "Unknown error";
    const key = summarizeFailureKey(message);
    failureBreakdown.set(key, (failureBreakdown.get(key) ?? 0) + 1);
  }

  const breakdownText =
    failureBreakdown.size > 0
      ? Array.from(failureBreakdown.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([message, count]) => `- ${message}: ${count}`)
          .join("\n")
      : "- No failed executions in range.";

  return [
    `Workflow Stats: ${workflow.name}`,
    `Workflow ID: ${workflow.id}`,
    `Window: last ${days} day(s)`,
    `Total executions: ${total}`,
    `Success rate: ${total > 0 ? ((successful / total) * 100).toFixed(1) : "0.0"}%`,
    `Average duration: ${formatDuration(averageDuration)}`,
    `Failures: ${failed}`,
    "",
    "Failure breakdown:",
    breakdownText
  ].join("\n");
}

export function registerIntelligenceTools(server: McpServer, client: N8nClient): void {
  server.tool(
    "n8n_workflow_health",
    "Audit workflow health using recent executions, trigger freshness, and error-handling checks.",
    {
      workflow_id: z.string().min(1)
    },
    async ({ workflow_id }) => {
      try {
        const workflow = await client.getWorkflow(workflow_id);
        const executionsPage = await client.listExecutions(workflow_id, undefined, 10);
        const details = await fetchExecutionDetails(client, executionsPage.data);

        let severity: HealthSeverity = "HEALTHY";
        const findings: string[] = [];

        const failedExecutions = details.filter((execution) => parseExecutionStatus(execution) === "error");
        const errorRateSeverity = classifyErrorRate(failedExecutions.length, details.length);
        if (errorRateSeverity) {
          severity = maxSeverity(severity, errorRateSeverity);
          findings.push(
            `Error rate is ${((failedExecutions.length / details.length) * 100).toFixed(1)}% across the last ${details.length} execution(s).`
          );
        }

        if (workflow.active && isTriggerWorkflow(workflow)) {
          const latest = details[0];
          if (!latest) {
            severity = maxSeverity(severity, "WARNING");
            findings.push("Workflow is active and trigger-based but has no recent executions.");
          } else {
            const lastExecutionAt = new Date(latest.startedAt).getTime();
            if (Number.isFinite(lastExecutionAt) && Date.now() - lastExecutionAt > 24 * 60 * 60 * 1000) {
              severity = maxSeverity(severity, "WARNING");
              findings.push("Workflow is active and trigger-based, but the last execution is older than 24 hours.");
            }
          }
        }

        const continueOnFailNodes = nodesContinuingOnFail(workflow);
        if (continueOnFailNodes.length > 0 && !hasErrorTrigger(workflow)) {
          severity = maxSeverity(severity, "WARNING");
          findings.push(
            `continueOnFail is enabled on node(s) ${continueOnFailNodes.join(", ")} with no Error Trigger downstream.`
          );
        }

        const latestFailure = failedExecutions[0];
        const error = latestFailure ? extractExecutionError(latestFailure) : undefined;
        if (error) {
          findings.push(
            `Latest failure: ${error.message}${error.lastNodeExecuted ? ` (last node: ${error.lastNodeExecuted})` : ""}`
          );
        }

        return toolResult(formatHealthReport(severity, workflow, details, findings));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    "n8n_workflow_stats",
    "Compute recent workflow execution volume, success rate, duration, and failure patterns.",
    {
      workflow_id: z.string().min(1),
      days: z.number().int().min(1).max(365).optional()
    },
    async ({ workflow_id, days = 7 }) => {
      try {
        const workflow = await client.getWorkflow(workflow_id);
        const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
        const executions = await collectExecutionsSince(client, workflow_id, cutoffMs);
        const failedExecutions = executions.filter((execution) => parseExecutionStatus(execution) === "error");
        const failedDetails = await fetchExecutionDetails(client, failedExecutions);

        return toolResult(formatStatsReport(workflow, days, executions, failedDetails));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    "n8n_create_from_template",
    "Create a workflow from the built-in template registry and optionally activate it.",
    {
      template_id: z.string().min(1),
      workflow_name: z.string().min(1).optional(),
      activate: z.boolean().optional()
    },
    async ({ template_id, workflow_name, activate = false }) => {
      try {
        const template = getTemplate(template_id);
        if (!template) {
          throw new Error(`Unknown template_id "${template_id}". Use n8n_list_templates to inspect available templates.`);
        }

        const workflowPayload = structuredClone(template.workflow);
        if (workflow_name) {
          workflowPayload.name = workflow_name;
        }

        const created = await client.createWorkflow(workflowPayload);
        const finalWorkflow = activate ? await client.activateWorkflow(created.id) : created;

        return toolResult(
          [
            `Workflow created from template ${template.id}.`,
            `Template: ${template.name}`,
            `Workflow ID: ${finalWorkflow.id}`,
            `Workflow Name: ${finalWorkflow.name}`,
            `Active: ${finalWorkflow.active ? "yes" : "no"}`
          ].join("\n")
        );
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    "n8n_list_templates",
    "List built-in workflow templates.",
    {},
    async () => {
      try {
        const templates = listTemplates();
        const text =
          templates.length > 0
            ? ["Templates", ...templates.map((template) => `${template.id} | ${template.category} | ${template.name} | ${template.description}`)].join("\n")
            : "No templates available.";

        return toolResult(text);
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    "n8n_system_health",
    "Check n8n connectivity and Ollama AI availability.",
    {
      ollama_url: z.string().optional()
    },
    async ({ ollama_url }) => {
      try {
        const checks: string[] = [];

        // Check n8n connectivity
        try {
          const workflows = await client.listWorkflows(1);
          checks.push(`n8n: CONNECTED (${workflows.data.length >= 0 ? "reachable" : "unknown"})`);
        } catch (err) {
          checks.push(`n8n: UNREACHABLE (${err instanceof Error ? err.message : String(err)})`);
        }

        // Check Ollama with 5s timeout
        const ollamaEndpoint = ollama_url || process.env.OLLAMA_URL || "http://localhost:11434";
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          try {
            const response = await fetch(`${ollamaEndpoint}/api/tags`, {
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (response.ok) {
              const data = await response.json() as { models?: unknown[] };
              const modelCount = Array.isArray(data?.models) ? data.models.length : 0;
              checks.push(`Ollama: CONNECTED (${modelCount} model${modelCount === 1 ? "" : "s"} available)`);
            } else {
              checks.push(`Ollama: ERROR (HTTP ${response.status})`);
            }
          } catch (err) {
            clearTimeout(timeoutId);
            if (err instanceof Error && err.name === "AbortError") {
              checks.push(`Ollama: TIMEOUT (no response within 5s from ${ollamaEndpoint})`);
            } else {
              checks.push(`Ollama: UNREACHABLE (${err instanceof Error ? err.message : String(err)})`);
            }
          }
        } catch (err) {
          checks.push(`Ollama: ERROR (${err instanceof Error ? err.message : String(err)})`);
        }

        return toolResult(["System Health Check", "", ...checks].join("\n"));
      } catch (error) {
        return toolError(error);
      }
    }
  );
}
