/**
 * Tool 6: seo_analyze_schema — JSON-LD structured data analysis.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolResult, toolError } from '@framework/mcp-shared';
import { parseHtml, extractJsonLd } from '../services/analyzer.js';
import { buildResult, type CheckResult } from '../utils.js';

/** Types expected for all sites. */
const UNIVERSAL_TYPES = ['Organization', 'WebSite', 'BreadcrumbList'];

/** Types expected per business type. */
const BUSINESS_TYPE_MAP: Record<string, string[]> = {
  ecommerce: ['Product'],
  local: ['LocalBusiness'],
  blog: ['Article'],
};

/** Required properties per schema type. */
const REQUIRED_PROPS: Record<string, string[]> = {
  Organization: ['name', 'url', 'logo'],
  Product: ['name', 'description', 'image'],
  LocalBusiness: ['name', 'address', 'telephone'],
  Article: ['headline', 'author', 'datePublished'],
  WebSite: ['name', 'url'],
  BreadcrumbList: ['itemListElement'],
};

/** Types deprecated or restricted by Google. */
const DEPRECATED_TYPES: Record<string, string> = {
  HowTo: 'HowTo rich results removed by Google (Sept 2023)',
  FAQPage: 'FAQ rich results restricted to gov/healthcare sites only',
};

export function registerSchemaTools(server: McpServer): void {
  server.tool('seo_analyze_schema', 'Analyze JSON-LD structured data for SEO completeness and correctness', {
    html: z.string().describe('Full HTML content of the page'),
    url: z.string().url().describe('Page URL'),
    business_type: z.string().optional().describe('Business type: ecommerce, local, blog (affects required schema types)'),
  }, async ({ html, url, business_type }) => {
    try {
      const $ = parseHtml(html);
      const blocks = extractJsonLd($);
      const checks: CheckResult[] = [];

      const foundTypes = new Set<string>();
      for (const block of blocks) {
        const types = Array.isArray(block.type) ? block.type : [block.type];
        for (const t of types) foundTypes.add(t);
      }

      // jsonld_present
      checks.push({
        id: 'jsonld_present',
        category: 'schema',
        severity: blocks.length > 0 ? 'pass' : 'critical',
        title: 'JSON-LD Presence',
        finding: blocks.length > 0
          ? `Found ${blocks.length} JSON-LD block(s) with types: ${[...foundTypes].join(', ')}`
          : 'No JSON-LD structured data found on the page',
        recommendation: blocks.length === 0 ? 'Add JSON-LD structured data for Organization, WebSite, and BreadcrumbList at minimum' : undefined,
        data: { count: blocks.length, types: [...foundTypes] },
      });

      // required_types
      const expectedTypes = [...UNIVERSAL_TYPES];
      if (business_type && BUSINESS_TYPE_MAP[business_type]) {
        expectedTypes.push(...BUSINESS_TYPE_MAP[business_type]);
      }
      const missingTypes = expectedTypes.filter(t => !foundTypes.has(t));
      checks.push({
        id: 'required_types',
        category: 'schema',
        severity: missingTypes.length === 0 ? 'pass' : missingTypes.some(t => UNIVERSAL_TYPES.includes(t)) ? 'critical' : 'warning',
        title: 'Required Schema Types',
        finding: missingTypes.length === 0
          ? `All expected schema types present${business_type ? ` for ${business_type}` : ''}`
          : `Missing schema types: ${missingTypes.join(', ')}`,
        recommendation: missingTypes.length > 0
          ? `Add JSON-LD blocks for: ${missingTypes.join(', ')}`
          : undefined,
        data: { expected: expectedTypes, missing: missingTypes },
      });

      // property_completeness
      const incompleteBlocks: Array<{ type: string; missing: string[] }> = [];
      for (const block of blocks) {
        const types = Array.isArray(block.type) ? block.type : [block.type];
        for (const t of types) {
          const required = REQUIRED_PROPS[t];
          if (!required) continue;
          const missing = required.filter(prop => {
            const val = block.properties[prop];
            return val === undefined || val === null || val === '';
          });
          if (missing.length > 0) {
            incompleteBlocks.push({ type: t, missing });
          }
        }
      }
      checks.push({
        id: 'property_completeness',
        category: 'schema',
        severity: incompleteBlocks.length === 0 ? 'pass' : 'warning',
        title: 'Schema Property Completeness',
        finding: incompleteBlocks.length === 0
          ? 'All schema blocks have required properties'
          : `Incomplete schema blocks: ${incompleteBlocks.map(b => `${b.type} missing ${b.missing.join(', ')}`).join('; ')}`,
        recommendation: incompleteBlocks.length > 0
          ? 'Fill in missing required properties for each schema type'
          : undefined,
        data: { incomplete: incompleteBlocks },
      });

      // deprecated_types
      const deprecatedFound: Array<{ type: string; reason: string }> = [];
      for (const t of foundTypes) {
        if (DEPRECATED_TYPES[t]) {
          deprecatedFound.push({ type: t, reason: DEPRECATED_TYPES[t] });
        }
      }
      checks.push({
        id: 'deprecated_types',
        category: 'schema',
        severity: deprecatedFound.length === 0 ? 'pass' : 'warning',
        title: 'Deprecated Schema Types',
        finding: deprecatedFound.length === 0
          ? 'No deprecated or restricted schema types detected'
          : deprecatedFound.map(d => `${d.type}: ${d.reason}`).join('; '),
        recommendation: deprecatedFound.length > 0
          ? 'Remove deprecated schema types unless your site qualifies for restricted usage (gov/healthcare for FAQ)'
          : undefined,
        data: { deprecated: deprecatedFound },
      });

      const criticals = checks.filter(c => c.severity === 'critical').length;
      const warnings = checks.filter(c => c.severity === 'warning').length;
      const summary = criticals > 0
        ? `Schema analysis: ${criticals} critical issue(s), ${warnings} warning(s) across ${blocks.length} JSON-LD block(s)`
        : warnings > 0
          ? `Schema analysis: ${warnings} warning(s) across ${blocks.length} JSON-LD block(s)`
          : `Schema analysis: all checks passed with ${blocks.length} JSON-LD block(s)`;

      return toolResult(JSON.stringify(buildResult('seo_analyze_schema', url, checks, summary), null, 2));
    } catch (e) {
      return toolError(e);
    }
  });
}
