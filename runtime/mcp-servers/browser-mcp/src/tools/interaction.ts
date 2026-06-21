import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { requireDialog, type TabRegistry } from "../tabs.js";
import { errorResult, tabIdSchema, textResult } from "../utils.js";
import { humanClick, humanType, sleep } from "../humanize.js";
// @ts-ignore
import { Solver } from "2captcha";

interface ToolDeps {
  tabs: TabRegistry;
  captchaKey?: string;
}

export function registerInteractionTools(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    "browser_solve_captcha",
    {
      description: "Automatically solve a CAPTCHA on the page using 2Captcha.",
      inputSchema: z.object({
        selector: z.string().describe("The element selector for the captcha (e.g. #g-recaptcha)"),
        tab_id: tabIdSchema
      })
    },
    async ({ selector, tab_id }) => {
      if (!deps.captchaKey) {
        return errorResult("2Captcha key not configured. Set APEX_2CAPTCHA_KEY.");
      }

      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          const solver = new Solver(deps.captchaKey as string);
          const url = page.url();
          
          const siteKey = await (page as any).locator(selector).getAttribute("data-sitekey");
          if (!siteKey) return errorResult("Could not find sitekey on element.");

          const result = await solver.recaptcha(siteKey, url);
          await page.evaluate((data: { selector: string, token: string }) => {
             const input = document.querySelector(data.selector + " [name='g-recaptcha-response']");
             if (input) (input as HTMLTextAreaElement).value = data.token;
          }, { selector, token: result.data });

          return textResult(`CAPTCHA solved successfully for ${url}`);
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_click",
    {
      description: "Click an element by selector.",
      inputSchema: z.object({
        selector: z.string().min(1),
        tab_id: tabIdSchema
      })
    },
    async ({ selector, tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          await humanClick(page, selector);
          return textResult(`Clicked "${selector}" on tab "${tab_id}"`);
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_type",
    {
      description: "Type text into an element by selector.",
      inputSchema: z.object({
        selector: z.string().min(1),
        text: z.string(),
        tab_id: tabIdSchema
      })
    },
    async ({ selector, text, tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          await (page as any).locator(selector).fill("");
          await humanType(page, selector, text);
          return textResult(`Typed into "${selector}" on tab "${tab_id}"`);
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_fill_form",
    {
      description: "Fill multiple form fields by selector.",
      inputSchema: z.object({
        fields: z.array(
          z.object({
            selector: z.string().min(1),
            value: z.string()
          })
        ).min(1),
        tab_id: tabIdSchema
      })
    },
    async ({ fields, tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          for (const field of fields) {
            await (page as any).locator(field.selector).fill("");
            await humanType(page, field.selector, field.value);
            await sleep(200, 500);
          }

          return textResult(`Filled ${fields.length} field(s) on tab "${tab_id}"`);
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_select_option",
    {
      description: "Select a dropdown option by selector.",
      inputSchema: z.object({
        selector: z.string().min(1),
        value: z.string(),
        tab_id: tabIdSchema
      })
    },
    async ({ selector, value, tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          await (page as any).selectOption(selector, value);
          return textResult(`Selected "${value}" in "${selector}" on tab "${tab_id}"`);
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_press_key",
    {
      description: "Press a keyboard key in the active page.",
      inputSchema: z.object({
        key: z.string().min(1),
        tab_id: tabIdSchema
      })
    },
    async ({ key, tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          await page.keyboard.press(key);
          return textResult(`Pressed "${key}" on tab "${tab_id}"`);
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_hover",
    {
      description: "Hover an element by selector.",
      inputSchema: z.object({
        selector: z.string().min(1),
        tab_id: tabIdSchema
      })
    },
    async ({ selector, tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          await page.hover(selector);
          return textResult(`Hovered "${selector}" on tab "${tab_id}"`);
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_drag",
    {
      description: "Drag from a source selector to a target selector.",
      inputSchema: z.object({
        sourceSelector: z.string().min(1),
        targetSelector: z.string().min(1),
        tab_id: tabIdSchema
      })
    },
    async ({ sourceSelector, targetSelector, tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          await (page as any).locator(sourceSelector).dragTo((page as any).locator(targetSelector));
          return textResult(`Dragged "${sourceSelector}" to "${targetSelector}" on tab "${tab_id}"`);
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_file_upload",
    {
      description: "Upload a file into a file input element.",
      inputSchema: z.object({
        selector: z.string().min(1),
        filePath: z.string().min(1),
        tab_id: tabIdSchema
      })
    },
    async ({ selector, filePath, tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          await (page as any).setInputFiles(selector, filePath);
          return textResult(`Uploaded "${filePath}" into "${selector}" on tab "${tab_id}"`);
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_handle_dialog",
    {
      description: "Accept or dismiss the latest dialog for a tab.",
      inputSchema: z.object({
        action: z.enum(["accept", "dismiss"]),
        promptText: z.string().optional(),
        tab_id: tabIdSchema
      })
    },
    async ({ action, promptText, tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async entry => {
          const dialog = requireDialog(entry);
          if (action === "accept") {
            await dialog.accept(promptText);
          } else {
            await dialog.dismiss();
          }

          entry.pendingDialog = null;
          return textResult(`${action}ed dialog on tab "${tab_id}"`);
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
