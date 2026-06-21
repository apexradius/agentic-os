import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TabRegistry } from "../tabs.js";
import { errorResult, tabIdSchema, textResult, toPrettyJson } from "../utils.js";

interface ToolDeps {
  tabs: TabRegistry;
}

export function registerEvaluateTools(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    "browser_evaluate",
    {
      description: "Execute JavaScript in the page context and return the result.",
      inputSchema: z.object({
        script: z.string().min(1),
        tab_id: tabIdSchema
      })
    },
    async ({ script, tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          const result = await page.evaluate(source => {
            const fn = new Function(source);
            return fn();
          }, script);

          return textResult(toPrettyJson(result));
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_trace_start",
    {
      description: "Start Playwright tracing for the shared browser context.",
      inputSchema: z.object({
        outputPath: z.string().min(1),
        tab_id: tabIdSchema
      })
    },
    async ({ outputPath, tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async entry => {
          await entry.page.context().tracing.start({
            screenshots: true,
            snapshots: true
          });

          entry.traceOutputPath = outputPath;
          return textResult(`Tracing started for tab "${tab_id}" and will save to ${outputPath}`);
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_trace_stop",
    {
      description: "Stop Playwright tracing and write the trace archive to the stored output path.",
      inputSchema: z.object({
        tab_id: tabIdSchema
      })
    },
    async ({ tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async entry => {
          const outputPath = entry.traceOutputPath;
          if (!outputPath) {
            throw new Error(`No active trace output path is registered for tab "${tab_id}"`);
          }

          await entry.page.context().tracing.stop({ path: outputPath });
          entry.traceOutputPath = undefined;
          return textResult(`Tracing stopped for tab "${tab_id}" and saved to ${outputPath}`);
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
