/**
 * DataForSEO tools 16–20: SERP rankings, backlinks, keyword research,
 * domain metrics, competitor gap analysis.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolResult, toolError } from '@framework/mcp-shared';
import type { DataForSEOClient } from '../services/dataforseo-client.js';

const NOT_CONFIGURED =
  'DataForSEO not configured. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD environment variables.';

/** Resolve a location string to a DataForSEO location code. */
function locationCode(loc?: string): number {
  if (!loc) return 2840;
  const lower = loc.toLowerCase();
  if (lower === 'canada' || lower === 'ca') return 2124;
  if (lower === 'united states' || lower === 'us' || lower === 'usa') return 2840;
  if (lower === 'united kingdom' || lower === 'uk' || lower === 'gb') return 2826;
  if (lower === 'australia' || lower === 'au') return 2036;
  return 2840;
}

export function registerDataForSEOTools(server: McpServer, client: DataForSEOClient | null): void {
  // ── Tool 16: seo_serp_rankings ──────────────────────────────────────
  server.tool(
    'seo_serp_rankings',
    'Check where a URL ranks in Google for given keywords, including SERP features and top competitors',
    {
      keywords: z.string().describe('Comma-separated keywords to check'),
      url: z.string().describe('Target URL to find in results'),
      location: z.string().optional().describe('Location (e.g. "US", "Canada") — default US'),
      language: z.string().optional().describe('Language code (default "en")'),
    },
    async ({ keywords, url, location, language }) => {
      if (!client) return toolError(NOT_CONFIGURED);
      try {
        const kwList = keywords.split(',').map(k => k.trim()).filter(Boolean);
        const loc = locationCode(location);
        const lang = language || 'en';
        const targetLower = url.toLowerCase();

        const results: Record<string, unknown> = {};

        for (const kw of kwList) {
          const raw = (await client.serpOrganic(kw, loc, lang)) as SerpResponse;
          const items = raw?.tasks?.[0]?.result?.[0]?.items ?? [];
          const organicItems = items.filter((i: SerpItem) => i.type === 'organic');

          // Find target position
          const match = organicItems.find(
            (i: SerpItem) => i.url?.toLowerCase().includes(targetLower) || i.domain?.toLowerCase().includes(targetLower),
          );

          // SERP features present
          const featureTypes = [...new Set(items.map((i: SerpItem) => i.type).filter((t: string) => t !== 'organic'))];

          // Top 5 competitors
          const top5 = organicItems.slice(0, 5).map((i: SerpItem) => ({
            position: i.rank_group,
            url: i.url,
            title: i.title,
            domain: i.domain,
          }));

          results[kw] = {
            target_position: match ? match.rank_group : 'not found in top results',
            target_url: match?.url ?? null,
            serp_features: featureTypes,
            top_competitors: top5,
            total_organic_results: raw?.tasks?.[0]?.result?.[0]?.se_results_count ?? null,
          };
        }

        return toolResult(JSON.stringify(results, null, 2));
      } catch (e) {
        return toolError(e);
      }
    },
  );

  // ── Tool 17: seo_backlink_summary ───────────────────────────────────
  server.tool(
    'seo_backlink_summary',
    'Get backlink profile summary: referring domains, total backlinks, dofollow ratio, top referrers, anchor text distribution',
    {
      domain: z.string().describe('Domain to analyze (e.g. "example.com")'),
    },
    async ({ domain }) => {
      if (!client) return toolError(NOT_CONFIGURED);
      try {
        const raw = (await client.backlinksSummary(domain)) as BacklinksResponse;
        const data = raw?.tasks?.[0]?.result?.[0];
        if (!data) return toolError('No backlink data returned for this domain');

        const totalBacklinks = data.external_links_count ?? 0;
        const dofollow = data.dofollow ?? 0;
        const nofollowCount = totalBacklinks - dofollow;

        const result = {
          domain,
          referring_domains: data.referring_domains ?? 0,
          referring_main_domains: data.referring_main_domains ?? 0,
          total_backlinks: totalBacklinks,
          dofollow_count: dofollow,
          nofollow_count: nofollowCount,
          dofollow_percent: totalBacklinks > 0 ? Math.round((dofollow / totalBacklinks) * 100) : 0,
          referring_ips: data.referring_ips ?? 0,
          referring_subnets: data.referring_subnets ?? 0,
          rank: data.rank ?? null,
          top_anchor_texts: (data.anchor_text_distribution ?? []).slice(0, 10),
          top_referring_domains: (data.referring_domains_info ?? []).slice(0, 10),
          broken_backlinks: data.broken_backlinks ?? 0,
        };

        return toolResult(JSON.stringify(result, null, 2));
      } catch (e) {
        return toolError(e);
      }
    },
  );

  // ── Tool 18: seo_keyword_research ───────────────────────────────────
  server.tool(
    'seo_keyword_research',
    'Get keyword suggestions with search volume, difficulty, and CPC from seed keywords or a domain',
    {
      seed_keywords: z.string().describe('Comma-separated seed keywords or a domain name'),
      location: z.string().optional().describe('Location (e.g. "US", "Canada") — default US'),
    },
    async ({ seed_keywords, location }) => {
      if (!client) return toolError(NOT_CONFIGURED);
      try {
        const loc = locationCode(location);
        const seeds = seed_keywords.split(',').map(s => s.trim()).filter(Boolean);
        const target = seeds[0]; // Use first seed as target for keywordsForSite

        // Get keyword suggestions
        const kwRaw = (await client.keywordsForSite(target, loc)) as KeywordsResponse;
        const kwItems = kwRaw?.tasks?.[0]?.result?.[0]?.items ?? [];

        // Extract keyword strings for difficulty check
        const kwStrings = kwItems.slice(0, 50).map((i: KeywordItem) => i.keyword);

        // Get difficulty scores if we have keywords
        let difficultyMap: Record<string, number> = {};
        if (kwStrings.length > 0) {
          const diffRaw = (await client.keywordDifficulty(kwStrings, loc)) as DifficultyResponse;
          const diffItems = diffRaw?.tasks?.[0]?.result?.[0]?.items ?? [];
          for (const d of diffItems) {
            if (d.keyword) difficultyMap[d.keyword] = d.keyword_difficulty ?? 0;
          }
        }

        // Merge results
        const keywords = kwItems.slice(0, 50).map((i: KeywordItem) => ({
          keyword: i.keyword,
          search_volume: i.search_volume ?? 0,
          cpc: i.cpc ?? 0,
          competition: i.competition ?? 0,
          competition_level: i.competition_level ?? 'unknown',
          difficulty: difficultyMap[i.keyword] ?? null,
        }));

        // Sort by volume descending
        keywords.sort((a, b) => b.search_volume - a.search_volume);

        return toolResult(JSON.stringify({
          target,
          location_code: loc,
          total_suggestions: kwItems.length,
          showing: keywords.length,
          keywords,
        }, null, 2));
      } catch (e) {
        return toolError(e);
      }
    },
  );

  // ── Tool 19: seo_domain_metrics ─────────────────────────────────────
  server.tool(
    'seo_domain_metrics',
    'Get domain-level metrics: rank, creation date, registrar, expiration, organic traffic estimate',
    {
      domain: z.string().describe('Domain to analyze (e.g. "example.com")'),
    },
    async ({ domain }) => {
      if (!client) return toolError(NOT_CONFIGURED);
      try {
        const raw = (await client.domainMetrics(domain)) as DomainResponse;
        const data = raw?.tasks?.[0]?.result?.[0];
        if (!data) return toolError('No domain data returned');

        const result = {
          domain,
          create_date: data.create_date ?? null,
          update_date: data.update_date ?? null,
          expiry_date: data.expiry_date ?? null,
          registrar: data.registrar ?? null,
          metrics: data.metrics ?? null,
        };

        return toolResult(JSON.stringify(result, null, 2));
      } catch (e) {
        return toolError(e);
      }
    },
  );

  // ── Tool 20: seo_competitor_gap ─────────────────────────────────────
  server.tool(
    'seo_competitor_gap',
    'Find keywords competitors rank for that the target domain does not (keyword gap analysis)',
    {
      target_domain: z.string().describe('Your domain to analyze'),
      competitor_domains: z.string().describe('Comma-separated competitor domains'),
    },
    async ({ target_domain, competitor_domains }) => {
      if (!client) return toolError(NOT_CONFIGURED);
      try {
        const competitors = competitor_domains.split(',').map(d => d.trim()).filter(Boolean);
        const loc = 2840; // US default

        // Fetch keywords for target
        const targetRaw = (await client.keywordsForSite(target_domain, loc)) as KeywordsResponse;
        const targetKws = new Set(
          (targetRaw?.tasks?.[0]?.result?.[0]?.items ?? []).map((i: KeywordItem) => i.keyword),
        );

        // Fetch keywords for each competitor in parallel
        const competitorResults = await Promise.all(
          competitors.map(async (comp) => {
            const raw = (await client.keywordsForSite(comp, loc)) as KeywordsResponse;
            const items = raw?.tasks?.[0]?.result?.[0]?.items ?? [];
            return { domain: comp, items };
          }),
        );

        // Find gap keywords: in competitors but not in target
        const gapMap = new Map<string, { keyword: string; volume: number; cpc: number; found_in: string[] }>();

        for (const { domain: compDomain, items } of competitorResults) {
          for (const item of items) {
            if (targetKws.has(item.keyword)) continue;
            const existing = gapMap.get(item.keyword);
            if (existing) {
              existing.found_in.push(compDomain);
              // Keep highest volume
              if ((item.search_volume ?? 0) > existing.volume) {
                existing.volume = item.search_volume ?? 0;
                existing.cpc = item.cpc ?? 0;
              }
            } else {
              gapMap.set(item.keyword, {
                keyword: item.keyword,
                volume: item.search_volume ?? 0,
                cpc: item.cpc ?? 0,
                found_in: [compDomain],
              });
            }
          }
        }

        // Sort by volume descending, take top 50
        const gapKeywords = [...gapMap.values()]
          .sort((a, b) => b.volume - a.volume)
          .slice(0, 50);

        return toolResult(JSON.stringify({
          target_domain,
          competitors,
          total_gap_keywords: gapMap.size,
          showing: gapKeywords.length,
          gap_keywords: gapKeywords,
        }, null, 2));
      } catch (e) {
        return toolError(e);
      }
    },
  );
}

