/**
 * Tool 7: seo_analyze_images — Image optimization analysis.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolResult, toolError } from '@framework/mcp-shared';
import { parseHtml, extractImages } from '../services/analyzer.js';
import { buildResult, type CheckResult } from '../utils.js';

const MODERN_FORMATS = new Set(['webp', 'avif', 'svg']);
const OVERSIZED_THRESHOLD = 200 * 1024; // 200KB

export function registerImageTools(server: McpServer): void {
  server.tool('seo_analyze_images', 'Analyze images for SEO best practices (alt text, format, dimensions, lazy loading)', {
    html: z.string().describe('Full HTML content of the page'),
    url: z.string().url().describe('Page URL'),
    image_sizes: z.string().optional().describe('JSON map of image src to byte size (e.g. {"img.jpg": 250000})'),
  }, async ({ html, url, image_sizes }) => {
    try {
      const $ = parseHtml(html);
      const images = extractImages($);
      const checks: CheckResult[] = [];

      let sizeMap: Record<string, number> = {};
      if (image_sizes) {
        try { sizeMap = JSON.parse(image_sizes); } catch { /* ignore bad JSON */ }
      }

      if (images.length === 0) {
        checks.push({
          id: 'alt_text',
          category: 'images',
          severity: 'info',
          title: 'No Images Found',
          finding: 'No <img> tags detected on the page',
        });
        return toolResult(JSON.stringify(buildResult('seo_analyze_images', url, checks, 'No images found on page'), null, 2));
      }

      // alt_text
      const missingAlt = images.filter(img => img.alt === null || img.alt.trim() === '');
      checks.push({
        id: 'alt_text',
        category: 'images',
        severity: missingAlt.length === 0 ? 'pass' : missingAlt.length > images.length * 0.3 ? 'critical' : 'warning',
        title: 'Image Alt Text',
        finding: missingAlt.length === 0
          ? `All ${images.length} images have alt text`
          : `${missingAlt.length} of ${images.length} images missing alt text`,
        recommendation: missingAlt.length > 0
          ? `Add descriptive alt text to: ${missingAlt.slice(0, 5).map(i => i.src).join(', ')}${missingAlt.length > 5 ? ` and ${missingAlt.length - 5} more` : ''}`
          : undefined,
        data: { total: images.length, missing: missingAlt.length, missingSrcs: missingAlt.slice(0, 10).map(i => i.src) },
      });

      // format_modern
      const legacyFormat = images.filter(img => !MODERN_FORMATS.has(img.format) && img.format !== 'unknown');
      checks.push({
        id: 'format_modern',
        category: 'images',
        severity: legacyFormat.length === 0 ? 'pass' : legacyFormat.length > images.length * 0.5 ? 'warning' : 'info',
        title: 'Modern Image Formats',
        finding: legacyFormat.length === 0
          ? 'All images use modern formats (WebP/AVIF/SVG)'
          : `${legacyFormat.length} of ${images.length} images use legacy formats (JPEG/PNG/GIF)`,
        recommendation: legacyFormat.length > 0
          ? 'Convert JPEG/PNG images to WebP or AVIF for better compression'
          : undefined,
        data: {
          modern: images.length - legacyFormat.length,
          legacy: legacyFormat.length,
          legacySrcs: legacyFormat.slice(0, 5).map(i => ({ src: i.src, format: i.format })),
        },
      });

      // dimensions_set
      const noDimensions = images.filter(img => !img.width || !img.height);
      checks.push({
        id: 'dimensions_set',
        category: 'images',
        severity: noDimensions.length === 0 ? 'pass' : 'warning',
        title: 'Image Dimensions',
        finding: noDimensions.length === 0
          ? 'All images have explicit width and height attributes'
          : `${noDimensions.length} of ${images.length} images missing width/height attributes (causes CLS)`,
        recommendation: noDimensions.length > 0
          ? 'Add width and height attributes to all <img> tags to prevent Cumulative Layout Shift'
          : undefined,
        data: { missing: noDimensions.length },
      });

      // lazy_loading
      const firstImage = images[0];
      const restImages = images.slice(1);
      const firstImageEager = firstImage && (firstImage.loading === 'eager' || firstImage.loading === null);
      const lazyIssues: string[] = [];
      if (firstImage && firstImage.loading === 'lazy') {
        lazyIssues.push('First image (likely above-fold) has loading="lazy" — should be eager');
      }
      const belowFoldNoLazy = restImages.filter(img => img.loading !== 'lazy');
      if (belowFoldNoLazy.length > 0) {
        lazyIssues.push(`${belowFoldNoLazy.length} below-fold images missing loading="lazy"`);
      }
      checks.push({
        id: 'lazy_loading',
        category: 'images',
        severity: lazyIssues.length === 0 ? 'pass' : 'warning',
        title: 'Lazy Loading',
        finding: lazyIssues.length === 0
          ? 'Lazy loading properly configured'
          : lazyIssues.join('; '),
        recommendation: lazyIssues.length > 0
          ? 'Use loading="eager" for the first/hero image and loading="lazy" for below-fold images'
          : undefined,
        data: { firstImageEager, belowFoldMissingLazy: belowFoldNoLazy.length },
      });

      // oversized
      const oversized = images
        .filter(img => sizeMap[img.src] && sizeMap[img.src] > OVERSIZED_THRESHOLD)
        .map(img => ({ src: img.src, size: sizeMap[img.src] }));
      if (Object.keys(sizeMap).length > 0) {
        checks.push({
          id: 'oversized',
          category: 'images',
          severity: oversized.length === 0 ? 'pass' : 'warning',
          title: 'Oversized Images',
          finding: oversized.length === 0
            ? 'No images exceed 200KB'
            : `${oversized.length} image(s) exceed 200KB: ${oversized.slice(0, 3).map(o => `${o.src} (${Math.round(o.size / 1024)}KB)`).join(', ')}`,
          recommendation: oversized.length > 0
            ? 'Compress oversized images or serve responsive sizes. Target under 200KB per image.'
            : undefined,
          data: { oversized: oversized.slice(0, 10) },
        });
      } else {
        checks.push({
          id: 'oversized',
          category: 'images',
          severity: 'info',
          title: 'Oversized Images',
          finding: 'No image size data provided — cannot check for oversized images',
          recommendation: 'Pass image_sizes parameter for file size analysis',
        });
      }

      // responsive
      const noSrcset = images.filter(img => !img.srcset && !img.sizes);
      checks.push({
        id: 'responsive',
        category: 'images',
        severity: noSrcset.length === 0 ? 'pass' : noSrcset.length > images.length * 0.5 ? 'warning' : 'info',
        title: 'Responsive Images',
        finding: noSrcset.length === 0
          ? 'All images have srcset/sizes for responsive delivery'
          : `${noSrcset.length} of ${images.length} images lack srcset/sizes attributes`,
        recommendation: noSrcset.length > 0
          ? 'Add srcset and sizes attributes for responsive image delivery across device widths'
          : undefined,
        data: { withSrcset: images.length - noSrcset.length, without: noSrcset.length },
      });

      const criticals = checks.filter(c => c.severity === 'critical').length;
      const warnings = checks.filter(c => c.severity === 'warning').length;
      const summary = criticals > 0
        ? `Image analysis: ${criticals} critical, ${warnings} warning(s) across ${images.length} images`
        : warnings > 0
          ? `Image analysis: ${warnings} warning(s) across ${images.length} images`
          : `Image analysis: all checks passed for ${images.length} images`;

      return toolResult(JSON.stringify(buildResult('seo_analyze_images', url, checks, summary), null, 2));
    } catch (e) {
      return toolError(e);
    }
  });
}
