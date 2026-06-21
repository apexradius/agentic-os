import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Browser, BrowserContext } from 'playwright-core';
import { z } from 'zod';
import { toolResult, toolError } from '@framework/mcp-shared';
import { Camoufox } from 'camoufox-js';
import { AxeBuilder } from '@axe-core/playwright';
import { parseAndValidate } from '@25xcodes/llmstxt-parser';

export function registerNextGenSeoTools(server: McpServer): void {
  server.tool(
    'seo_axe_accessibility_audit',
    'Run a high-speed WCAG 2.2 accessibility audit using native Playwright + Axe-core.',
    { url: z.string().url() },
    async ({ url }) => {
      let browser: Browser | undefined;
      let context: BrowserContext | undefined;
      try {
        const activeBrowser = await Camoufox<undefined, Browser>({ headless: true });
        browser = activeBrowser;
        context = await activeBrowser.newContext();
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });

        const results = await new AxeBuilder({ page }).analyze();

        const violations = results.violations
          .map((violation) => `${violation.id}: ${violation.description} (${violation.nodes.length} nodes)`)
          .join('\n');
        return toolResult(`Accessibility Score (WCAG 2.2):\nViolations found: ${results.violations.length}\n${violations}`);
      } catch (error) {
        return toolError(error);
      } finally {
        await context?.close();
        await browser?.close();
      }
    }
  );

  server.tool(
    'seo_llmstxt_aeo_score',
    'Programmatically score AEO readiness and parse llms.txt using @25xcodes/llmstxt-parser.',
    { url: z.string().url() },
    async ({ url }) => {
      try {
        const targetUrl = new URL('/llms.txt', url).toString();
        const response = await fetch(targetUrl);

        if (!response.ok) {
          return toolResult(`No llms.txt found at ${targetUrl} (HTTP ${response.status})`);
        }

        const content = await response.text();
        const parsed = parseAndValidate(content);

        return toolResult([
          'llms.txt parsed successfully.',
          `AEO Readiness Score: ${parsed.validation.score}/100`,
          `Validation: ${parsed.validation.valid ? 'valid' : 'invalid'}`,
          `Sections found: ${parsed.document.sections.length}`,
          `Links found: ${parsed.document.links.length}`,
          `Warnings: ${parsed.validation.warnings.length}`,
          `Errors: ${parsed.validation.errors.length}`,
        ].join('\n'));
      } catch (error) {
        return toolError(error);
      }
    }
  );
}
