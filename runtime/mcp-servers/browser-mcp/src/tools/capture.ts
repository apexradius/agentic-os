import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TabRegistry } from "../tabs.js";
import { errorResult, multiContentResult, tabIdSchema, textResult, toPrettyJson, multimodalResult, expandHomeDir } from "../utils.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";

interface ToolDeps {
  tabs: TabRegistry;
}

export function registerCaptureTools(server: McpServer, deps: ToolDeps): void {

  server.registerTool(
    "browser_os_screenshot",
    {
      description: "Capture the full screen using native macOS tools, bypassing browser detection completely.",
      inputSchema: z.object({})
    },
    async () => {
      try {
        const tmpPath = join(tmpdir(), `os-snapshot-${Date.now()}.png`);
        // Use macOS native screencapture (-x for no sound)
        execFileSync("screencapture", ["-x", tmpPath]);
        
        const imageBuffer = readFileSync(tmpPath);
        const base64Image = imageBuffer.toString("base64");
        
        // Clean up
        try { unlinkSync(tmpPath); } catch (e) {}

        return multiContentResult([
          { type: "text", text: "Captured full native OS screenshot." },
          { type: "image", data: base64Image, mimeType: "image/png" }
        ]);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_vault_session",
    {
      description: "Vault the current authenticated session (cookies + localStorage) for future autonomous bypass.",
      inputSchema: z.object({
        name: z.string().describe("Identifier for this session (e.g. 'cra-portal')"),
        tab_id: tabIdSchema
      })
    },
    async ({ name, tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          const context = page.context();
          const cookies = await (context as any).cookies();
          const storage = await (page as any).evaluate(() => JSON.stringify(localStorage), null);
          
          const vaultPath = expandHomeDir(`~/.mcp/vault/sessions/${name}.json`);
          mkdirSync(dirname(vaultPath), { recursive: true });
          
          writeFileSync(vaultPath, JSON.stringify({
            url: page.url(),
            timestamp: new Date().toISOString(),
            cookies,
            localStorage: JSON.parse(storage)
          }, null, 2));

          return textResult(`Session "${name}" successfully vaulted to ${vaultPath}. This state can now be re-injected for bypass.`);
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_multimodal_snapshot",
    {
      description: "Capture both a screenshot and interactive element metadata for Gemini-native reasoning.",
      inputSchema: z.object({ tab_id: tabIdSchema })
    },
    async ({ tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          const [image, snapshot] = await Promise.all([
            page.screenshot({ type: "png" }),
            (page as any).locator(
              "a[href], button, input, select, textarea, summary, [role='button'], [role='link'], [role='textbox'], [contenteditable='true']"
            ).evaluateAll((elements: any[]) => {
              return elements.map(element => {
                const html = element as HTMLElement;
                const rect = html.getBoundingClientRect();
                return {
                  tag: html.tagName.toLowerCase(),
                  text: (html.innerText || html.textContent || "").trim().replace(/\s+/g, " ").slice(0, 100),
                  role: html.getAttribute("role") || undefined,
                  ariaLabel: html.getAttribute("aria-label") || undefined,
                  visible: rect.width > 0 && rect.height > 0,
                  boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
                };
              });
            })
          ]);

          return multimodalResult(
            `Multimodal snapshot for tab "${tab_id}". Reference the <metadata> section for coordinates and roles corresponding to the image.`,
            image.toString("base64"),
            snapshot
          );
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_multimodal_inspect",
    {
      description: "Deep visual and structural inspection of a specific element.",
      inputSchema: z.object({
        selector: z.string().min(1),
        tab_id: tabIdSchema
      })
    },
    async ({ selector, tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          const locator = (page as any).locator(selector).first();
          await locator.waitFor({ state: "visible" });
          
          const [image, metadata] = await Promise.all([
            locator.screenshot({ type: "png" }),
            locator.evaluate((el: any) => {
              const html = el as HTMLElement;
              const style = window.getComputedStyle(html);
              return {
                tag: html.tagName.toLowerCase(),
                id: html.id || undefined,
                classes: html.className || undefined,
                text: html.innerText.slice(0, 500),
                computedStyle: {
                  color: style.color,
                  backgroundColor: style.backgroundColor,
                  fontSize: style.fontSize,
                  fontWeight: style.fontWeight,
                  display: style.display,
                  visibility: style.visibility
                },
                attributes: Array.from(html.attributes).reduce((acc, attr) => {
                  acc[attr.name] = attr.value;
                  return acc;
                }, {} as Record<string, string>)
              };
            }, null)
          ]);

          return multimodalResult(
            `Deep inspection of element "${selector}" on tab "${tab_id}". Image shows visual rendering; <metadata> contains styles and DOM attributes.`,
            image.toString("base64"),
            metadata
          );
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_snapshot",
    {
      description: "Capture the full accessibility snapshot for a tab.",
      inputSchema: z.object({ tab_id: tabIdSchema })
    },
    async ({ tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          const snapshot = await (page as any).accessibility.snapshot({ interestingOnly: false });
          return textResult(toPrettyJson(snapshot));
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_snapshot_optimized",
    {
      description: "Capture a reduced snapshot containing only interactive elements.",
      inputSchema: z.object({ tab_id: tabIdSchema })
    },
    async ({ tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          const snapshot = await (page as any).locator(
            "a[href], button, input, select, textarea, summary, [role='button'], [role='link'], [role='textbox'], [contenteditable='true']"
          ).evaluateAll((elements: any[]) => {
            return elements.map(element => {
              const html = element as HTMLElement;
              const rect = html.getBoundingClientRect();
              const text = (html.innerText || html.textContent || "").trim().replace(/\s+/g, " ").slice(0, 200);
              return {
                tag: html.tagName.toLowerCase(),
                text,
                id: html.id || undefined,
                name: html.getAttribute("name") || undefined,
                role: html.getAttribute("role") || undefined,
                ariaLabel: html.getAttribute("aria-label") || undefined,
                placeholder: html.getAttribute("placeholder") || undefined,
                href: html.getAttribute("href") || undefined,
                disabled: html.matches(":disabled"),
                visible: rect.width > 0 && rect.height > 0,
                boundingBox: {
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height
                }
              };
            });
          });

          return textResult(toPrettyJson(snapshot));
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_take_screenshot",
    {
      description: "Capture a PNG screenshot for a tab and return it as base64 image content.",
      inputSchema: z.object({
        fullPage: z.boolean().optional().default(false),
        tab_id: tabIdSchema
      })
    },
    async ({ fullPage, tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          const image = await page.screenshot({ fullPage, type: "png" });
          return multiContentResult(
            [
              { type: "text", text: `Captured screenshot for tab "${tab_id}" (${fullPage ? "full page" : "viewport"})` },
              { type: "image", data: image.toString("base64"), mimeType: "image/png" }
            ]
          );
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_inspect_element",
    {
      description: "Capture an element screenshot as base64 image content.",
      inputSchema: z.object({
        selector: z.string().min(1),
        tab_id: tabIdSchema
      })
    },
    async ({ selector, tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async ({ page }) => {
          const locator = (page as any).locator(selector).first();
          await locator.waitFor({ state: "visible" });
          const image = await locator.screenshot({ type: "png" });

          return multiContentResult(
            [
              { type: "text", text: `Captured element screenshot for selector "${selector}" on tab "${tab_id}"` },
              { type: "image", data: image.toString("base64"), mimeType: "image/png" }
            ]
          );
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_console_messages",
    {
      description: "Return recent console messages collected for a tab.",
      inputSchema: z.object({ tab_id: tabIdSchema })
    },
    async ({ tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async entry => {
          return textResult(toPrettyJson(entry.consoleMessages));
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_network_requests",
    {
      description: "Return recent network requests collected for a tab.",
      inputSchema: z.object({ tab_id: tabIdSchema })
    },
    async ({ tab_id }) => {
      try {
        return await deps.tabs.withTab(tab_id, async entry => {
          return textResult(toPrettyJson(entry.networkRequests));
        });
      } catch (error) {
        return errorResult(error);
      }
    }
  );
}
