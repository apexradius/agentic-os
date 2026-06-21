/**
 * Generator tools — JSON-LD schema, XML sitemap, robots.txt generation.
 * Tools 11-13.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolResult, toolError } from '@framework/mcp-shared';

const SCHEMA_TYPES = [
  'Organization',
  'Product',
  'Article',
  'FAQ',
  'BreadcrumbList',
  'LocalBusiness',
  'Service',
] as const;

type SchemaType = (typeof SCHEMA_TYPES)[number];

function buildOrganization(info: Record<string, string>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: info.name || 'Organization Name',
    url: info.url || 'https://example.com',
    logo: info.logo || 'https://example.com/logo.png',
    sameAs: info.sameAs ? info.sameAs.split(',').map(s => s.trim()) : [],
    ...(info.description && { description: info.description }),
    ...(info.email && { email: info.email }),
    ...(info.phone && { telephone: info.phone }),
  };
}

function buildProduct(info: Record<string, string>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: info.name || 'Product Name',
    description: info.description || 'Product description',
    image: info.image || 'https://example.com/product.jpg',
    brand: info.brand ? { '@type': 'Brand', name: info.brand } : undefined,
    offers: {
      '@type': 'Offer',
      price: info.price || '0.00',
      priceCurrency: info.currency || 'USD',
      availability: info.availability || 'https://schema.org/InStock',
      url: info.url || 'https://example.com/product',
    },
    ...(info.sku && { sku: info.sku }),
    ...(info.gtin && { gtin: info.gtin }),
  };
}

function buildArticle(info: Record<string, string>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: info.headline || info.name || 'Article Title',
    author: {
      '@type': info.authorType || 'Person',
      name: info.author || 'Author Name',
    },
    datePublished: info.datePublished || new Date().toISOString().split('T')[0],
    ...(info.dateModified && { dateModified: info.dateModified }),
    image: info.image || 'https://example.com/article.jpg',
    publisher: {
      '@type': 'Organization',
      name: info.publisher || info.author || 'Publisher',
      ...(info.publisherLogo && {
        logo: { '@type': 'ImageObject', url: info.publisherLogo },
      }),
    },
    ...(info.description && { description: info.description }),
    ...(info.url && { mainEntityOfPage: { '@type': 'WebPage', '@id': info.url } }),
  };
}

function buildFAQ(info: Record<string, string>): Record<string, unknown> {
  // Parse Q&A pairs from business_info: "Q: question | A: answer" separated by semicolons
  const pairs: Array<Record<string, unknown>> = [];
  const raw = info.questions || info.qa || '';
  if (raw) {
    const items = raw.split(';').map(s => s.trim()).filter(Boolean);
    for (const item of items) {
      const qMatch = item.match(/Q:\s*(.+?)\s*\|\s*A:\s*(.+)/i);
      if (qMatch) {
        pairs.push({
          '@type': 'Question',
          name: qMatch[1].trim(),
          acceptedAnswer: {
            '@type': 'Answer',
            text: qMatch[2].trim(),
          },
        });
      }
    }
  }

  // Add placeholder if no pairs parsed
  if (pairs.length === 0) {
    pairs.push({
      '@type': 'Question',
      name: 'What is your question?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Replace this with your answer.',
      },
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pairs,
  };
}

function buildBreadcrumbList(info: Record<string, string>): Record<string, unknown> {
  // Parse breadcrumbs from "label:url" pairs separated by semicolons
  const raw = info.items || info.breadcrumbs || '';
  const items = raw
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
    .map((item, i) => {
      const [name, url] = item.split(':').length > 2
        ? [item.split(':')[0], item.slice(item.indexOf(':') + 1)]
        : item.includes('|')
          ? item.split('|').map(s => s.trim())
          : [item, ''];
      return {
        '@type': 'ListItem',
        position: i + 1,
        name: name.trim(),
        ...(url && { item: url.trim() }),
      };
    });

  if (items.length === 0) {
    items.push({ '@type': 'ListItem', position: 1, name: 'Home', item: info.url || 'https://example.com' });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}

function buildLocalBusiness(info: Record<string, string>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: info.name || 'Business Name',
    url: info.url || 'https://example.com',
    ...(info.image && { image: info.image }),
    ...(info.phone && { telephone: info.phone }),
    ...(info.email && { email: info.email }),
    ...(info.priceRange && { priceRange: info.priceRange }),
    address: {
      '@type': 'PostalAddress',
      streetAddress: info.street || '123 Main St',
      addressLocality: info.city || 'City',
      addressRegion: info.region || 'State',
      postalCode: info.postalCode || '00000',
      addressCountry: info.country || 'US',
    },
    ...(info.lat && info.lng && {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: parseFloat(info.lat),
        longitude: parseFloat(info.lng),
      },
    }),
    ...(info.hours && {
      openingHoursSpecification: info.hours.split(';').map(s => s.trim()).filter(Boolean).map(h => {
        const [days, time] = h.split(' ', 2);
        const [opens, closes] = (time || '09:00-17:00').split('-');
        return {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: days.split(',').map(d => d.trim()),
          opens,
          closes,
        };
      }),
    }),
  };
}

function buildService(info: Record<string, string>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: info.name || 'Service Name',
    description: info.description || 'Service description',
    ...(info.url && { url: info.url }),
    ...(info.image && { image: info.image }),
    provider: {
      '@type': 'Organization',
      name: info.provider || info.name || 'Provider',
      ...(info.providerUrl && { url: info.providerUrl }),
    },
    ...(info.areaServed && { areaServed: info.areaServed }),
    ...(info.price && {
      offers: {
        '@type': 'Offer',
        price: info.price,
        priceCurrency: info.currency || 'USD',
      },
    }),
    ...(info.serviceType && { serviceType: info.serviceType }),
  };
}

const BUILDERS: Record<SchemaType, (info: Record<string, string>) => Record<string, unknown>> = {
  Organization: buildOrganization,
  Product: buildProduct,
  Article: buildArticle,
  FAQ: buildFAQ,
  BreadcrumbList: buildBreadcrumbList,
  LocalBusiness: buildLocalBusiness,
  Service: buildService,
};

function parseBusinessInfo(raw?: string): Record<string, string> {
  if (!raw) return {};
  const result: Record<string, string> = {};
  // Try JSON first
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      for (const [k, v] of Object.entries(parsed)) {
        result[k] = String(v);
      }
      return result;
    }
  } catch { /* not JSON, try key=value */ }
  // key=value pairs separated by semicolons or newlines
  const pairs = raw.split(/[;\n]/).map(s => s.trim()).filter(Boolean);
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx > 0) {
      result[pair.slice(0, eqIdx).trim()] = pair.slice(eqIdx + 1).trim();
    }
  }
  return result;
}

