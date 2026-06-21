/**
 * Tool 8: seo_analyze_aeo — AI Engine Optimization (Answer Engine Optimization) analysis.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolResult, toolError } from '@framework/mcp-shared';
import { parseHtml, extractBodyText, extractJsonLd } from '../services/analyzer.js';
import { buildResult, isQuotableSentence, extractSentences, type CheckResult } from '../utils.js';

const AI_CRAWLERS = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'CCBot', 'anthropic-ai'];

/** Check if a heading looks like a question. */
function isQuestionHeading(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return /^(what|who|why|how|when|where|which|is|are|can|do|does|should|will|would)\b/.test(trimmed)
    || trimmed.endsWith('?');
}

/** Parse robots.txt and return blocked user agents. */
function parseBlockedCrawlers(robotsTxt: string): string[] {
  const blocked: string[] = [];
  const lines = robotsTxt.split('\n').map(l => l.trim());
  let currentAgent = '';

  for (const line of lines) {
    if (line.toLowerCase().startsWith('user-agent:')) {
      currentAgent = line.split(':').slice(1).join(':').trim();
    } else if (line.toLowerCase().startsWith('disallow:') && currentAgent) {
      const path = line.split(':').slice(1).join(':').trim();
      if (path === '/' || path === '/*') {
        const matched = AI_CRAWLERS.filter(c => currentAgent === '*' || currentAgent.toLowerCase() === c.toLowerCase());
        if (currentAgent === '*') {
          blocked.push(...AI_CRAWLERS);
        } else if (matched.length > 0) {
          blocked.push(...matched);
        }
      }
    }
  }
  return [...new Set(blocked)];
}

