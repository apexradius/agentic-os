import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TabRegistry } from "../tabs.js";
import { errorResult, tabIdSchema, textResult } from "../utils.js";

interface ToolDeps {
  tabs: TabRegistry;
}

export function registerPointerTools(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    "browser_mouse_move",
    {
      description: "Move the mouse to specific page coordinates.",
      inputSchema: z.object({
        x: z.number(),
        y: z.number(),
        tab_id: tabIdSchema
      })
    },
    async ({ x, y, tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          await page.mouse.move(x, y);
          return textResult(`Moved mouse to (${x}, ${y}) on tab "${tab_id}"`);
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_mouse_click",
    {
      description: "Click the mouse at page coordinates.",
      inputSchema: z.object({
        x: z.number(),
        y: z.number(),
        button: z.enum(["left", "right", "middle"]).optional().default("left"),
        tab_id: tabIdSchema
      })
    },
    async ({ x, y, button, tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          await page.mouse.click(x, y, { button });
          return textResult(`Clicked ${button} mouse button at (${x}, ${y}) on tab "${tab_id}"`);
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_mouse_wheel",
    {
      description: "Scroll the mouse wheel by delta values.",
      inputSchema: z.object({
        deltaX: z.number(),
        deltaY: z.number(),
        tab_id: tabIdSchema
      })
    },
    async ({ deltaX, deltaY, tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          await page.mouse.wheel(deltaX, deltaY);
          return textResult(`Scrolled mouse wheel by (${deltaX}, ${deltaY}) on tab "${tab_id}"`);
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_mouse_drag",
    {
      description: "Drag the mouse from start coordinates to end coordinates.",
      inputSchema: z.object({
        startX: z.number(),
        startY: z.number(),
        endX: z.number(),
        endY: z.number(),
        tab_id: tabIdSchema
      })
    },
    async ({ startX, startY, endX, endY, tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.mouse.move(endX, endY);
          await page.mouse.up();
          return textResult(`Dragged mouse from (${startX}, ${startY}) to (${endX}, ${endY}) on tab "${tab_id}"`);
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
