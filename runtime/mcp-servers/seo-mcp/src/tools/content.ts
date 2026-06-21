/**
 * Content SEO analysis tools — headings, thin content, keywords, E-E-A-T, links.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolResult, toolError } from '@framework/mcp-shared';
import { parseHtml, extractMeta, extractHeadings, extractLinks, extractBodyText } from '../services/analyzer.js';
import { type CheckResult, buildResult, wordCount, fleschKincaidGrade, fleschReadingEase } from '../utils.js';

export function registerContentTools(server: McpServer): void {
  // ── Tool 3: seo_analyze_content ────────────────────────────────────────
  server.tool(
    'seo_analyze_content',
    'Analyze content quality: heading hierarchy, word count, keyword usage, readability',
    {
      html: z.string().min(1).describe('Full HTML source of the page'),
      url: z.string().url().describe('Page URL'),
      target_keywords: z.string().optional().describe('Comma-separated target keywords to check for'),
    },
    async ({ html, url, target_keywords }) => {
      try {
        const $ = parseHtml(html);
        const meta = extractMeta($);
        const headings = extractHeadings($);
        const bodyText = extractBodyText($);
        const checks: CheckResult[] = [];
        const wc = wordCount(bodyText);

        // 1. Heading hierarchy
        const h1s = headings.filter(h => h.level === 1);
        if (h1s.length === 0) {
          checks.push({
            id: 'heading_hierarchy',
            category: 'content',
            severity: 'critical',
            title: 'Missing H1 tag',
            finding: 'No H1 heading found on the page.',
            recommendation: 'Add a single, descriptive H1 tag that includes your primary keyword.',
          });
        } else if (h1s.length > 1) {
          checks.push({
            id: 'heading_hierarchy',
            category: 'content',
            severity: 'warning',
            title: 'Multiple H1 tags',
            finding: `Found ${h1s.length} H1 tags: ${h1s.map(h => `"${h.text}"`).join(', ')}.`,
            recommendation: 'Use a single H1 per page. Move secondary headings to H2.',
          });
        } else {
          // Check nesting — look for skipped levels
          let nestingOk = true;
          for (let i = 1; i < headings.length; i++) {
            if (headings[i].level > headings[i - 1].level + 1) {
              nestingOk = false;
              break;
            }
          }

          checks.push({
            id: 'heading_hierarchy',
            category: 'content',
            severity: nestingOk ? 'pass' : 'warning',
            title: nestingOk ? 'Proper heading hierarchy' : 'Heading levels skipped',
            finding: nestingOk
              ? `Single H1: "${h1s[0].text}". ${headings.length} total headings with proper nesting.`
              : `Single H1: "${h1s[0].text}". Heading levels are skipped (e.g., H2 to H4).`,
            ...(nestingOk ? {} : {
              recommendation: 'Maintain sequential heading levels (H1 > H2 > H3) without skipping.',
            }),
            data: {
              h1Count: h1s.length,
              totalHeadings: headings.length,
              structure: headings.map(h => `H${h.level}: ${h.text}`),
            },
          });
        }

        // 2. Thin content
        if (wc < 100) {
          checks.push({
            id: 'thin_content',
            category: 'content',
            severity: 'critical',
            title: 'Extremely thin content',
            finding: `Only ${wc} words found. Pages under 100 words are unlikely to rank.`,
            recommendation: 'Expand content to at least 300 words with valuable, original information.',
          });
        } else if (wc < 300) {
          checks.push({
            id: 'thin_content',
            category: 'content',
            severity: 'warning',
            title: 'Thin content',
            finding: `${wc} words found. Google typically favors pages with 300+ words.`,
            recommendation: 'Consider expanding content to provide more comprehensive coverage of the topic.',
          });
        } else {
          checks.push({
            id: 'thin_content',
            category: 'content',
            severity: 'pass',
            title: 'Sufficient content length',
            finding: `${wc} words found.`,
            data: { wordCount: wc },
          });
        }

        // 3. Keyword usage (if provided)
        if (target_keywords) {
          const keywords = target_keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
          const titleLower = (meta.title || '').toLowerCase();
          const h1Lower = h1s.map(h => h.text.toLowerCase()).join(' ');
          const bodyLower = bodyText.toLowerCase();
          const urlLower = url.toLowerCase();

          // First ~160 words as "first paragraph" proxy
          const firstParagraph = bodyLower.split(/\s+/).slice(0, 160).join(' ');

          for (const kw of keywords) {
            const inTitle = titleLower.includes(kw);
            const inH1 = h1Lower.includes(kw);
            const inFirstPara = firstParagraph.includes(kw);
            const inUrl = urlLower.includes(kw.replace(/\s+/g, '-'));
            const bodyOccurrences = (bodyLower.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

            const placements: string[] = [];
            if (inTitle) placements.push('title');
            if (inH1) placements.push('H1');
            if (inFirstPara) placements.push('first paragraph');
            if (inUrl) placements.push('URL');

            const score = placements.length;
            let severity: CheckResult['severity'] = 'pass';
            if (score === 0) severity = 'critical';
            else if (score <= 1) severity = 'warning';

            const missing: string[] = [];
            if (!inTitle) missing.push('title');
            if (!inH1) missing.push('H1');
            if (!inFirstPara) missing.push('first paragraph');
            if (!inUrl) missing.push('URL');

            checks.push({
              id: 'keyword_usage',
              category: 'content',
              severity,
              title: score >= 3 ? `Good keyword placement: "${kw}"` : `Keyword "${kw}" needs optimization`,
              finding: `"${kw}" found in: ${placements.length > 0 ? placements.join(', ') : 'none of the key positions'}. ${bodyOccurrences} occurrence(s) in body.`,
              ...(missing.length > 0 ? {
                recommendation: `Add "${kw}" to: ${missing.join(', ')}.`,
              } : {}),
              data: { keyword: kw, inTitle, inH1, inFirstPara, inUrl, bodyOccurrences },
            });
          }
        }

        // 4. Readability
        if (wc >= 50) {
          const fkGrade = fleschKincaidGrade(bodyText);
          const fre = fleschReadingEase(bodyText);

          let severity: CheckResult['severity'] = 'pass';
          let recommendation: string | undefined;

          if (fkGrade > 12) {
            severity = 'warning';
            recommendation = 'Content reads at a college level or above. Simplify sentence structure and word choice for broader accessibility.';
          } else if (fkGrade > 16) {
            severity = 'critical';
            recommendation = 'Content is extremely difficult to read. Most web content performs best at a grade 6-8 reading level.';
          }

          checks.push({
            id: 'readability',
            category: 'content',
            severity,
            title: `Readability: Grade ${fkGrade.toFixed(1)}`,
            finding: `Flesch-Kincaid Grade: ${fkGrade.toFixed(1)}, Reading Ease: ${fre.toFixed(1)}/100. ${fre >= 60 ? 'Generally accessible.' : 'May be difficult for general audiences.'}`,
            ...(recommendation ? { recommendation } : {}),
            data: { fleschKincaidGrade: fkGrade, fleschReadingEase: fre, wordCount: wc },
          });
        }

        // 5. Content length assessment
        let lengthSeverity: CheckResult['severity'] = 'info';
        let lengthTitle = '';
        let lengthFinding = '';

        if (wc >= 1500) {
          lengthSeverity = 'pass';
          lengthTitle = 'Comprehensive content length';
          lengthFinding = `${wc} words — long-form content that can rank for competitive queries.`;
        } else if (wc >= 800) {
          lengthSeverity = 'pass';
          lengthTitle = 'Good content length';
          lengthFinding = `${wc} words — sufficient for most topics.`;
        } else if (wc >= 300) {
          lengthSeverity = 'info';
          lengthTitle = 'Moderate content length';
          lengthFinding = `${wc} words — adequate but may not compete for competitive terms.`;
        } else {
          lengthSeverity = 'warning';
          lengthTitle = 'Short content';
          lengthFinding = `${wc} words — consider expanding for better ranking potential.`;
        }

        checks.push({
          id: 'content_length',
          category: 'onpage',
          severity: lengthSeverity,
          title: lengthTitle,
          finding: lengthFinding,
          data: { wordCount: wc },
        });

        const passCount = checks.filter(c => c.severity === 'pass').length;
        const critCount = checks.filter(c => c.severity === 'critical').length;
        const warnCount = checks.filter(c => c.severity === 'warning').length;
        const summary = `Content analysis: ${passCount} passed, ${critCount} critical, ${warnCount} warnings out of ${checks.length} checks. ${wc} words.`;

        return toolResult(JSON.stringify(buildResult('seo_analyze_content', url, checks, summary)));
      } catch (e) {
        return toolError(e);
      }
    },
  );

  // ── Tool 4: seo_analyze_eeat ───────────────────────────────────────────
  server.tool(
    'seo_analyze_eeat',
    'Analyze E-E-A-T signals: author bios, credentials, citations, dates, trust pages',
    {
      html: z.string().min(1).describe('Full HTML source of the page'),
      url: z.string().url().describe('Page URL'),
    },
    async ({ html, url }) => {
      try {
        const $ = parseHtml(html);
        const checks: CheckResult[] = [];
        const bodyLower = extractBodyText($).toLowerCase();

        // 1. Author bios / bylines
        const authorSelectors = [
          '[rel="author"]', '.author', '.byline', '[itemprop="author"]',
          '.post-author', '.entry-author', '.article-author', '[class*="author"]',
        ];
        let authorFound = false;
        let authorText = '';
        for (const sel of authorSelectors) {
          const el = $(sel).first();
          if (el.length > 0) {
            authorFound = true;
            authorText = el.text().trim();
            break;
          }
        }

        checks.push({
          id: 'eeat_signals',
          category: 'content',
          severity: authorFound ? 'pass' : 'warning',
          title: authorFound ? 'Author byline found' : 'No author byline detected',
          finding: authorFound
            ? `Author identified: "${authorText.substring(0, 100)}".`
            : 'No author attribution found. Google values content with clear authorship.',
          ...(authorFound ? {} : {
            recommendation: 'Add an author byline with name and credentials. Link to an author bio page.',
          }),
        });

        // 2. Credentials mentions
        const credentialPatterns = [
          /\b(ph\.?d|m\.?d|m\.?b\.?a|r\.?n|cpa|certified|licensed|accredited)\b/i,
          /\b(years?\s+(?:of\s+)?experience|professional|expert|specialist|qualified)\b/i,
        ];
        const hasCredentials = credentialPatterns.some(p => p.test(bodyLower));

        checks.push({
          id: 'eeat_signals',
          category: 'content',
          severity: hasCredentials ? 'pass' : 'info',
          title: hasCredentials ? 'Credential signals detected' : 'No credential signals found',
          finding: hasCredentials
            ? 'Content mentions qualifications, certifications, or expertise indicators.'
            : 'No explicit credentials or qualifications mentioned in the content.',
          ...(hasCredentials ? {} : {
            recommendation: 'If applicable, mention relevant qualifications, years of experience, or certifications.',
          }),
        });

        // 3. Citations / references (external authoritative links)
        const allLinks = $('a[href]');
        let externalCitations = 0;
        allLinks.each((_, el) => {
          const href = $(el).attr('href') || '';
          try {
            const linkDomain = new URL(href, url).hostname;
            const pageDomain = new URL(url).hostname;
            if (linkDomain !== pageDomain && href.startsWith('http')) {
              externalCitations++;
            }
          } catch { /* skip */ }
        });

        checks.push({
          id: 'eeat_signals',
          category: 'content',
          severity: externalCitations >= 2 ? 'pass' : externalCitations > 0 ? 'info' : 'warning',
          title: externalCitations >= 2
            ? 'Good citation practice'
            : externalCitations > 0 ? 'Minimal citations' : 'No external citations',
          finding: `${externalCitations} external link(s) found, serving as citations/references.`,
          ...(externalCitations < 2 ? {
            recommendation: 'Add references to authoritative external sources to strengthen E-E-A-T signals.',
          } : {}),
          data: { externalCitations },
        });

        // 4. Published / updated dates
        const dateSelectors = [
          'time[datetime]', '[itemprop="datePublished"]', '[itemprop="dateModified"]',
          '.published', '.updated', '.post-date', '.entry-date', '[class*="date"]',
        ];
        let dateFound = false;
        let dateText = '';
        for (const sel of dateSelectors) {
          const el = $(sel).first();
          if (el.length > 0) {
            dateFound = true;
            dateText = el.attr('datetime') || el.text().trim();
            break;
          }
        }

        checks.push({
          id: 'eeat_signals',
          category: 'content',
          severity: dateFound ? 'pass' : 'warning',
          title: dateFound ? 'Publication date found' : 'No publication date detected',
          finding: dateFound
            ? `Date signal: "${dateText.substring(0, 50)}".`
            : 'No publish/update date found. Dated content signals freshness to Google.',
          ...(dateFound ? {} : {
            recommendation: 'Add a visible publication date and consider showing a "last updated" date.',
          }),
        });

        // 5. Trust pages (about, contact, privacy)
        const trustPages = [
          { pattern: /\b(about|about-us|our-story|who-we-are)\b/i, name: 'About page' },
          { pattern: /\b(contact|contact-us|get-in-touch)\b/i, name: 'Contact page' },
          { pattern: /\b(privacy|privacy-policy)\b/i, name: 'Privacy policy' },
        ];

        const foundTrust: string[] = [];
        const missingTrust: string[] = [];

        for (const tp of trustPages) {
          let found = false;
          $('a[href]').each((_, el) => {
            const href = $(el).attr('href') || '';
            if (tp.pattern.test(href)) {
              found = true;
              return false; // break
            }
          });
          if (found) {
            foundTrust.push(tp.name);
          } else {
            missingTrust.push(tp.name);
          }
        }

        checks.push({
          id: 'eeat_signals',
          category: 'content',
          severity: missingTrust.length === 0 ? 'pass' : missingTrust.length >= 2 ? 'warning' : 'info',
          title: missingTrust.length === 0 ? 'All trust pages linked' : `Missing trust page link(s)`,
          finding: `Found: ${foundTrust.length > 0 ? foundTrust.join(', ') : 'none'}. Missing: ${missingTrust.length > 0 ? missingTrust.join(', ') : 'none'}.`,
          ...(missingTrust.length > 0 ? {
            recommendation: `Add links to: ${missingTrust.join(', ')}. These pages build trust with users and search engines.`,
          } : {}),
          data: { found: foundTrust, missing: missingTrust },
        });

        const passCount = checks.filter(c => c.severity === 'pass').length;
        const total = checks.length;
        const summary = `E-E-A-T analysis: ${passCount}/${total} signals present. ${passCount >= 4 ? 'Strong' : passCount >= 2 ? 'Moderate' : 'Weak'} E-E-A-T signals.`;

        return toolResult(JSON.stringify(buildResult('seo_analyze_eeat', url, checks, summary)));
      } catch (e) {
        return toolError(e);
      }
    },
  );

  // ── Tool 5: seo_analyze_links ──────────────────────────────────────────
  server.tool(
    'seo_analyze_links',
    'Analyze internal/external link profile: counts, anchor text, nofollow usage, orphan risk',
    {
      html: z.string().min(1).describe('Full HTML source of the page'),
      url: z.string().url().describe('Page URL'),
    },
    async ({ html, url }) => {
      try {
        const $ = parseHtml(html);
        const links = extractLinks($, url);
        const checks: CheckResult[] = [];

        const internal = links.filter(l => l.isInternal);
        const external = links.filter(l => !l.isInternal);
        const uniqueInternalHrefs = new Set(internal.map(l => l.href));

        // 1. Internal links
        if (internal.length === 0) {
          checks.push({
            id: 'internal_links',
            category: 'content',
            severity: 'critical',
            title: 'No internal links',
            finding: 'No internal links found on this page. This creates an orphan page risk.',
            recommendation: 'Add contextual internal links to related pages to improve crawlability and distribute page authority.',
          });
        } else if (uniqueInternalHrefs.size < 3) {
          checks.push({
            id: 'internal_links',
            category: 'content',
            severity: 'warning',
            title: 'Low internal link diversity',
            finding: `${internal.length} internal link(s) pointing to only ${uniqueInternalHrefs.size} unique page(s).`,
            recommendation: 'Link to more unique internal pages for better site crawlability.',
            data: { totalInternal: internal.length, uniquePages: uniqueInternalHrefs.size },
          });
        } else {
          checks.push({
            id: 'internal_links',
            category: 'content',
            severity: 'pass',
            title: 'Good internal linking',
            finding: `${internal.length} internal links to ${uniqueInternalHrefs.size} unique pages.`,
            data: { totalInternal: internal.length, uniquePages: uniqueInternalHrefs.size },
          });
        }

        // 2. External links and nofollow usage
        const nofollowExternal = external.filter(l => l.isNofollow);

        if (external.length > 0) {
          const nofollowRatio = nofollowExternal.length / external.length;

          checks.push({
            id: 'internal_links',
            category: 'content',
            severity: nofollowRatio > 0.8 && external.length > 3 ? 'warning' : 'info',
            title: `${external.length} external link(s)`,
            finding: `${external.length} external links, ${nofollowExternal.length} with nofollow (${(nofollowRatio * 100).toFixed(0)}%).`,
            ...(nofollowRatio > 0.8 && external.length > 3 ? {
              recommendation: 'Excessive nofollow on external links may look unnatural. Use nofollow selectively for sponsored/UGC content.',
            } : {}),
            data: { totalExternal: external.length, nofollow: nofollowExternal.length },
          });
        }

        // 3. Anchor text distribution
        const anchorTypes = { branded: 0, keyword: 0, generic: 0, empty: 0 };
        const genericAnchors = ['click here', 'read more', 'learn more', 'here', 'link', 'this', 'more'];

        let pageDomain = '';
        try { pageDomain = new URL(url).hostname.replace(/^www\./, ''); } catch { /* skip */ }

        for (const link of links) {
          const text = link.text.trim().toLowerCase();
          if (!text || text.length === 0) {
            anchorTypes.empty++;
          } else if (pageDomain && text.includes(pageDomain.split('.')[0])) {
            anchorTypes.branded++;
          } else if (genericAnchors.includes(text)) {
            anchorTypes.generic++;
          } else {
            anchorTypes.keyword++;
          }
        }

        const totalAnchors = links.length;
        if (totalAnchors > 0) {
          const genericRatio = anchorTypes.generic / totalAnchors;
          const emptyRatio = anchorTypes.empty / totalAnchors;

          let anchorSeverity: CheckResult['severity'] = 'pass';
          let anchorRec: string | undefined;
          if (emptyRatio > 0.2) {
            anchorSeverity = 'warning';
            anchorRec = 'Replace empty or image-only anchors with descriptive text for accessibility and SEO.';
          } else if (genericRatio > 0.4) {
            anchorSeverity = 'warning';
            anchorRec = 'Replace generic anchor text ("click here", "read more") with descriptive, keyword-relevant text.';
          }

          checks.push({
            id: 'internal_links',
            category: 'content',
            severity: anchorSeverity,
            title: anchorSeverity === 'pass' ? 'Good anchor text distribution' : 'Anchor text needs improvement',
            finding: `Anchor distribution: ${anchorTypes.keyword} keyword-rich, ${anchorTypes.branded} branded, ${anchorTypes.generic} generic, ${anchorTypes.empty} empty/missing.`,
            ...(anchorRec ? { recommendation: anchorRec } : {}),
            data: { anchorTypes, totalLinks: totalAnchors },
          });
        }

        // 4. Empty/missing href detection
        const emptyHrefs: string[] = [];
        $('a').each((_, el) => {
          const href = $(el).attr('href');
          if (href === undefined || href === '' || href === '#') {
            emptyHrefs.push($(el).text().trim().substring(0, 50) || '[no text]');
          }
        });

        if (emptyHrefs.length > 0) {
          checks.push({
            id: 'internal_links',
            category: 'content',
            severity: 'warning',
            title: `${emptyHrefs.length} link(s) with empty/missing href`,
            finding: `Found anchor tags with no valid href: ${emptyHrefs.slice(0, 5).join(', ')}${emptyHrefs.length > 5 ? ` (+${emptyHrefs.length - 5} more)` : ''}.`,
            recommendation: 'Ensure all anchor tags have valid href attributes. Use buttons for non-navigation actions.',
            data: { count: emptyHrefs.length, samples: emptyHrefs.slice(0, 10) },
          });
        }

        const passCount = checks.filter(c => c.severity === 'pass').length;
        const critCount = checks.filter(c => c.severity === 'critical').length;
        const warnCount = checks.filter(c => c.severity === 'warning').length;
        const summary = `Link analysis: ${internal.length} internal, ${external.length} external links. ${passCount} passed, ${critCount} critical, ${warnCount} warnings.`;

        return toolResult(JSON.stringify(buildResult('seo_analyze_links', url, checks, summary)));
      } catch (e) {
        return toolError(e);
      }
    },
  );
}
