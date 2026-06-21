import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorResult, textResult, sleep } from "../utils.js";
import robot from "robotjs";

export function registerOSInteractionTools(server: McpServer): void {
  server.registerTool(
    "browser_os_click",
    {
      description: "Physically click the mouse at specific X/Y coordinates, completely bypassing browser detection.",
      inputSchema: z.object({
        x: z.number().describe("The X coordinate on the screen."),
        y: z.number().describe("The Y coordinate on the screen."),
        button: z.enum(["left", "right", "middle"]).optional().default("left")
      })
    },
    async ({ x, y, button }) => {
      try {
        // Move the mouse physically
        robot.moveMouseSmooth(x, y, 1.5);
        await sleep(100, 300);
        
        // Physical click
        robot.mouseClick(button as string);
        
        return textResult(`Physically clicked ${button} button at (${x}, ${y})`);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_os_type",
    {
      description: "Physically type text using the OS keyboard, completely bypassing browser detection.",
      inputSchema: z.object({
        text: z.string().describe("The text to type."),
        delay: z.boolean().optional().default(true).describe("Whether to mimic human typing delays.")
      })
    },
    async ({ text, delay }) => {
      try {
        if (delay) {
          robot.setKeyboardDelay(100); // 100ms average delay between keystrokes
        } else {
          robot.setKeyboardDelay(10);
        }

        robot.typeString(text);
        
        return textResult(`Physically typed string: "${text}"`);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_os_key",
    {
      description: "Physically press a specific key (e.g. 'enter', 'tab', 'escape').",
      inputSchema: z.object({
        key: z.string().describe("The key to press (robotjs key string).")
      })
    },
    async ({ key }) => {
      try {
        robot.keyTap(key);
        return textResult(`Physically pressed key: ${key}`);
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