// ── Internal type shapes for DataForSEO responses ───────────────────

interface SerpItem {
  type: string;
  rank_group?: number;
  url?: string;
  domain?: string;
  title?: string;
}

interface SerpResponse {
  tasks?: Array<{
    result?: Array<{
      items?: SerpItem[];
      se_results_count?: number;
    }>;
  }>;
}

interface BacklinksResponse {
  tasks?: Array<{
    result?: Array<{
      external_links_count?: number;
      dofollow?: number;
      referring_domains?: number;
      referring_main_domains?: number;
      referring_ips?: number;
      referring_subnets?: number;
      rank?: number;
      anchor_text_distribution?: unknown[];
      referring_domains_info?: unknown[];
      broken_backlinks?: number;
    }>;
  }>;
}

interface KeywordItem {
  keyword: string;
  search_volume?: number;
  cpc?: number;
  competition?: number;
  competition_level?: string;
}

interface KeywordsResponse {
  tasks?: Array<{
    result?: Array<{
      items?: KeywordItem[];
    }>;
  }>;
}

interface DifficultyResponse {
  tasks?: Array<{
    result?: Array<{
      items?: Array<{
        keyword?: string;
        keyword_difficulty?: number;
      }>;
    }>;
  }>;
}

interface DomainResponse {
  tasks?: Array<{
    result?: Array<{
      create_date?: string;
      update_date?: string;
      expiry_date?: string;
      registrar?: string;
      metrics?: unknown;
    }>;
  }>;
}
