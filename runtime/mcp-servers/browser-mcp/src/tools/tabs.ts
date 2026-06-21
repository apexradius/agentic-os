import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BrowserManager } from "../browser.js";
import { installNetworkInterception, type TabRegistry } from "../tabs.js";
import { errorResult, formatUrl, tabIdSchema, textResult, type StealthProfile, toPrettyJson } from "../utils.js";

interface ToolDeps {
  browser: BrowserManager;
  tabs: TabRegistry;
}

export function registerTabTools(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    "browser_tabs",
    {
      description: "List named tabs and current URLs.",
      inputSchema: z.object({})
    },
    async () => {
      try {
        const tabs = await deps.tabs.list();
        return textResult(toPrettyJson(tabs));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_new_tab",
    {
      description: "Create a named tab and optionally navigate it.",
      inputSchema: z.object({
        tab_id: z.string().trim().min(1),
        url: z.string().url().optional()
      })
    },
    async ({ tab_id, url }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          if (url) {
            await page.goto(url, { waitUntil: "domcontentloaded" });
          }

          return textResult(`Tab "${tab_id}" is ready at ${formatUrl(page.url())}`);
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_close_tab",
    {
      description: "Close a named tab.",
      inputSchema: z.object({
        tab_id: z.string().trim().min(1)
      })
    },
    async ({ tab_id }) => {
      try {
        await deps.tabs.close(tab_id);
        return textResult(`Closed tab "${tab_id}"`);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_resize",
    {
      description: "Resize the viewport for a tab.",
      inputSchema: z.object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        tab_id: tabIdSchema
      })
    },
    async ({ width, height, tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          await page.setViewportSize({ width, height });
          return textResult(`Resized tab "${tab_id}" to ${width}x${height}`);
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_attach",
    {
      description: "Attach to an existing Chrome or Chromium instance over CDP.",
      inputSchema: z.object({
        endpoint: z.string().min(1)
      })
    },
    async ({ endpoint }) => {
      try {
        await deps.tabs.reset();
        await deps.browser.attach(endpoint);
        return textResult(`Attached browser manager to ${endpoint}`);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_intercept_network",
    {
      description: "Register URL interception patterns for a tab.",
      inputSchema: z.object({
        patterns: z.array(z.string().min(1)).min(1),
        tab_id: tabIdSchema
      })
    },
    async ({ patterns, tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async entry => {
          entry.interceptPatterns = patterns;
          await installNetworkInterception(entry);
          return textResult(`Installed ${patterns.length} interception pattern(s) on tab "${tab_id}"`);
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