/** Basic structure validation for llms.txt. */
function validateLlmsTxt(content: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const lines = content.trim().split('\n').filter(l => l.trim());

  if (lines.length === 0) {
    issues.push('File is empty');
    return { valid: false, issues };
  }

  // Should start with a title (# heading)
  if (!lines[0].startsWith('#')) {
    issues.push('Missing title heading (should start with # Title)');
  }

  // Should have some descriptive content
  if (lines.length < 3) {
    issues.push('Very sparse content — add description and key URLs');
  }

  // Check for URL references
  const hasUrls = lines.some(l => /https?:\/\//.test(l));
  if (!hasUrls) {
    issues.push('No URLs found — include links to key content');
  }

  return { valid: issues.length === 0, issues };
}

export function registerAeoTools(server: McpServer): void {
  server.tool('seo_analyze_aeo', 'Analyze page readiness for AI answer engines (AEO / GEO)', {
    html: z.string().describe('Full HTML content of the page'),
    url: z.string().url().describe('Page URL'),
    robots_txt: z.string().optional().describe('Contents of robots.txt'),
    llms_txt: z.string().optional().describe('Contents of llms.txt'),
  }, async ({ html, url, robots_txt, llms_txt }) => {
    try {
      const $ = parseHtml(html);
      const bodyText = extractBodyText($);
      const sentences = extractSentences(bodyText);
      const checks: CheckResult[] = [];

      // llms_txt
      if (llms_txt !== undefined) {
        const validation = validateLlmsTxt(llms_txt);
        checks.push({
          id: 'llms_txt',
          category: 'aeo',
          severity: validation.valid ? 'pass' : 'warning',
          title: 'llms.txt Presence & Structure',
          finding: validation.valid
            ? 'llms.txt present with valid structure'
            : `llms.txt present but has issues: ${validation.issues.join('; ')}`,
          recommendation: !validation.valid
            ? 'Fix llms.txt: add a # title, description, and key URLs'
            : undefined,
          data: { valid: validation.valid, issues: validation.issues },
        });
      } else {
        checks.push({
          id: 'llms_txt',
          category: 'aeo',
          severity: 'warning',
          title: 'llms.txt Presence & Structure',
          finding: 'No llms.txt found — AI models cannot easily discover your site structure',
          recommendation: 'Create a /llms.txt file with site title, description, and links to key content',
        });
      }

      // ai_crawler_access
      if (robots_txt !== undefined) {
        const blocked = parseBlockedCrawlers(robots_txt);
        const blockedAI = blocked.filter(c => AI_CRAWLERS.includes(c));
        checks.push({
          id: 'ai_crawler_access',
          category: 'aeo',
          severity: blockedAI.length === 0 ? 'pass' : 'critical',
          title: 'AI Crawler Access',
          finding: blockedAI.length === 0
            ? 'AI crawlers (GPTBot, ClaudeBot, PerplexityBot) are not blocked'
            : `BLOCKED AI crawlers: ${blockedAI.join(', ')} — these cannot index your content`,
          recommendation: blockedAI.length > 0
            ? `Remove Disallow rules for ${blockedAI.join(', ')} in robots.txt to allow AI indexing`
            : undefined,
          data: { blocked: blockedAI, checked: AI_CRAWLERS },
        });
      } else {
        checks.push({
          id: 'ai_crawler_access',
          category: 'aeo',
          severity: 'info',
          title: 'AI Crawler Access',
          finding: 'No robots.txt provided — cannot verify AI crawler access',
          recommendation: 'Pass robots_txt parameter to check for AI crawler blocks',
        });
      }

      // extraction_points
      const quotable = sentences.filter(s => isQuotableSentence(s));
      const quotableRatio = sentences.length > 0 ? quotable.length / sentences.length : 0;
      checks.push({
        id: 'extraction_points',
        category: 'aeo',
        severity: quotable.length >= 5 ? 'pass' : quotable.length >= 2 ? 'warning' : 'critical',
        title: 'AI Extraction Points',
        finding: `${quotable.length} quotable sentences (12-25 tokens) out of ${sentences.length} total`,
        recommendation: quotable.length < 5
          ? 'Write more self-contained factual sentences in the 12-25 token range that AI can extract as direct answers'
          : undefined,
        data: { quotable: quotable.length, total: sentences.length, ratio: Math.round(quotableRatio * 100), examples: quotable.slice(0, 3) },
      });

      // qae_structure (Question → Answer → Evidence)
      const headings = $('h1, h2, h3, h4, h5, h6');
      let questionHeadingCount = 0;
      let qaePatterns = 0;

      headings.each((_, el) => {
        const text = $(el).text().trim();
        if (isQuestionHeading(text)) {
          questionHeadingCount++;
          // Check if the next sibling paragraph provides a direct answer
          const nextP = $(el).next('p');
          if (nextP.length > 0 && nextP.text().trim().length > 20) {
            qaePatterns++;
          }
        }
      });

      checks.push({
        id: 'qae_structure',
        category: 'aeo',
        severity: qaePatterns >= 3 ? 'pass' : qaePatterns >= 1 ? 'warning' : 'info',
        title: 'Question-Answer-Evidence Structure',
        finding: `${questionHeadingCount} question headings found, ${qaePatterns} followed by direct answer paragraphs`,
        recommendation: qaePatterns < 3
          ? 'Structure content with question headings (H2/H3) followed immediately by concise answer paragraphs'
          : undefined,
        data: { questionHeadings: questionHeadingCount, qaePatterns },
      });

      // content_freshness
      const htmlStr = html.toLowerCase();
      const datePatterns = [
        /last\s+updated[:\s]*(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\w+\s+\d{1,2},?\s+\d{4})/i,
        /published[:\s]*(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\w+\s+\d{1,2},?\s+\d{4})/i,
        /date[:\s]*(\d{4}[-/]\d{1,2}[-/]\d{1,2})/i,
      ];
      const foundDates: string[] = [];
      for (const pat of datePatterns) {
        const match = html.match(pat);
        if (match) foundDates.push(match[0]);
      }

      // Check for dateModified/datePublished in JSON-LD
      const jsonLd = extractJsonLd($);
      let schemaDate: string | null = null;
      for (const block of jsonLd) {
        const dm = block.properties['dateModified'] || block.properties['datePublished'];
        if (typeof dm === 'string') {
          schemaDate = dm;
          break;
        }
      }

      const hasTimestamp = $('time[datetime]').length > 0;
      const freshnessSignals = foundDates.length + (schemaDate ? 1 : 0) + (hasTimestamp ? 1 : 0);

      checks.push({
        id: 'content_freshness',
        category: 'aeo',
        severity: freshnessSignals >= 2 ? 'pass' : freshnessSignals >= 1 ? 'warning' : 'info',
        title: 'Content Freshness Signals',
        finding: freshnessSignals === 0
          ? 'No date or freshness signals found — AI models may deprioritize undated content'
          : `${freshnessSignals} freshness signal(s): ${[...foundDates, schemaDate ? `schema: ${schemaDate}` : '', hasTimestamp ? '<time> tag present' : ''].filter(Boolean).join(', ')}`,
        recommendation: freshnessSignals < 2
          ? 'Add visible "Last Updated" dates and dateModified in JSON-LD schema'
          : undefined,
        data: { signals: freshnessSignals, dates: foundDates, schemaDate, hasTimeTag: hasTimestamp },
      });

      // citation_readiness
      const citationReady = sentences.filter(s => {
        if (!isQuotableSentence(s)) return false;
        // Self-contained: contains a subject (capital letter start or named entity pattern) and a fact
        const hasSubject = /^[A-Z]/.test(s.trim());
        const hasVerb = /\b(is|are|was|were|has|have|provides|offers|includes|contains|requires|costs|measures)\b/i.test(s);
        return hasSubject && hasVerb;
      });
      const citationPct = sentences.length > 0 ? Math.round((citationReady.length / sentences.length) * 100) : 0;

      checks.push({
        id: 'citation_readiness',
        category: 'aeo',
        severity: citationPct >= 30 ? 'pass' : citationPct >= 15 ? 'warning' : 'critical',
        title: 'Citation Readiness',
        finding: `${citationPct}% of sentences (${citationReady.length}/${sentences.length}) are self-contained quotable facts`,
        recommendation: citationPct < 30
          ? 'Rewrite key content as standalone factual statements (e.g., "Product X costs $Y and includes Z features")'
          : undefined,
        data: { citationPct, citationReady: citationReady.length, total: sentences.length, examples: citationReady.slice(0, 3) },
      });

      const criticals = checks.filter(c => c.severity === 'critical').length;
      const warnings = checks.filter(c => c.severity === 'warning').length;
      const summary = criticals > 0
        ? `AEO analysis: ${criticals} critical, ${warnings} warning(s) — AI visibility at risk`
        : warnings > 0
          ? `AEO analysis: ${warnings} warning(s) — room for AI optimization`
          : `AEO analysis: all checks passed — content is AI-ready`;

      return toolResult(JSON.stringify(buildResult('seo_analyze_aeo', url, checks, summary), null, 2));
    } catch (e) {
      return toolError(e);
    }
  });
}
