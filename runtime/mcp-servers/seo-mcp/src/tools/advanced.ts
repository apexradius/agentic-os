/**
 * Advanced SEO tools — hreflang analysis, redirect chain checking, security headers.
 * Tools 21-23.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolResult, toolError } from '@framework/mcp-shared';
import { type CheckResult, buildResult } from '../utils.js';
import { parseHtml, extractHreflang } from '../services/analyzer.js';

/** Valid ISO 639-1 language codes (common subset). */
const VALID_LANG_CODES = new Set([
  'aa', 'ab', 'af', 'ak', 'am', 'an', 'ar', 'as', 'av', 'ay', 'az',
  'ba', 'be', 'bg', 'bh', 'bi', 'bm', 'bn', 'bo', 'br', 'bs',
  'ca', 'ce', 'ch', 'co', 'cr', 'cs', 'cu', 'cv', 'cy',
  'da', 'de', 'dv', 'dz',
  'ee', 'el', 'en', 'eo', 'es', 'et', 'eu',
  'fa', 'ff', 'fi', 'fj', 'fo', 'fr', 'fy',
  'ga', 'gd', 'gl', 'gn', 'gu', 'gv',
  'ha', 'he', 'hi', 'ho', 'hr', 'ht', 'hu', 'hy', 'hz',
  'ia', 'id', 'ie', 'ig', 'ii', 'ik', 'io', 'is', 'it', 'iu',
  'ja', 'jv',
  'ka', 'kg', 'ki', 'kj', 'kk', 'kl', 'km', 'kn', 'ko', 'kr', 'ks', 'ku', 'kv', 'kw', 'ky',
  'la', 'lb', 'lg', 'li', 'ln', 'lo', 'lt', 'lu', 'lv',
  'mg', 'mh', 'mi', 'mk', 'ml', 'mn', 'mr', 'ms', 'mt', 'my',
  'na', 'nb', 'nd', 'ne', 'ng', 'nl', 'nn', 'no', 'nr', 'nv', 'ny',
  'oc', 'oj', 'om', 'or', 'os',
  'pa', 'pi', 'pl', 'ps', 'pt',
  'qu',
  'rm', 'rn', 'ro', 'ru', 'rw',
  'sa', 'sc', 'sd', 'se', 'sg', 'si', 'sk', 'sl', 'sm', 'sn', 'so', 'sq', 'sr', 'ss', 'st', 'su', 'sv', 'sw',
  'ta', 'te', 'tg', 'th', 'ti', 'tk', 'tl', 'tn', 'to', 'tr', 'ts', 'tt', 'tw', 'ty',
  'ug', 'uk', 'ur', 'uz',
  've', 'vi', 'vo',
  'wa', 'wo',
  'xh',
  'yi', 'yo',
  'za', 'zh', 'zu',
]);

function isValidLangCode(code: string): boolean {
  if (code === 'x-default') return true;
  // Handle language-region (e.g., en-US, pt-BR, zh-Hans-CN)
  const lang = code.split('-')[0].toLowerCase();
  return VALID_LANG_CODES.has(lang);
}

