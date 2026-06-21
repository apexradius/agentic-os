/**
 * Tool 9: seo_analyze_sitemap — XML sitemap analysis.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolResult, toolError } from '@framework/mcp-shared';
import { load } from 'cheerio';
import { buildResult, type CheckResult } from '../utils.js';

/** Classify a URL by its path pattern. */
function classifyUrl(urlStr: string): string {
  const path = urlStr.toLowerCase();
  if (/\/products\//.test(path)) return 'product';
  if (/\/collections\//.test(path)) return 'collection';
  if (/\/blogs?\//.test(path) || /\/posts?\//.test(path) || /\/articles?\//.test(path)) return 'blog';
  if (/\/pages?\//.test(path)) return 'page';
  if (/\/categories\//.test(path) || /\/tags?\//.test(path)) return 'taxonomy';
  return 'other';
}

/** Calculate days between a date string and now. */
function daysAgo(dateStr: string): number | null {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function registerSitemapTools(server: McpServer): void {
  server.tool('seo_analyze_sitemap', 'Analyze XML sitemap for URL coverage, freshness, and structure', {
    sitemap_xml: z.string().describe('Full XML content of the sitemap'),
    url: z.string().url().describe('Site URL (for consistency checks)'),
  }, async ({ sitemap_xml, url }) => {
    try {
      const $ = load(sitemap_xml, { xmlMode: true });
      const checks: CheckResult[] = [];

      // Parse all <url> entries
      const urls: Array<{ loc: string; lastmod: string | null; changefreq: string | null; priority: string | null }> = [];
      $('url').each((_, el) => {
        urls.push({
          loc: $(el).find('loc').text().trim(),
          lastmod: $(el).find('lastmod').text().trim() || null,
          changefreq: $(el).find('changefreq').text().trim() || null,
          priority: $(el).find('priority').text().trim() || null,
        });
      });

      // Check if this is a sitemap index
      const sitemapIndexEntries: string[] = [];
      $('sitemap loc').each((_, el) => {
        sitemapIndexEntries.push($(el).text().trim());
      });

      if (urls.length === 0 && sitemapIndexEntries.length > 0) {
        checks.push({
          id: 'sitemap_index',
          category: 'technical',
          severity: 'info',
          title: 'Sitemap Index Detected',
          finding: `This is a sitemap index with ${sitemapIndexEntries.length} child sitemap(s)`,
          data: { childSitemaps: sitemapIndexEntries },
        });
        return toolResult(JSON.stringify(buildResult('seo_analyze_sitemap', url, checks, `Sitemap index with ${sitemapIndexEntries.length} child sitemaps`), null, 2));
      }

      // URL count check
      checks.push({
        id: 'url_count',
        category: 'technical',
        severity: urls.length === 0 ? 'critical' : urls.length > 50000 ? 'warning' : 'pass',
        title: 'Sitemap URL Count',
        finding: urls.length === 0
          ? 'Sitemap contains no URLs'
          : `Sitemap contains ${urls.length} URL(s)${urls.length > 50000 ? ' — exceeds 50,000 URL limit per sitemap' : ''}`,
        recommendation: urls.length === 0
          ? 'Add URLs to the sitemap or check XML formatting'
          : urls.length > 50000
            ? 'Split into multiple sitemaps and use a sitemap index (max 50,000 URLs per file)'
            : undefined,
        data: { count: urls.length },
      });

      if (urls.length === 0) {
        return toolResult(JSON.stringify(buildResult('seo_analyze_sitemap', url, checks, 'Empty sitemap — no URLs to analyze'), null, 2));
      }

      // lastmod freshness distribution
      const withLastmod = urls.filter(u => u.lastmod);
      const freshnessDistribution = { recent7d: 0, recent30d: 0, recent90d: 0, older: 0, noDate: 0 };

      for (const u of urls) {
        if (!u.lastmod) {
          freshnessDistribution.noDate++;
          continue;
        }
        const days = daysAgo(u.lastmod);
        if (days === null) { freshnessDistribution.noDate++; continue; }
        if (days <= 7) freshnessDistribution.recent7d++;
        else if (days <= 30) freshnessDistribution.recent30d++;
        else if (days <= 90) freshnessDistribution.recent90d++;
        else freshnessDistribution.older++;
      }

      checks.push({
        id: 'lastmod_freshness',
        category: 'technical',
        severity: withLastmod.length === 0 ? 'warning' : freshnessDistribution.older > withLastmod.length * 0.7 ? 'warning' : 'pass',
        title: 'Sitemap Freshness (lastmod)',
        finding: withLastmod.length === 0
          ? 'No lastmod dates in sitemap — search engines cannot assess content freshness'
          : `${withLastmod.length} URLs have lastmod: ${freshnessDistribution.recent7d} updated within 7d, ${freshnessDistribution.recent30d} within 30d, ${freshnessDistribution.recent90d} within 90d, ${freshnessDistribution.older} older`,
        recommendation: withLastmod.length === 0
          ? 'Add accurate lastmod dates to all sitemap URLs'
          : freshnessDistribution.older > withLastmod.length * 0.7
            ? 'Most URLs have stale lastmod dates — update them when content changes'
            : undefined,
        data: { withLastmod: withLastmod.length, distribution: freshnessDistribution },
      });

      // URL type breakdown
      const typeBreakdown: Record<string, number> = {};
      for (const u of urls) {
        const type = classifyUrl(u.loc);
        typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
      }

      checks.push({
        id: 'url_types',
        category: 'technical',
        severity: 'info',
        title: 'URL Type Distribution',
        finding: Object.entries(typeBreakdown)
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => `${type}: ${count}`)
          .join(', '),
        data: { breakdown: typeBreakdown },
      });

      // www vs non-www consistency
      let baseHost: string;
      try { baseHost = new URL(url).hostname; } catch { baseHost = ''; }
      const wwwUrls = urls.filter(u => {
        try { return new URL(u.loc).hostname.startsWith('www.'); } catch { return false; }
      });
      const nonWwwUrls = urls.filter(u => {
        try { return !new URL(u.loc).hostname.startsWith('www.'); } catch { return false; }
      });
      const hasMixed = wwwUrls.length > 0 && nonWwwUrls.length > 0;

      checks.push({
        id: 'www_consistency',
        category: 'technical',
        severity: hasMixed ? 'warning' : 'pass',
        title: 'WWW/Non-WWW Consistency',
        finding: hasMixed
          ? `Mixed www and non-www URLs: ${wwwUrls.length} www, ${nonWwwUrls.length} non-www`
          : `Consistent URL scheme: all ${wwwUrls.length > 0 ? 'www' : 'non-www'}`,
        recommendation: hasMixed
          ? 'Use a single canonical domain (www or non-www) consistently in the sitemap'
          : undefined,
        data: { www: wwwUrls.length, nonWww: nonWwwUrls.length },
      });

      const criticals = checks.filter(c => c.severity === 'critical').length;
      const warnings = checks.filter(c => c.severity === 'warning').length;
      const summary = criticals > 0
        ? `Sitemap analysis: ${criticals} critical, ${warnings} warning(s) across ${urls.length} URLs`
        : warnings > 0
          ? `Sitemap analysis: ${warnings} warning(s) across ${urls.length} URLs`
          : `Sitemap analysis: all checks passed for ${urls.length} URLs`;

      return toolResult(JSON.stringify(buildResult('seo_analyze_sitemap', url, checks, summary), null, 2));
    } catch (e) {
      return toolError(e);
    }
  });
}
