/**
 * SEO report generation tool — produces self-contained HTML report file.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolResult, toolError } from '@framework/mcp-shared';
import { generateReportHtml } from '../services/report-template.js';

export function registerReportTools(server: McpServer): void {
  server.tool(
    'seo_generate_report_html',
    'Generate a self-contained HTML SEO audit report with inline SVG charts. Returns the HTML content and a suggested file path.',
    {
      audit_data: z.string().describe('JSON string with score result from seo_calculate_score'),
      url: z.string().describe('The audited URL'),
      date: z.string().optional().describe('Audit date (defaults to today)'),
    },
    async ({ audit_data, url, date }) => {
      try {
        let scoreData: Record<string, unknown>;
        try {
          scoreData = JSON.parse(audit_data);
        } catch {
          return toolError('Invalid JSON in audit_data parameter');
        }

        const auditDate = date || new Date().toISOString().split('T')[0]!;

        // Map the score data to report format
        const reportData = {
          url,
          date: auditDate,
          overallScore: (scoreData.overall_score as number) || 0,
          grade: (scoreData.grade as string) || 'F',
          totalChecks: (scoreData.total_checks as number) || 0,
          passedChecks: (scoreData.passed_checks as number) || 0,
          categories: (scoreData.categories || {}) as Record<string, {
            score: number;
            weight: number;
            checksPassed: number;
            checksTotal: number;
            grade: string;
          }>,
          criticalIssues: (scoreData.critical_issues || []) as Array<{
            id: string;
            category: string;
            title: string;
            finding: string;
            recommendation?: string;
          }>,
          warnings: (scoreData.warnings || []) as Array<{
            id: string;
            category: string;
            title: string;
            finding: string;
            recommendation?: string;
          }>,
          quickWins: (scoreData.quick_wins || []) as Array<{
            id: string;
            title: string;
            recommendation?: string;
          }>,
        };

        const html = generateReportHtml(reportData);

        // Generate a file path suggestion
        const domain = url.replace(/https?:\/\//, '').replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 50);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filePath = `/tmp/seo-report-${domain}-${timestamp}.html`;

        return toolResult(JSON.stringify({
          html,
          suggested_path: filePath,
          score: reportData.overallScore,
          grade: reportData.grade,
          instructions: `Write the html field to ${filePath} and run: open ${filePath}`,
        }));
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
