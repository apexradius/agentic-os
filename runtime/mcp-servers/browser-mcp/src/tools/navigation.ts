import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TabRegistry } from "../tabs.js";
import { errorResult, textResult, tabIdSchema } from "../utils.js";

interface ToolDeps {
  tabs: TabRegistry;
}

const tabInputSchema = z.object({
  tab_id: tabIdSchema
});

export function registerNavigationTools(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    "browser_navigate",
    {
      description: "Navigate a tab to a URL.",
      inputSchema: z.object({
        url: z.string().url(),
        tab_id: tabIdSchema
      })
    },
    async ({ url, tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          await page.goto(url, { waitUntil: "domcontentloaded" });
          return textResult(`Navigated tab "${tab_id}" to ${page.url()}`);
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_navigate_back",
    {
      description: "Navigate the current tab back in history.",
      inputSchema: tabInputSchema
    },
    async ({ tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          const response = await page.goBack({ waitUntil: "domcontentloaded" });
          const status = response?.status();
          return textResult(`Tab "${tab_id}" navigated back to ${page.url()}${status ? ` (status ${status})` : ""}`);
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_reload",
    {
      description: "Reload the current tab.",
      inputSchema: tabInputSchema
    },
    async ({ tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          await page.reload({ waitUntil: "domcontentloaded" });
          return textResult(`Reloaded tab "${tab_id}" at ${page.url()}`);
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_wait_for",
    {
      description: "Wait for a selector, URL, or page load condition.",
      inputSchema: z.object({
        condition: z.enum(["selector", "url", "networkIdle", "load"]),
        value: z.string().optional(),
        tab_id: tabIdSchema
      })
    },
    async ({ condition, value, tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          switch (condition) {
            case "selector":
              if (!value) {
                throw new Error("browser_wait_for requires value when condition=selector");
              }
              await page.waitForSelector(value);
              break;
            case "url":
              if (value) {
                await page.waitForURL(value);
              } else {
                await page.waitForLoadState("domcontentloaded");
              }
              break;
            case "networkIdle":
              await page.waitForLoadState("networkidle");
              break;
            case "load":
              await page.waitForLoadState("load");
              break;
            default:
              throw new Error(`Unsupported wait condition: ${condition}`);
          }

          return textResult(`Wait condition "${condition}" satisfied on tab "${tab_id}"`);
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
