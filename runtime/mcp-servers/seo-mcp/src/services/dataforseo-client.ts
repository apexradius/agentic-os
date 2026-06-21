/**
 * DataForSEO REST API client.
 * Uses Basic Auth (login:password base64-encoded).
 * All POST bodies are arrays of task objects per their API spec.
 */

export class DataForSEOClient {
  private baseUrl = 'https://api.dataforseo.com/v3';
  private authHeader: string;

  constructor(login: string, password: string) {
    this.authHeader = 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64');
  }

  async post(endpoint: string, body: unknown[]): Promise<unknown> {
    const url = `${this.baseUrl}${endpoint}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authHeader,
      },
      body: JSON.stringify(body),
    });

    if (res.status === 401) {
      throw new Error('DataForSEO authentication failed — check DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD');
    }
    if (res.status === 429) {
      throw new Error('DataForSEO rate limit exceeded — retry after a short delay');
    }
    if (res.status >= 500) {
      throw new Error(`DataForSEO service error (HTTP ${res.status})`);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`DataForSEO request failed (HTTP ${res.status}): ${text}`);
    }

    return res.json();
  }

  /** SERP organic results for a keyword. */
  async serpOrganic(keyword: string, locationCode: number, languageCode: string): Promise<unknown> {
    return this.post('/serp/google/organic/live/advanced', [
      { keyword, location_code: locationCode, language_code: languageCode },
    ]);
  }

  /** Backlink profile summary for a target domain/URL. */
  async backlinksSummary(target: string): Promise<unknown> {
    return this.post('/backlinks/summary/live', [{ target }]);
  }

  /** Keyword suggestions for a site. */
  async keywordsForSite(target: string, locationCode: number): Promise<unknown> {
    return this.post('/dataforseo_labs/google/keywords_for_site/live', [
      { target, location_code: locationCode },
    ]);
  }

  /** WHOIS / domain analytics overview. */
  async domainMetrics(domain: string): Promise<unknown> {
    return this.post('/domain_analytics/whois/overview/live', [{ target: domain }]);
  }

  /** Bulk keyword difficulty scores. */
  async keywordDifficulty(keywords: string[], locationCode: number): Promise<unknown> {
    return this.post('/dataforseo_labs/google/bulk_keyword_difficulty/live', [
      { keywords, location_code: locationCode },
    ]);
  }
}

/** Check if DataForSEO credentials are set. */
export function isDataForSEOConfigured(): boolean {
  return !!(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);
}

/** Create a client if credentials exist, otherwise null. */
export function createClient(): DataForSEOClient | null {
  if (!isDataForSEOConfigured()) return null;
  return new DataForSEOClient(process.env.DATAFORSEO_LOGIN!, process.env.DATAFORSEO_PASSWORD!);
}
