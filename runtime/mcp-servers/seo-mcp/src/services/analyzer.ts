/**
 * Cheerio-based HTML parsing utilities for SEO analysis.
 * All functions accept a CheerioAPI instance and extract structured data.
 */

import { load, type CheerioAPI } from 'cheerio';

export function parseHtml(html: string): CheerioAPI {
  return load(html, { xmlMode: false });
}

export interface MetaTags {
  title: string | null;
  description: string | null;
  canonical: string | null;
  robots: string | null;
  viewport: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  charset: string | null;
}

export function extractMeta($: CheerioAPI): MetaTags {
  return {
    title: $('title').first().text().trim() || null,
    description: $('meta[name="description"]').attr('content') || null,
    canonical: $('link[rel="canonical"]').attr('href') || null,
    robots: $('meta[name="robots"]').attr('content') || null,
    viewport: $('meta[name="viewport"]').attr('content') || null,
    ogTitle: $('meta[property="og:title"]').attr('content') || null,
    ogDescription: $('meta[property="og:description"]').attr('content') || null,
    ogImage: $('meta[property="og:image"]').attr('content') || null,
    charset: $('meta[charset]').attr('charset') || $('meta[http-equiv="Content-Type"]').attr('content') || null,
  };
}

export interface HeadingInfo {
  level: number;
  text: string;
}

export function extractHeadings($: CheerioAPI): HeadingInfo[] {
  const headings: HeadingInfo[] = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const tag = $(el).prop('tagName')?.toLowerCase() || '';
    const level = parseInt(tag.replace('h', ''), 10);
    headings.push({ level, text: $(el).text().trim() });
  });
  return headings;
}

export interface ImageInfo {
  src: string;
  alt: string | null;
  width: string | null;
  height: string | null;
  loading: string | null;
  srcset: string | null;
  sizes: string | null;
  format: string;
}

function guessFormat(src: string): string {
  const ext = src.split('?')[0]?.split('.').pop()?.toLowerCase() || '';
  if (['webp', 'avif', 'svg'].includes(ext)) return ext;
  if (['jpg', 'jpeg'].includes(ext)) return 'jpeg';
  if (ext === 'png') return 'png';
  if (ext === 'gif') return 'gif';
  return 'unknown';
}

export function extractImages($: CheerioAPI): ImageInfo[] {
  const images: ImageInfo[] = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    images.push({
      src,
      alt: $(el).attr('alt') ?? null,
      width: $(el).attr('width') || null,
      height: $(el).attr('height') || null,
      loading: $(el).attr('loading') || null,
      srcset: $(el).attr('srcset') || null,
      sizes: $(el).attr('sizes') || null,
      format: guessFormat(src),
    });
  });
  return images;
}

export interface LinkInfo {
  href: string;
  text: string;
  isInternal: boolean;
  rel: string | null;
  isNofollow: boolean;
}

export function extractLinks($: CheerioAPI, baseUrl: string): LinkInfo[] {
  const links: LinkInfo[] = [];
  let baseDomain: string;
  try { baseDomain = new URL(baseUrl).hostname; } catch { baseDomain = ''; }

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const rel = $(el).attr('rel') || null;
    let isInternal = false;
    try {
      const resolved = new URL(href, baseUrl);
      isInternal = resolved.hostname === baseDomain;
    } catch {
      isInternal = href.startsWith('/') || href.startsWith('#');
    }
    links.push({
      href,
      text: $(el).text().trim(),
      isInternal,
      rel,
      isNofollow: (rel || '').toLowerCase().includes('nofollow'),
    });
  });
  return links;
}

export interface SchemaBlock {
  type: string | string[];
  properties: Record<string, unknown>;
  raw: string;
}

export function extractJsonLd($: CheerioAPI): SchemaBlock[] {
  const blocks: SchemaBlock[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html() || '';
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : parsed['@graph'] ? parsed['@graph'] : [parsed];
      for (const item of items) {
        blocks.push({
          type: item['@type'] || 'Unknown',
          properties: item,
          raw,
        });
      }
    } catch { /* skip invalid JSON-LD */ }
  });
  return blocks;
}

export interface HreflangTag {
  hreflang: string;
  href: string;
}

export function extractHreflang($: CheerioAPI): HreflangTag[] {
  const tags: HreflangTag[] = [];
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    tags.push({
      hreflang: $(el).attr('hreflang') || '',
      href: $(el).attr('href') || '',
    });
  });
  return tags;
}

/** Extract visible body text (no scripts/styles). */
export function extractBodyText($: CheerioAPI): string {
  const clone = $.root().clone();
  clone.find('script, style, noscript').remove();
  return clone.find('body').text().replace(/\s+/g, ' ').trim();
}

/** Check for common SPA framework signatures. */
export function detectSpa($: CheerioAPI): { isSpa: boolean; framework: string | null } {
  if ($('#__next').length > 0) return { isSpa: true, framework: 'Next.js' };
  if ($('#__nuxt').length > 0) return { isSpa: true, framework: 'Nuxt' };
  if ($('#app[data-v-]').length > 0 || $('[data-v-]').length > 0) return { isSpa: true, framework: 'Vue' };
  if ($('#root').length > 0 && $('script').text().includes('react')) return { isSpa: true, framework: 'React' };
  return { isSpa: false, framework: null };
}