export function registerAdvancedTools(server: McpServer): void {
  /* ── Tool 21: seo_analyze_hreflang ── */
  server.tool(
    'seo_analyze_hreflang',
    'Analyze hreflang implementation for international SEO — checks self-referencing, x-default, valid codes, and return tags',
    {
      html: z.string().describe('Full HTML of the page'),
      url: z.string().url().describe('URL of the page being analyzed'),
    },
    async ({ html, url }) => {
      try {
        const $ = parseHtml(html);
        const tags = extractHreflang($);
        const checks: CheckResult[] = [];

        if (tags.length === 0) {
          checks.push({
            id: 'hreflang',
            category: 'international',
            severity: 'info',
            title: 'Hreflang Tags',
            finding: 'No hreflang tags found. Not required for single-language sites.',
            recommendation: 'If this site serves multiple languages or regions, add hreflang tags to signal language/region variants to search engines.',
          });

          const result = buildResult('seo_analyze_hreflang', url, checks, 'No hreflang tags present.');
          return toolResult(JSON.stringify(result, null, 2));
        }

        const issues: string[] = [];
        const details: string[] = [];

        // Check self-referencing tag
        const normalizedUrl = url.replace(/\/$/, '');
        const hasSelfRef = tags.some(t => t.href.replace(/\/$/, '') === normalizedUrl);
        if (!hasSelfRef) {
          issues.push('Missing self-referencing hreflang tag — the current page URL must be included in its own hreflang set.');
        }

        // Check x-default
        const hasXDefault = tags.some(t => t.hreflang === 'x-default');
        if (!hasXDefault) {
          issues.push('Missing x-default hreflang tag — recommended for specifying the default/fallback page for unmatched languages.');
        }

        // Validate language codes
        const invalidCodes: string[] = [];
        for (const tag of tags) {
          if (!isValidLangCode(tag.hreflang)) {
            invalidCodes.push(tag.hreflang);
          }
        }
        if (invalidCodes.length > 0) {
          issues.push(`Invalid language codes: ${invalidCodes.join(', ')}. Use ISO 639-1 codes (e.g., "en", "fr", "de") with optional region (e.g., "en-US", "pt-BR").`);
        }

        // Check for duplicate language codes
        const codeCounts = new Map<string, number>();
        for (const tag of tags) {
          codeCounts.set(tag.hreflang, (codeCounts.get(tag.hreflang) || 0) + 1);
        }
        const duplicates = [...codeCounts.entries()].filter(([, c]) => c > 1).map(([code]) => code);
        if (duplicates.length > 0) {
          issues.push(`Duplicate hreflang codes: ${duplicates.join(', ')}. Each language-region pair should appear only once.`);
        }

        // List all tags found
        for (const tag of tags) {
          details.push(`${tag.hreflang}: ${tag.href}`);
        }

        // Note about return tag validation
        details.push('');
        details.push('Note: Return tag validation (confirming each linked page references back to this page) requires fetching those pages — verify manually or with a crawler.');

        const severity: CheckResult['severity'] =
          invalidCodes.length > 0 || !hasSelfRef ? 'critical' :
          !hasXDefault || duplicates.length > 0 ? 'warning' : 'pass';

        checks.push({
          id: 'hreflang',
          category: 'international',
          severity,
          title: 'Hreflang Implementation',
          finding: [
            `Found ${tags.length} hreflang tag(s).`,
            hasSelfRef ? 'Self-referencing tag present.' : 'Self-referencing tag MISSING.',
            hasXDefault ? 'x-default present.' : 'x-default MISSING.',
            invalidCodes.length > 0 ? `${invalidCodes.length} invalid code(s).` : 'All codes valid.',
            '',
            'Tags:',
            ...details,
            ...(issues.length > 0 ? ['', 'Issues:', ...issues.map(i => `- ${i}`)] : []),
          ].join('\n'),
          recommendation: issues.length > 0
            ? issues.join(' ')
            : undefined,
          data: {
            tag_count: tags.length,
            has_self_ref: hasSelfRef,
            has_x_default: hasXDefault,
            invalid_codes: invalidCodes,
            duplicates,
            tags: tags.map(t => ({ hreflang: t.hreflang, href: t.href })),
          },
        });

        const result = buildResult(
          'seo_analyze_hreflang',
          url,
          checks,
          `Hreflang: ${tags.length} tags, ${issues.length} issue(s)`,
        );
        return toolResult(JSON.stringify(result, null, 2));
      } catch (e) {
        return toolError(e);
      }
    },
  );

  /* ── Tool 22: seo_check_redirects ── */
  server.tool(
    'seo_check_redirects',
    'Analyze a redirect chain for SEO issues — chain length, status codes, mixed protocols',
    {
      redirect_chain: z.string().describe(
        'JSON array of redirect hops: [{url: string, status: number, location: string}]',
      ),
    },
    async ({ redirect_chain }) => {
      try {
        let chain: Array<{ url: string; status: number; location: string }>;
        try {
          chain = JSON.parse(redirect_chain);
        } catch {
          return toolError('Invalid JSON for redirect_chain. Expected array of {url, status, location}');
        }

        if (!Array.isArray(chain) || chain.length === 0) {
          return toolError('redirect_chain must be a non-empty JSON array');
        }

        const checks: CheckResult[] = [];
        const issues: string[] = [];

        // Chain length analysis
        const chainLength = chain.length;
        const chainSeverity: CheckResult['severity'] =
          chainLength > 3 ? 'critical' :
          chainLength > 1 ? 'warning' : 'pass';

        if (chainLength > 3) {
          issues.push(`Redirect chain has ${chainLength} hops — exceeds 3-hop maximum. Long chains waste crawl budget and increase latency.`);
        } else if (chainLength > 1) {
          issues.push(`Redirect chain has ${chainLength} hops. Ideal is a single direct redirect (1 hop).`);
        }

        // Mixed HTTP/HTTPS check
        const urls = chain.map(c => c.url).concat(chain[chain.length - 1].location);
        const hasHttp = urls.some(u => u.startsWith('http://'));
        const hasHttps = urls.some(u => u.startsWith('https://'));
        if (hasHttp && hasHttps) {
          issues.push('Mixed HTTP/HTTPS in redirect chain. Consolidate to HTTPS-only redirects to avoid unnecessary hops.');
        }

        // 302 vs 301 analysis
        const temporaryRedirects = chain.filter(c => c.status === 302 || c.status === 307);
        const permanentRedirects = chain.filter(c => c.status === 301 || c.status === 308);
        if (temporaryRedirects.length > 0) {
          const tempUrls = temporaryRedirects.map(c => `${c.url} (${c.status})`).join(', ');
          issues.push(`Temporary redirect(s) detected: ${tempUrls}. If these are permanent moves, use 301/308 so search engines transfer ranking signals.`);
        }

        // Build chain visualization
        const chainViz = chain.map((hop, i) =>
          `${i + 1}. ${hop.url} → ${hop.status} → ${hop.location}`,
        ).join('\n');

        checks.push({
          id: 'redirect_chains',
          category: 'technical',
          severity: chainSeverity,
          title: 'Redirect Chain Analysis',
          finding: [
            `Chain length: ${chainLength} hop(s)`,
            `Permanent (301/308): ${permanentRedirects.length}`,
            `Temporary (302/307): ${temporaryRedirects.length}`,
            `Mixed protocols: ${hasHttp && hasHttps ? 'Yes' : 'No'}`,
            '',
            'Chain:',
            chainViz,
            ...(issues.length > 0 ? ['', 'Issues:', ...issues.map(i => `- ${i}`)] : []),
          ].join('\n'),
          recommendation: issues.length > 0
            ? 'Consolidate redirect chains to a single 301 redirect pointing directly to the final destination URL. Remove intermediate hops.'
            : undefined,
          data: {
            chain_length: chainLength,
            permanent_count: permanentRedirects.length,
            temporary_count: temporaryRedirects.length,
            mixed_protocols: hasHttp && hasHttps,
            final_url: chain[chain.length - 1].location,
            chain: chain.map(c => ({ url: c.url, status: c.status, location: c.location })),
          },
        });

        const firstUrl = chain[0].url;
        const result = buildResult(
          'seo_check_redirects',
          firstUrl,
          checks,
          `Redirect chain: ${chainLength} hop(s), ${issues.length} issue(s)`,
        );
        return toolResult(JSON.stringify(result, null, 2));
      } catch (e) {
        return toolError(e);
      }
    },
  );

  /* ── Tool 23: seo_analyze_headers ── */
  server.tool(
    'seo_analyze_headers',
    'Analyze HTTP response headers for security and caching best practices (HSTS, CSP, X-Content-Type-Options, Cache-Control, CORS)',
    {
      headers: z.string().describe('JSON string of HTTP response headers as key-value pairs'),
    },
    async ({ headers: headersJson }) => {
      try {
        let headers: Record<string, string>;
        try {
          headers = JSON.parse(headersJson);
        } catch {
          return toolError('Invalid JSON for headers. Expected key-value pairs of HTTP headers');
        }

        // Normalize header keys to lowercase for comparison
        const normalized: Record<string, string> = {};
        for (const [key, value] of Object.entries(headers)) {
          normalized[key.toLowerCase()] = value;
        }

        const checks: CheckResult[] = [];
        const securityIssues: string[] = [];
        const securityPasses: string[] = [];

        // HSTS (Strict-Transport-Security)
        const hsts = normalized['strict-transport-security'];
        if (hsts) {
          const maxAgeMatch = hsts.match(/max-age=(\d+)/);
          const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 0;
          const hasSubdomains = hsts.includes('includeSubDomains');
          const hasPreload = hsts.includes('preload');

          if (maxAge >= 31536000 && hasSubdomains) {
            securityPasses.push(`HSTS enabled (max-age=${maxAge}${hasSubdomains ? ', includeSubDomains' : ''}${hasPreload ? ', preload' : ''})`);
          } else if (maxAge > 0) {
            securityIssues.push(`HSTS present but weak: max-age=${maxAge}${maxAge < 31536000 ? ' (should be ≥31536000)' : ''}${!hasSubdomains ? ', missing includeSubDomains' : ''}`);
          }
        } else {
          securityIssues.push('Missing Strict-Transport-Security header — enables HTTPS downgrade attacks.');
        }

        // CSP (Content-Security-Policy)
        const csp = normalized['content-security-policy'];
        if (csp) {
          const hasUnsafeInline = csp.includes("'unsafe-inline'");
          const hasUnsafeEval = csp.includes("'unsafe-eval'");
          if (hasUnsafeInline || hasUnsafeEval) {
            securityIssues.push(`CSP present but weakened by ${[hasUnsafeInline && "'unsafe-inline'", hasUnsafeEval && "'unsafe-eval'"].filter(Boolean).join(' and ')}`);
          } else {
            securityPasses.push('Content-Security-Policy present and does not use unsafe directives');
          }
        } else {
          securityIssues.push('Missing Content-Security-Policy header — no XSS mitigation at transport layer.');
        }

        // X-Content-Type-Options
        const xcto = normalized['x-content-type-options'];
        if (xcto?.toLowerCase() === 'nosniff') {
          securityPasses.push('X-Content-Type-Options: nosniff');
        } else {
          securityIssues.push('Missing or incorrect X-Content-Type-Options (should be "nosniff") — allows MIME-type sniffing attacks.');
        }

        // X-Frame-Options
        const xfo = normalized['x-frame-options'];
        if (xfo) {
          securityPasses.push(`X-Frame-Options: ${xfo}`);
        } else {
          // Check CSP frame-ancestors as alternative
          if (csp?.includes('frame-ancestors')) {
            securityPasses.push('Clickjacking protection via CSP frame-ancestors');
          } else {
            securityIssues.push('Missing X-Frame-Options and no CSP frame-ancestors — vulnerable to clickjacking.');
          }
        }

        // Cache-Control analysis
        const cacheControl = normalized['cache-control'];
        const cacheDetails: string[] = [];
        if (cacheControl) {
          const directives = cacheControl.split(',').map(d => d.trim().toLowerCase());
          const hasNoStore = directives.some(d => d === 'no-store');
          const hasNoCache = directives.some(d => d === 'no-cache');
          const hasPublic = directives.some(d => d === 'public');
          const hasPrivate = directives.some(d => d === 'private');
          const maxAgeDir = directives.find(d => d.startsWith('max-age='));
          const sMaxAge = directives.find(d => d.startsWith('s-maxage='));

          cacheDetails.push(`Cache-Control: ${cacheControl}`);
          if (hasNoStore) cacheDetails.push('No caching (no-store)');
          if (hasNoCache) cacheDetails.push('Revalidation required (no-cache)');
          if (hasPublic) cacheDetails.push('Cacheable by CDN/proxy (public)');
          if (hasPrivate) cacheDetails.push('Browser-only caching (private)');
          if (maxAgeDir) cacheDetails.push(`Browser cache TTL: ${maxAgeDir}`);
          if (sMaxAge) cacheDetails.push(`CDN cache TTL: ${sMaxAge}`);

          if (!hasNoStore && !maxAgeDir && !hasNoCache) {
            cacheDetails.push('Warning: No max-age or no-cache — caching behavior is browser-dependent.');
          }
        } else {
          cacheDetails.push('No Cache-Control header — caching behavior undefined, defaults vary by browser.');
        }

        // CORS
        const corsOrigin = normalized['access-control-allow-origin'];
        const corsDetails: string[] = [];
        if (corsOrigin) {
          if (corsOrigin === '*') {
            corsDetails.push('CORS: Allow all origins (*) — appropriate for public APIs, risky for authenticated endpoints.');
          } else {
            corsDetails.push(`CORS: Restricted to ${corsOrigin}`);
          }
          const corsMethods = normalized['access-control-allow-methods'];
          if (corsMethods) corsDetails.push(`Allowed methods: ${corsMethods}`);
        }

        // Build the security headers check
        const severity: CheckResult['severity'] =
          securityIssues.length >= 3 ? 'critical' :
          securityIssues.length > 0 ? 'warning' : 'pass';

        checks.push({
          id: 'security_headers',
          category: 'security',
          severity,
          title: 'HTTP Security & Cache Headers',
          finding: [
            `Security headers: ${securityPasses.length} present, ${securityIssues.length} missing/weak`,
            '',
            ...(securityPasses.length > 0 ? ['Passing:', ...securityPasses.map(p => `  + ${p}`), ''] : []),
            ...(securityIssues.length > 0 ? ['Issues:', ...securityIssues.map(i => `  - ${i}`), ''] : []),
            'Caching:',
            ...cacheDetails.map(d => `  ${d}`),
            ...(corsDetails.length > 0 ? ['', 'CORS:', ...corsDetails.map(d => `  ${d}`)] : []),
          ].join('\n'),
          recommendation: securityIssues.length > 0
            ? `Add missing security headers: ${securityIssues.map(i => i.split(' —')[0].replace('Missing ', '').replace(' or incorrect', '')).join(', ')}.`
            : undefined,
          data: {
            hsts: !!hsts,
            csp: !!csp,
            x_content_type_options: xcto?.toLowerCase() === 'nosniff',
            x_frame_options: !!xfo,
            cache_control: cacheControl || null,
            cors_origin: corsOrigin || null,
            issues_count: securityIssues.length,
            passes_count: securityPasses.length,
          },
        });

        const result = buildResult(
          'seo_analyze_headers',
          'N/A',
          checks,
          `Headers: ${securityPasses.length} passing, ${securityIssues.length} issue(s)`,
        );
        return toolResult(JSON.stringify(result, null, 2));
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
