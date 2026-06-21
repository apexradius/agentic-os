/**
 * SEO scoring tool — calculates weighted health score from analysis findings.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolResult, toolError } from '@framework/mcp-shared';
import { calculateOverallScore } from '../services/scorer.js';
import type { CheckResult } from '../utils.js';

export function registerScoringTools(server: McpServer): void {
  server.tool(
    'seo_calculate_score',
    'Calculate weighted SEO health score (0-100) from analysis findings with category breakdowns and prioritized issues',
    {
      findings: z.string().describe('JSON string of CheckResult[] from analysis tools'),
    },
    async ({ findings }) => {
      try {
        let checks: CheckResult[];
        try {
          checks = JSON.parse(findings);
          if (!Array.isArray(checks)) {
            // Accept AnalysisResult[] (array of tool outputs) — flatten their checks
            const results = Array.isArray(checks) ? checks : [checks];
            checks = [];
            for (const r of results) {
              if (r && typeof r === 'object' && 'checks' in r && Array.isArray((r as { checks: unknown }).checks)) {
                checks.push(...(r as { checks: CheckResult[] }).checks);
              }
            }
          }
        } catch {
          return toolError('Invalid JSON in findings parameter');
        }

        if (checks.length === 0) {
          return toolError('No check results provided');
        }

        const result = calculateOverallScore(checks);

        return toolResult(JSON.stringify({
          overall_score: result.overallScore,
          grade: result.grade,
          total_checks: result.totalChecks,
          passed_checks: result.passedChecks,
          categories: result.categories,
          critical_issues: result.criticalIssues.map(c => ({
            id: c.id,
            category: c.category,
            title: c.title,
            finding: c.finding,
            recommendation: c.recommendation,
          })),
          warnings: result.warnings.map(c => ({
            id: c.id,
            category: c.category,
            title: c.title,
            finding: c.finding,
            recommendation: c.recommendation,
          })),
          quick_wins: result.quickWins.map(c => ({
            id: c.id,
            title: c.title,
            recommendation: c.recommendation,
          })),
        }, null, 2));
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
