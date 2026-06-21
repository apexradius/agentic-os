/**
 * Technical SEO analysis tools — canonical, viewport, HTTPS, URL structure, robots.txt, AI crawlers.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolResult, toolError } from '@framework/mcp-shared';
import { parseHtml, extractMeta } from '../services/analyzer.js';
import { type CheckResult, buildResult, normalizeUrl } from '../utils.js';

export function registerTechnicalTools(server: McpServer): void {
  // ── Tool 1: seo_analyze_technical ──────────────────────────────────────
  server.tool(
    'seo_analyze_technical',
    'Analyze technical SEO factors: canonical, viewport, HTTPS, URL structure, sitemap link, security headers',
    {
      html: z.string().min(1).describe('Full HTML source of the page'),
      url: z.string().url().describe('Canonical URL of the page'),
      headers: z.string().optional().describe('JSON string of HTTP response headers'),
    },
    async ({ html, url, headers }) => {
      try {
        const $ = parseHtml(html);
        const meta = extractMeta($);
        const checks: CheckResult[] = [];

        // 1. Canonical tag
        if (!meta.canonical) {
          checks.push({
            id: 'canonical',
            category: 'technical',
            severity: 'critical',
            title: 'Missing canonical tag',
            finding: 'No <link rel="canonical"> found.',
            recommendation: 'Add a canonical tag pointing to the preferred URL for this page.',
          });
        } else {
          const normalizedCanonical = normalizeUrl(meta.canonical);
          const normalizedUrl = normalizeUrl(url);
          if (normalizedCanonical === normalizedUrl) {
            checks.push({
              id: 'canonical',
              category: 'technical',
              severity: 'pass',
              title: 'Canonical tag matches URL',
              finding: `Canonical is set to ${meta.canonical} and matches the page URL.`,
            });
          } else {
            checks.push({
              id: 'canonical',
              category: 'technical',
              severity: 'warning',
              title: 'Canonical tag mismatch',
              finding: `Canonical is ${meta.canonical} but page URL is ${url}.`,
              recommendation: 'Ensure the canonical URL matches the preferred version of this page. Mismatches can cause indexing issues.',
            });
          }
        }

        // 2. Mobile viewport
        if (!meta.viewport) {
          checks.push({
            id: 'mobile_viewport',
            category: 'technical',
            severity: 'critical',
            title: 'Missing viewport meta tag',
            finding: 'No <meta name="viewport"> found.',
            recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> for mobile-friendliness.',
          });
        } else if (meta.viewport.includes('width=device-width')) {
          checks.push({
            id: 'mobile_viewport',
            category: 'technical',
            severity: 'pass',
            title: 'Viewport configured for mobile',
            finding: `Viewport: ${meta.viewport}`,
          });
        } else {
          checks.push({
            id: 'mobile_viewport',
            category: 'technical',
            severity: 'warning',
            title: 'Viewport may not be mobile-friendly',
            finding: `Viewport is set to "${meta.viewport}" but does not include width=device-width.`,
            recommendation: 'Use width=device-width to ensure proper mobile rendering.',
          });
        }

        // 3. HTTPS
        let isHttps = false;
        try {
          isHttps = new URL(url).protocol === 'https:';
        } catch { /* invalid URL */ }

        checks.push({
          id: 'https',
          category: 'technical',
          severity: isHttps ? 'pass' : 'critical',
          title: isHttps ? 'Site uses HTTPS' : 'Site not using HTTPS',
          finding: isHttps ? 'URL uses HTTPS protocol.' : 'URL uses HTTP. Google requires HTTPS for ranking signals.',
          ...(isHttps ? {} : { recommendation: 'Migrate to HTTPS and set up 301 redirects from HTTP.' }),
        });

        // 4. URL structure
        let urlParsed: URL | null = null;
        try { urlParsed = new URL(url); } catch { /* skip */ }

        if (urlParsed) {
          const pathDepth = urlParsed.pathname.split('/').filter(Boolean).length;
          const paramCount = [...urlParsed.searchParams].length;
          const hasCleanUrl = pathDepth < 5 && paramCount <= 2;

          checks.push({
            id: 'url_structure',
            category: 'technical',
            severity: hasCleanUrl ? 'pass' : 'warning',
            title: hasCleanUrl ? 'Clean URL structure' : 'URL structure could be improved',
            finding: `Path depth: ${pathDepth}, query params: ${paramCount}.`,
            ...(hasCleanUrl ? {} : {
              recommendation: 'Keep URL depth under 5 levels and minimize query parameters for better crawlability.',
            }),
            data: { pathDepth, paramCount, path: urlParsed.pathname },
          });
        }

        // 5. XML sitemap link
        const sitemapLink = $('link[rel="sitemap"]').attr('href')
          || ($('a[href*="sitemap"]').length > 0 ? $('a[href*="sitemap"]').first().attr('href') : null);
        const htmlMentionsSitemap = html.toLowerCase().includes('sitemap');

        checks.push({
          id: 'xml_sitemap',
          category: 'technical',
          severity: sitemapLink ? 'pass' : htmlMentionsSitemap ? 'info' : 'warning',
          title: sitemapLink ? 'Sitemap reference found' : 'No sitemap reference in HTML',
          finding: sitemapLink
            ? `Sitemap referenced: ${sitemapLink}`
            : 'No explicit sitemap link found in the HTML source.',
          ...(sitemapLink ? {} : {
            recommendation: 'Ensure an XML sitemap exists at /sitemap.xml and is referenced in robots.txt.',
          }),
        });

        // 6. Security headers (if provided)
        if (headers) {
          let parsedHeaders: Record<string, string> = {};
          try { parsedHeaders = JSON.parse(headers); } catch { /* skip */ }

          // Normalize header keys to lowercase
          const lowerHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(parsedHeaders)) {
            lowerHeaders[k.toLowerCase()] = v;
          }

          const securityChecks = [
            { header: 'strict-transport-security', name: 'HSTS' },
            { header: 'x-content-type-options', name: 'X-Content-Type-Options' },
            { header: 'x-frame-options', name: 'X-Frame-Options' },
          ];

          const missing = securityChecks.filter(c => !lowerHeaders[c.header]);
          const present = securityChecks.filter(c => lowerHeaders[c.header]);

          checks.push({
            id: 'security_headers',
            category: 'technical',
            severity: missing.length === 0 ? 'pass' : missing.length === securityChecks.length ? 'warning' : 'warning',
            title: missing.length === 0 ? 'Security headers present' : `Missing ${missing.length} security header(s)`,
            finding: [
              ...present.map(c => `${c.name}: ${lowerHeaders[c.header.toLowerCase()]}`),
              ...missing.map(c => `${c.name}: MISSING`),
            ].join('; '),
            ...(missing.length > 0 ? {
              recommendation: `Add missing security headers: ${missing.map(c => c.name).join(', ')}.`,
            } : {}),
            data: { present: present.map(c => c.name), missing: missing.map(c => c.name) },
          });
        }

        const passCount = checks.filter(c => c.severity === 'pass').length;
        const critCount = checks.filter(c => c.severity === 'critical').length;
        const warnCount = checks.filter(c => c.severity === 'warning').length;
        const summary = `Technical SEO: ${passCount} passed, ${critCount} critical, ${warnCount} warnings out of ${checks.length} checks.`;

        return toolResult(JSON.stringify(buildResult('seo_analyze_technical', url, checks, summary)));
      } catch (e) {
        return toolError(e);
      }
    },
  );

  // ── Tool 2: seo_analyze_robots ─────────────────────────────────────────
  server.tool(
    'seo_analyze_robots',
    'Analyze robots.txt for SEO issues: validity, Googlebot access, AI crawler blocks, sitemap references',
    {
      robots_txt: z.string().describe('Full content of robots.txt file'),
      url: z.string().url().describe('Site URL (used for context)'),
    },
    async ({ robots_txt, url }) => {
      try {
        const checks: CheckResult[] = [];
        const lines = robots_txt.split('\n').map(l => l.trim());
        const nonEmpty = lines.filter(l => l.length > 0 && !l.startsWith('#'));

        // 1. Basic validity
        const hasUserAgent = nonEmpty.some(l => l.toLowerCase().startsWith('user-agent:'));
        if (!hasUserAgent) {
          checks.push({
            id: 'robots_txt',
            category: 'technical',
            severity: 'critical',
            title: 'Invalid robots.txt',
            finding: 'No User-agent directive found. The file may be empty or malformed.',
            recommendation: 'Add at least "User-agent: *" with appropriate Allow/Disallow rules.',
          });
        } else {
          // Check Googlebot access
          const googlebotBlocked = isAgentBlocked(lines, 'Googlebot');
          const wildcardBlocked = isAgentBlocked(lines, '*');

          if (googlebotBlocked) {
            checks.push({
              id: 'robots_txt',
              category: 'technical',
              severity: 'critical',
              title: 'Googlebot is blocked',
              finding: 'robots.txt contains "Disallow: /" for Googlebot, preventing all crawling.',
              recommendation: 'Remove the blanket disallow for Googlebot unless you intend to deindex the site.',
            });
          } else if (wildcardBlocked) {
            checks.push({
              id: 'robots_txt',
              category: 'technical',
              severity: 'critical',
              title: 'All crawlers blocked',
              finding: 'robots.txt contains "Disallow: /" for all user agents (*).',
              recommendation: 'Remove the blanket disallow unless you intend to deindex the entire site.',
            });
          } else {
            checks.push({
              id: 'robots_txt',
              category: 'technical',
              severity: 'pass',
              title: 'robots.txt is valid and allows Googlebot',
              finding: 'robots.txt has proper User-agent directives and does not block Googlebot.',
            });
          }
        }

        // 2. AI crawler analysis
        const aiCrawlers = [
          { name: 'GPTBot', owner: 'OpenAI' },
          { name: 'ClaudeBot', owner: 'Anthropic' },
          { name: 'Google-Extended', owner: 'Google AI' },
          { name: 'PerplexityBot', owner: 'Perplexity' },
          { name: 'OpenAI-SearchBot', owner: 'OpenAI Search' },
        ];

        const blockedAI: string[] = [];
        const allowedAI: string[] = [];

        for (const crawler of aiCrawlers) {
          if (isAgentBlocked(lines, crawler.name)) {
            blockedAI.push(`${crawler.name} (${crawler.owner})`);
          } else {
            allowedAI.push(`${crawler.name} (${crawler.owner})`);
          }
        }

        if (blockedAI.length > 0) {
          checks.push({
            id: 'ai_crawlers',
            category: 'technical',
            severity: 'critical',
            title: `${blockedAI.length} AI crawler(s) blocked`,
            finding: `Blocked: ${blockedAI.join(', ')}.${allowedAI.length > 0 ? ` Allowed: ${allowedAI.join(', ')}.` : ''}`,
            recommendation: 'Blocking AI crawlers reduces your visibility in AI-powered search (ChatGPT, Perplexity, Google AI Overviews). Consider allowing them unless you have specific IP concerns.',
            data: { blocked: blockedAI, allowed: allowedAI },
          });
        } else {
          checks.push({
            id: 'ai_crawlers',
            category: 'technical',
            severity: 'pass',
            title: 'No AI crawlers blocked',
            finding: `All checked AI crawlers are allowed: ${allowedAI.join(', ')}.`,
            data: { blocked: blockedAI, allowed: allowedAI },
          });
        }

        // 3. Sitemap references
        const sitemapLines = nonEmpty.filter(l => l.toLowerCase().startsWith('sitemap:'));
        const sitemapUrls = sitemapLines.map(l => l.replace(/^sitemap:\s*/i, '').trim());

        checks.push({
          id: 'xml_sitemap',
          category: 'technical',
          severity: sitemapUrls.length > 0 ? 'pass' : 'warning',
          title: sitemapUrls.length > 0 ? `${sitemapUrls.length} sitemap(s) referenced` : 'No sitemap in robots.txt',
          finding: sitemapUrls.length > 0
            ? `Sitemaps: ${sitemapUrls.join(', ')}`
            : 'No Sitemap directive found in robots.txt.',
          ...(sitemapUrls.length === 0 ? {
            recommendation: 'Add "Sitemap: https://example.com/sitemap.xml" to robots.txt for better discoverability.',
          } : {}),
          data: { sitemaps: sitemapUrls },
        });

        // 4. Important path blocks
        const importantPaths = ['/', '/blog', '/products', '/services', '/about', '/contact'];
        const disallowedImportant: string[] = [];

        for (const line of nonEmpty) {
          const match = line.match(/^disallow:\s*(.+)/i);
          if (match) {
            const path = match[1].trim();
            for (const imp of importantPaths) {
              if (path === imp || (imp !== '/' && path.startsWith(imp))) {
                disallowedImportant.push(path);
              }
            }
          }
        }

        if (disallowedImportant.length > 0) {
          checks.push({
            id: 'robots_txt',
            category: 'technical',
            severity: 'warning',
            title: 'Important paths disallowed',
            finding: `The following potentially important paths are disallowed: ${[...new Set(disallowedImportant)].join(', ')}.`,
            recommendation: 'Review these disallow rules to ensure critical content is not blocked from crawlers.',
            data: { disallowedPaths: [...new Set(disallowedImportant)] },
          });
        }

        const passCount = checks.filter(c => c.severity === 'pass').length;
        const critCount = checks.filter(c => c.severity === 'critical').length;
        const warnCount = checks.filter(c => c.severity === 'warning').length;
        const summary = `Robots.txt analysis: ${passCount} passed, ${critCount} critical, ${warnCount} warnings out of ${checks.length} checks.`;

        return toolResult(JSON.stringify(buildResult('seo_analyze_robots', url, checks, summary)));
      } catch (e) {
        return toolError(e);
      }
    },
  );
}

/** Check if a specific user-agent is blocked with "Disallow: /" in robots.txt. */
function isAgentBlocked(lines: string[], agent: string): boolean {
  let inAgentBlock = false;
  const agentLower = agent.toLowerCase();

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed.length === 0) continue;

    if (trimmed.toLowerCase().startsWith('user-agent:')) {
      const ua = trimmed.replace(/^user-agent:\s*/i, '').trim().toLowerCase();
      inAgentBlock = ua === agentLower;
    } else if (inAgentBlock && trimmed.toLowerCase().startsWith('disallow:')) {
      const path = trimmed.replace(/^disallow:\s*/i, '').trim();
      if (path === '/') return true;
    } else if (inAgentBlock && trimmed.toLowerCase().startsWith('user-agent:')) {
      inAgentBlock = false;
    }
  }
  return false;
}
