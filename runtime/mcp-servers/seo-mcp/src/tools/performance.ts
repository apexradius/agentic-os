/**
 * Performance analysis tools — Core Web Vitals and page weight analysis.
 * Tools 14-15.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolResult, toolError } from '@framework/mcp-shared';
import { type CheckResult, buildResult } from '../utils.js';

interface CwvThresholds {
  good: number;
  poor: number;
  unit: string;
  label: string;
}

const CWV: Record<string, CwvThresholds> = {
  lcp: { good: 2500, poor: 4000, unit: 'ms', label: 'Largest Contentful Paint (LCP)' },
  inp: { good: 200, poor: 500, unit: 'ms', label: 'Interaction to Next Paint (INP)' },
  fid: { good: 100, poor: 300, unit: 'ms', label: 'First Input Delay (FID)' },
  cls: { good: 0.1, poor: 0.25, unit: '', label: 'Cumulative Layout Shift (CLS)' },
  ttfb: { good: 800, poor: 1800, unit: 'ms', label: 'Time to First Byte (TTFB)' },
};

function rateCwv(metric: string, value: number): 'pass' | 'warning' | 'critical' {
  const thresholds = CWV[metric];
  if (!thresholds) return 'warning';
  if (value <= thresholds.good) return 'pass';
  if (value >= thresholds.poor) return 'critical';
  return 'warning';
}

function formatValue(metric: string, value: number): string {
  const thresholds = CWV[metric];
  if (!thresholds) return String(value);
  if (metric === 'cls') return value.toFixed(3);
  return `${Math.round(value)}${thresholds.unit}`;
}

export function registerPerformanceTools(server: McpServer): void {
  /* ── Tool 14: seo_analyze_performance ── */
  server.tool(
    'seo_analyze_performance',
    'Analyze Core Web Vitals metrics against Google thresholds (LCP, INP/FID, CLS, TTFB)',
    {
      performance_metrics: z.string().describe(
        'JSON string with metric values: {lcp?: number (ms), inp?: number (ms), fid?: number (ms), cls?: number, ttfb?: number (ms)}',
      ),
    },
    async ({ performance_metrics }) => {
      try {
        let metrics: Record<string, number>;
        try {
          metrics = JSON.parse(performance_metrics);
        } catch {
          return toolError('Invalid JSON for performance_metrics. Expected {lcp?, inp?, fid?, cls?, ttfb?}');
        }

        const checks: CheckResult[] = [];

        // LCP
        if (metrics.lcp !== undefined) {
          const severity = rateCwv('lcp', metrics.lcp);
          checks.push({
            id: 'lcp',
            category: 'performance',
            severity,
            title: CWV.lcp.label,
            finding: `LCP is ${formatValue('lcp', metrics.lcp)} (good: <2.5s, poor: >4s)`,
            recommendation: severity === 'pass'
              ? undefined
              : severity === 'warning'
                ? 'Optimize largest element load: preload hero image, reduce render-blocking resources, use fetchpriority="high" on LCP element.'
                : 'Critical LCP issue. Check: server response time, render-blocking JS/CSS, large hero images without preload, client-side rendering delays.',
            data: { value: metrics.lcp, threshold_good: 2500, threshold_poor: 4000 },
          });
        }

        // INP (preferred over FID)
        if (metrics.inp !== undefined) {
          const severity = rateCwv('inp', metrics.inp);
          checks.push({
            id: 'inp',
            category: 'performance',
            severity,
            title: CWV.inp.label,
            finding: `INP is ${formatValue('inp', metrics.inp)} (good: <200ms, poor: >500ms)`,
            recommendation: severity === 'pass'
              ? undefined
              : severity === 'warning'
                ? 'Reduce input delay: break up long tasks, yield to main thread, optimize event handlers.'
                : 'Critical INP issue. Audit JS for long tasks (>50ms), heavy event handlers, and layout thrashing during interactions.',
            data: { value: metrics.inp, threshold_good: 200, threshold_poor: 500 },
          });
        } else if (metrics.fid !== undefined) {
          const severity = rateCwv('fid', metrics.fid);
          checks.push({
            id: 'inp',
            category: 'performance',
            severity,
            title: CWV.fid.label,
            finding: `FID is ${formatValue('fid', metrics.fid)} (good: <100ms, poor: >300ms). Note: INP has replaced FID as the responsiveness metric.`,
            recommendation: severity === 'pass'
              ? undefined
              : 'Reduce first input delay by minimizing main-thread blocking JS. Consider code-splitting and deferring non-critical scripts.',
            data: { value: metrics.fid, threshold_good: 100, threshold_poor: 300 },
          });
        }

        // CLS
        if (metrics.cls !== undefined) {
          const severity = rateCwv('cls', metrics.cls);
          checks.push({
            id: 'cls',
            category: 'performance',
            severity,
            title: CWV.cls.label,
            finding: `CLS is ${formatValue('cls', metrics.cls)} (good: <0.1, poor: >0.25)`,
            recommendation: severity === 'pass'
              ? undefined
              : severity === 'warning'
                ? 'Set explicit width/height on images and embeds, avoid inserting content above the fold after load, use CSS contain where appropriate.'
                : 'Critical layout shift. Check: images/iframes without dimensions, dynamically injected content, web fonts causing FOIT/FOUT, ads/embeds without reserved space.',
            data: { value: metrics.cls, threshold_good: 0.1, threshold_poor: 0.25 },
          });
        }

        // TTFB
        if (metrics.ttfb !== undefined) {
          const severity = rateCwv('ttfb', metrics.ttfb);
          checks.push({
            id: 'total_blocking_time',
            category: 'performance',
            severity,
            title: CWV.ttfb.label,
            finding: `TTFB is ${formatValue('ttfb', metrics.ttfb)} (good: <800ms, poor: >1800ms)`,
            recommendation: severity === 'pass'
              ? undefined
              : severity === 'warning'
                ? 'Improve server response: enable caching, use a CDN, optimize database queries, consider edge rendering.'
                : 'Critical server delay. Audit: hosting infrastructure, DNS resolution, TLS negotiation, server-side processing time, database queries.',
            data: { value: metrics.ttfb, threshold_good: 800, threshold_poor: 1800 },
          });
        }

        if (checks.length === 0) {
          return toolError('No recognized metrics provided. Include at least one of: lcp, inp, fid, cls, ttfb');
        }

        const passed = checks.filter(c => c.severity === 'pass').length;
        const critical = checks.filter(c => c.severity === 'critical').length;
        const result = buildResult(
          'seo_analyze_performance',
          'N/A',
          checks,
          `Core Web Vitals: ${passed}/${checks.length} passing${critical > 0 ? `, ${critical} critical` : ''}`,
        );

        return toolResult(JSON.stringify(result, null, 2));
      } catch (e) {
        return toolError(e);
      }
    },
  );

  /* ── Tool 15: seo_page_weight_analysis ── */
  server.tool(
    'seo_page_weight_analysis',
    'Analyze page weight and resource breakdown by type, flag oversized resources',
    {
      resources: z.string().describe(
        'JSON array of resources: [{url: string, type: "js"|"css"|"image"|"font"|"html"|"other", size: number (bytes), compressedSize?: number}]',
      ),
    },
    async ({ resources: resourcesJson }) => {
      try {
        let resources: Array<{ url: string; type: string; size: number; compressedSize?: number }>;
        try {
          resources = JSON.parse(resourcesJson);
        } catch {
          return toolError('Invalid JSON for resources. Expected array of {url, type, size, compressedSize?}');
        }

        if (!Array.isArray(resources) || resources.length === 0) {
          return toolError('resources must be a non-empty JSON array');
        }

        const checks: CheckResult[] = [];

        // Calculate totals by type
        const byType: Record<string, { count: number; size: number; compressed: number }> = {};
        let totalSize = 0;
        let totalCompressed = 0;

        for (const r of resources) {
          const type = r.type || 'other';
          if (!byType[type]) byType[type] = { count: 0, size: 0, compressed: 0 };
          byType[type].count++;
          byType[type].size += r.size;
          byType[type].compressed += r.compressedSize ?? r.size;
          totalSize += r.size;
          totalCompressed += r.compressedSize ?? r.size;
        }

        const formatBytes = (bytes: number): string => {
          if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
          if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`;
          return `${bytes}B`;
        };

        // Total page weight check
        const totalMB = totalSize / (1024 * 1024);
        const weightSeverity: CheckResult['severity'] = totalMB > 3 ? 'critical' : totalMB > 1.5 ? 'warning' : 'pass';
        const breakdown = Object.entries(byType)
          .sort(([, a], [, b]) => b.size - a.size)
          .map(([type, data]) => `${type}: ${formatBytes(data.size)} (${data.count} files)`)
          .join(', ');

        checks.push({
          id: 'page_weight',
          category: 'performance',
          severity: weightSeverity,
          title: 'Total Page Weight',
          finding: `Total: ${formatBytes(totalSize)}${totalCompressed < totalSize ? ` (${formatBytes(totalCompressed)} compressed)` : ''}. Breakdown: ${breakdown}`,
          recommendation: weightSeverity === 'pass'
            ? undefined
            : weightSeverity === 'warning'
              ? 'Page is moderately heavy. Consider lazy-loading below-fold images, code-splitting JS, and compressing assets.'
              : 'Page exceeds 3MB. Aggressively optimize: compress images (WebP/AVIF), tree-shake JS, purge unused CSS, defer non-critical resources.',
          data: {
            total_bytes: totalSize,
            compressed_bytes: totalCompressed,
            by_type: byType,
            resource_count: resources.length,
          },
        });

        // Resource-specific flags
        const hints: string[] = [];

        // JS budget check
        const jsSize = byType['js']?.size || 0;
        if (jsSize > 500 * 1024) {
          hints.push(`JavaScript is ${formatBytes(jsSize)} — exceeds 500KB budget. Code-split, tree-shake, and defer non-critical scripts.`);
        }

        // CSS budget check
        const cssSize = byType['css']?.size || 0;
        if (cssSize > 200 * 1024) {
          hints.push(`CSS is ${formatBytes(cssSize)} — exceeds 200KB budget. Purge unused styles, split critical/non-critical CSS.`);
        }

        // Find largest individual resources
        const sorted = [...resources].sort((a, b) => b.size - a.size);
        const largest = sorted.slice(0, 5);
        const largeResources = largest
          .filter(r => r.size > 100 * 1024)
          .map(r => `${r.url.split('/').pop() || r.url} (${r.type}): ${formatBytes(r.size)}`);

        if (largeResources.length > 0) {
          hints.push(`Largest resources: ${largeResources.join('; ')}`);
        }

        // Image optimization hints
        const images = resources.filter(r => r.type === 'image');
        const largeImages = images.filter(r => r.size > 200 * 1024);
        if (largeImages.length > 0) {
          hints.push(`${largeImages.length} image(s) over 200KB. Use WebP/AVIF, responsive srcset, and lazy-loading.`);
        }

        // Font check
        const fonts = resources.filter(r => r.type === 'font');
        if (fonts.length > 4) {
          hints.push(`${fonts.length} font files loaded. Consider reducing to 2-3 variants and using font-display: swap.`);
        }

        const hintSeverity: CheckResult['severity'] = hints.length > 3 ? 'warning' : hints.length > 0 ? 'info' : 'pass';
        checks.push({
          id: 'resource_hints',
          category: 'performance',
          severity: hintSeverity,
          title: 'Resource Optimization Hints',
          finding: hints.length > 0 ? hints.join(' | ') : 'No major resource optimization issues detected.',
          recommendation: hints.length > 0
            ? 'Address the flagged resources to improve load times and Core Web Vitals scores.'
            : undefined,
          data: {
            js_bytes: jsSize,
            css_bytes: cssSize,
            image_count: images.length,
            font_count: fonts.length,
            largest_resources: largest.map(r => ({ url: r.url, type: r.type, size: r.size })),
          },
        });

        const result = buildResult(
          'seo_page_weight_analysis',
          'N/A',
          checks,
          `Page weight: ${formatBytes(totalSize)} across ${resources.length} resources. ${hints.length} optimization hint(s).`,
        );

        return toolResult(JSON.stringify(result, null, 2));
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
