import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { CreateWorkflowPayload, N8nClient, Workflow } from "../client.js";
import { toolError, toolResult } from "@framework/mcp-shared";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseJsonArray(input: string, label: string): unknown[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(input);
  } catch (error) {
    throw new Error(`Invalid JSON for ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON array.`);
  }

  return parsed;
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

function formatTags(tags: Workflow["tags"]): string {
  if (!tags || tags.length === 0) {
    return "none";
  }

  return tags.map((tag) => `${tag.name} (${tag.id})`).join(", ");
}

function formatWorkflowList(workflows: Workflow[], nextCursor?: string): string {
  if (workflows.length === 0) {
    return "No workflows found.";
  }

  const lines = workflows.map((workflow) => {
    return [
      `ID: ${workflow.id}`,
      `Name: ${workflow.name}`,
      `Active: ${workflow.active ? "yes" : "no"}`,
      `Updated: ${workflow.updatedAt}`,
      `Tags: ${formatTags(workflow.tags)}`
    ].join(" | ");
  });

  if (nextCursor) {
    lines.push(`nextCursor: ${nextCursor}`);
  }

  return [`Workflows (${workflows.length})`, ...lines].join("\n");
}

function formatWorkflowDetails(workflow: Workflow): string {
  return [
    `Workflow: ${workflow.name}`,
    `ID: ${workflow.id}`,
    `Active: ${workflow.active ? "yes" : "no"}`,
    `Created: ${workflow.createdAt}`,
    `Updated: ${workflow.updatedAt}`,
    `Tags: ${formatTags(workflow.tags)}`,
    `Node count: ${workflow.nodes.length}`,
    "",
    "Settings:",
    JSON.stringify(workflow.settings ?? {}, null, 2),
    "",
    "Connections:",
    JSON.stringify(workflow.connections, null, 2),
    "",
    "Nodes:",
    JSON.stringify(workflow.nodes, null, 2)
  ].join("\n");
}

function buildUpdatePayload(input: {
  name?: string;
  nodes?: string;
  connections?: string;
  settings?: string;
}): Partial<CreateWorkflowPayload> {
  const payload: Partial<CreateWorkflowPayload> = {};

  if (input.name !== undefined) {
    payload.name = input.name;
  }
  if (input.nodes !== undefined) {
    payload.nodes = parseJsonArray(input.nodes, "nodes");
  }
  if (input.connections !== undefined) {
    payload.connections = parseJsonObject(input.connections, "connections");
  }
  if (input.settings !== undefined) {
    payload.settings = parseJsonObject(input.settings, "settings");
  }

  if (Object.keys(payload).length === 0) {
    throw new Error("No update fields provided. Supply at least one of name, nodes, connections, or settings.");
  }

  return payload;
}

export function registerWorkflowTools(server: McpServer, client: N8nClient): void {
  server.tool(
    "n8n_list_workflows",
    "List n8n workflows with status, update time, and tags.",
    {
      limit: z.number().int().min(1).max(250).optional(),
      cursor: z.string().min(1).optional()
    },
    async ({ limit = 25, cursor }) => {
      try {
        const response = await client.listWorkflows(limit, cursor);
        return toolResult(formatWorkflowList(response.data, response.nextCursor));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    "n8n_get_workflow",
    "Fetch a full workflow definition by workflow ID.",
    {
      workflow_id: z.string().min(1)
    },
    async ({ workflow_id }) => {
      try {
        const workflow = await client.getWorkflow(workflow_id);
        return toolResult(formatWorkflowDetails(workflow));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    "n8n_create_workflow",
    "Create an n8n workflow from JSON nodes and connections, then optionally activate it.",
    {
      name: z.string().min(1),
      nodes: z.string().min(2),
      connections: z.string().min(2),
      settings: z.string().min(2).optional(),
      activate: z.boolean().optional()
    },
    async ({ name, nodes, connections, settings, activate = false }) => {
      try {
        const payload: CreateWorkflowPayload = {
          name,
          nodes: parseJsonArray(nodes, "nodes"),
          connections: parseJsonObject(connections, "connections")
        };

        if (settings) {
          payload.settings = parseJsonObject(settings, "settings");
        }

        const created = await client.createWorkflow(payload);
        const finalWorkflow = activate ? await client.activateWorkflow(created.id) : created;

        return toolResult(
          [
            "Workflow created successfully.",
            `ID: ${finalWorkflow.id}`,
            `Name: ${finalWorkflow.name}`,
            `Active: ${finalWorkflow.active ? "yes" : "no"}`
          ].join("\n")
        );
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    "n8n_update_workflow",
    "Partially update an n8n workflow's name, nodes, connections, or settings.",
    {
      workflow_id: z.string().min(1),
      name: z.string().min(1).optional(),
      nodes: z.string().min(2).optional(),
      connections: z.string().min(2).optional(),
      settings: z.string().min(2).optional()
    },
    async ({ workflow_id, name, nodes, connections, settings }) => {
      try {
        const payload = buildUpdatePayload({ name, nodes, connections, settings });
        const updated = await client.updateWorkflow(workflow_id, payload);

        return toolResult(
          [
            "Workflow updated successfully.",
            `ID: ${updated.id}`,
            `Name: ${updated.name}`,
            `Active: ${updated.active ? "yes" : "no"}`,
            `Updated: ${updated.updatedAt}`
          ].join("\n")
        );
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    "n8n_activate_workflow",
    "Activate or deactivate an n8n workflow.",
    {
      workflow_id: z.string().min(1),
      active: z.boolean()
    },
    async ({ workflow_id, active }) => {
      try {
        const workflow = active
          ? await client.activateWorkflow(workflow_id)
          : await client.deactivateWorkflow(workflow_id);

        return toolResult(
          [
            active ? "Workflow activated." : "Workflow deactivated.",
            `ID: ${workflow.id}`,
            `Name: ${workflow.name}`,
            `Active: ${workflow.active ? "yes" : "no"}`
          ].join("\n")
        );
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    "n8n_delete_workflow",
    "Delete an n8n workflow. confirm=true is required.",
    {
      workflow_id: z.string().min(1),
      confirm: z.boolean()
    },
    async ({ workflow_id, confirm }) => {
      try {
        if (!confirm) {
          throw new Error("Deletion blocked. Re-run with confirm=true to delete the workflow.");
        }

        await client.deleteWorkflow(workflow_id);
        return toolResult(`Workflow ${workflow_id} deleted successfully.`);
      } catch (error) {
        return toolError(error);
      }
    }
  );
}