export function registerGeneratorTools(server: McpServer): void {
  /* ── Tool 11: seo_generate_schema ── */
  server.tool(
    'seo_generate_schema',
    'Generate JSON-LD structured data for a given schema type (Organization, Product, Article, FAQ, BreadcrumbList, LocalBusiness, Service)',
    {
      url: z.string().url().describe('Page URL for the schema'),
      schema_type: z.enum(SCHEMA_TYPES).describe('Schema.org type to generate'),
      business_info: z.string().optional().describe(
        'Business details as JSON or key=value pairs separated by semicolons. Keys depend on type: Organization(name,url,logo,sameAs,description,email,phone), Product(name,description,image,brand,price,currency,sku,url,availability), Article(headline,author,datePublished,dateModified,image,publisher,publisherLogo,description,url), FAQ(questions as "Q: q | A: a; Q: q2 | A: a2"), BreadcrumbList(items as "label|url; label2|url2"), LocalBusiness(name,url,phone,email,street,city,region,postalCode,country,lat,lng,hours,priceRange), Service(name,description,url,provider,areaServed,price,currency,serviceType)',
      ),
    },
    async ({ url, schema_type, business_info }) => {
      try {
        const info = parseBusinessInfo(business_info);
        if (!info.url) info.url = url;

        const builder = BUILDERS[schema_type];
        const jsonLd = builder(info);
        const script = `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>`;

        return toolResult(
          `Generated ${schema_type} JSON-LD for ${url}:\n\n${script}\n\nValidation: Paste into https://search.google.com/test/rich-results to verify.`,
        );
      } catch (e) {
        return toolError(e);
      }
    },
  );

  /* ── Tool 12: seo_generate_sitemap ── */
  server.tool(
    'seo_generate_sitemap',
    'Generate a valid XML sitemap from a list of URLs',
    {
      urls: z.string().describe(
        'JSON array of URL entries: [{loc: "https://...", lastmod?: "2024-01-01", priority?: 0.8, changefreq?: "weekly"}]',
      ),
      domain: z.string().describe('Domain for the sitemap (e.g., "example.com")'),
    },
    async ({ urls, domain }) => {
      try {
        let entries: Array<{ loc: string; lastmod?: string; priority?: number; changefreq?: string }>;
        try {
          entries = JSON.parse(urls);
        } catch {
          return toolError('Invalid JSON for urls parameter. Expected array of {loc, lastmod?, priority?, changefreq?}');
        }

        if (!Array.isArray(entries) || entries.length === 0) {
          return toolError('urls must be a non-empty JSON array');
        }

        const urlEntries = entries.map(entry => {
          const parts = [`    <loc>${escapeXml(entry.loc)}</loc>`];
          if (entry.lastmod) parts.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
          if (entry.changefreq) parts.push(`    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`);
          if (entry.priority !== undefined) parts.push(`    <priority>${entry.priority}</priority>`);
          return `  <url>\n${parts.join('\n')}\n  </url>`;
        });

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...urlEntries,
          '</urlset>',
        ].join('\n');

        return toolResult(
          `Generated XML sitemap for ${domain} (${entries.length} URLs):\n\n${xml}`,
        );
      } catch (e) {
        return toolError(e);
      }
    },
  );

  /* ── Tool 13: seo_generate_robots ── */
  server.tool(
    'seo_generate_robots',
    'Generate robots.txt content with optional AI crawler directives',
    {
      domain: z.string().describe('Domain (e.g., "example.com")'),
      sitemap_url: z.string().optional().describe('Full sitemap URL to include'),
      block_ai_crawlers: z.boolean().optional().describe(
        'If true, block AI crawlers (GPTBot, ClaudeBot, etc). Default: false (allow them)',
      ),
    },
    async ({ domain, sitemap_url, block_ai_crawlers }) => {
      try {
        const lines: string[] = [
          '# robots.txt',
          `# Generated for ${domain}`,
          '',
          'User-agent: *',
          'Allow: /',
          '',
        ];

        const aiCrawlers = [
          'GPTBot',
          'ChatGPT-User',
          'ClaudeBot',
          'Claude-Web',
          'Anthropic-AI',
          'Google-Extended',
          'CCBot',
          'PerplexityBot',
          'Bytespider',
          'Cohere-AI',
        ];

        if (block_ai_crawlers) {
          lines.push('# Block AI crawlers');
          for (const bot of aiCrawlers) {
            lines.push(`User-agent: ${bot}`);
            lines.push('Disallow: /');
            lines.push('');
          }
        } else {
          lines.push('# Allow AI crawlers (opt-in for visibility)');
          for (const bot of aiCrawlers) {
            lines.push(`User-agent: ${bot}`);
            lines.push('Allow: /');
            lines.push('');
          }
        }

        const sitemapRef = sitemap_url || `https://${domain}/sitemap.xml`;
        lines.push(`Sitemap: ${sitemapRef}`);

        const content = lines.join('\n');
        return toolResult(
          `Generated robots.txt for ${domain}:\n\n${content}`,
        );
      } catch (e) {
        return toolError(e);
      }
    },
  );
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
