/**
 * Tool 10: seo_analyze_local — Local SEO analysis.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolResult, toolError } from '@framework/mcp-shared';
import { parseHtml, extractJsonLd, extractBodyText, extractMeta } from '../services/analyzer.js';
import { buildResult, type CheckResult } from '../utils.js';

/** Phone regex: matches common North American and international formats. */
const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

/** Street address pattern: number + street name. */
const ADDRESS_REGEX = /\d{1,5}\s+[A-Z][a-zA-Z\s]+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Rd|Road|Ln|Lane|Way|Ct|Court|Pl|Place|Cr|Crescent|Cres)\b/g;

/** Local business schema types. */
const LOCAL_TYPES = new Set([
  'LocalBusiness', 'Store', 'Restaurant', 'MedicalBusiness', 'LegalService',
  'FinancialService', 'RealEstateAgent', 'HomeAndConstructionBusiness',
  'AutoRepair', 'HealthAndBeautyBusiness', 'SportsActivityLocation',
  'EntertainmentBusiness', 'FoodEstablishment', 'LodgingBusiness',
  'ProfessionalService', 'AutomotiveBusiness',
]);

export function registerLocalTools(server: McpServer): void {
  server.tool('seo_analyze_local', 'Analyze page for local SEO signals (NAP, schema, GBP, reviews)', {
    html: z.string().describe('Full HTML content of the page'),
    url: z.string().url().describe('Page URL'),
    business_name: z.string().optional().describe('Business name to check NAP consistency'),
  }, async ({ html, url, business_name }) => {
    try {
      const $ = parseHtml(html);
      const jsonLd = extractJsonLd($);
      const bodyText = extractBodyText($);
      const meta = extractMeta($);
      const checks: CheckResult[] = [];

      // local_schema
      const localSchemas = jsonLd.filter(block => {
        const types = Array.isArray(block.type) ? block.type : [block.type];
        return types.some(t => LOCAL_TYPES.has(t));
      });

      const schemaIssues: string[] = [];
      if (localSchemas.length > 0) {
        const schema = localSchemas[0];
        if (!schema.properties['address']) schemaIssues.push('missing address');
        if (!schema.properties['telephone']) schemaIssues.push('missing telephone');
        if (!schema.properties['openingHoursSpecification'] && !schema.properties['openingHours']) {
          schemaIssues.push('missing opening hours');
        }
      }

      checks.push({
        id: 'local_schema',
        category: 'local',
        severity: localSchemas.length === 0 ? 'critical' : schemaIssues.length > 0 ? 'warning' : 'pass',
        title: 'LocalBusiness Schema',
        finding: localSchemas.length === 0
          ? 'No LocalBusiness (or subtype) JSON-LD schema found'
          : schemaIssues.length > 0
            ? `LocalBusiness schema found but ${schemaIssues.join(', ')}`
            : 'LocalBusiness schema present with address, phone, and hours',
        recommendation: localSchemas.length === 0
          ? 'Add LocalBusiness JSON-LD schema with address, telephone, and openingHoursSpecification'
          : schemaIssues.length > 0
            ? `Add missing properties to LocalBusiness schema: ${schemaIssues.join(', ')}`
            : undefined,
        data: { found: localSchemas.length, issues: schemaIssues },
      });

      // nap_consistency (Name, Address, Phone)
      const footerHtml = $('footer').html() || '';
      const contactHtml = $('[class*="contact"], [id*="contact"], [class*="footer"], address').map((_, el) => $(el).html()).get().join(' ');
      const napZone = footerHtml + ' ' + contactHtml;

      const phonesInNap = napZone.match(PHONE_REGEX) || [];
      const addressesInNap = napZone.match(ADDRESS_REGEX) || [];
      const nameFoundInNap = business_name ? napZone.toLowerCase().includes(business_name.toLowerCase()) : null;

      const napSignals: string[] = [];
      if (phonesInNap.length > 0) napSignals.push(`phone: ${phonesInNap[0]}`);
      if (addressesInNap.length > 0) napSignals.push(`address: ${addressesInNap[0]}`);
      if (nameFoundInNap) napSignals.push('business name found');

      const napScore = (phonesInNap.length > 0 ? 1 : 0) + (addressesInNap.length > 0 ? 1 : 0) + (nameFoundInNap ? 1 : 0);

      checks.push({
        id: 'nap_consistency',
        category: 'local',
        severity: napScore >= 2 ? 'pass' : napScore >= 1 ? 'warning' : 'critical',
        title: 'NAP Consistency (Name, Address, Phone)',
        finding: napSignals.length === 0
          ? 'No NAP information found in footer or contact sections'
          : `NAP signals in footer/contact area: ${napSignals.join(', ')}`,
        recommendation: napScore < 2
          ? 'Ensure business name, address, and phone number are visible in the footer or contact section'
          : undefined,
        data: { phones: phonesInNap.slice(0, 3), addresses: addressesInNap.slice(0, 3), nameFound: nameFoundInNap },
      });

      // gbp_signals (Google Business Profile)
      const htmlStr = html.toLowerCase();
      const hasMapsEmbed = /google\.com\/maps\/embed/.test(htmlStr) || /maps\.googleapis\.com/.test(htmlStr);
      const hasGbpLink = /google\.com\/maps\/place/.test(htmlStr) || /goo\.gl\/maps/.test(htmlStr) || /maps\.app\.goo\.gl/.test(htmlStr);
      const gbpSignals = (hasMapsEmbed ? 1 : 0) + (hasGbpLink ? 1 : 0);

      checks.push({
        id: 'gbp_signals',
        category: 'local',
        severity: gbpSignals >= 1 ? 'pass' : 'warning',
        title: 'Google Business Profile Signals',
        finding: gbpSignals === 0
          ? 'No Google Maps embed or GBP link found'
          : `Found: ${[hasMapsEmbed ? 'Maps embed' : '', hasGbpLink ? 'GBP/Maps link' : ''].filter(Boolean).join(', ')}`,
        recommendation: gbpSignals === 0
          ? 'Add a Google Maps embed or link to your Google Business Profile for local trust signals'
          : undefined,
        data: { mapsEmbed: hasMapsEmbed, gbpLink: hasGbpLink },
      });

      // review_signals
      const hasReviewSchema = jsonLd.some(block => {
        const types = Array.isArray(block.type) ? block.type : [block.type];
        return types.includes('Review') || types.includes('AggregateRating')
          || block.properties['aggregateRating'] || block.properties['review'];
      });
      const hasStarRating = /class\s*=\s*["'][^"']*(?:star|rating|review)[^"']*["']/i.test(html);
      const hasTestimonials = /(?:testimonial|review|customer\s+said|client\s+feedback)/i.test(html);
      const reviewSignals = (hasReviewSchema ? 1 : 0) + (hasStarRating ? 1 : 0) + (hasTestimonials ? 1 : 0);

      checks.push({
        id: 'review_signals',
        category: 'local',
        severity: reviewSignals >= 2 ? 'pass' : reviewSignals >= 1 ? 'warning' : 'info',
        title: 'Review & Testimonial Signals',
        finding: reviewSignals === 0
          ? 'No review markup, star ratings, or testimonials detected'
          : `Found: ${[hasReviewSchema ? 'Review/Rating schema' : '', hasStarRating ? 'star rating elements' : '', hasTestimonials ? 'testimonial content' : ''].filter(Boolean).join(', ')}`,
        recommendation: reviewSignals < 2
          ? 'Add Review or AggregateRating schema markup and display customer testimonials'
          : undefined,
        data: { reviewSchema: hasReviewSchema, starRating: hasStarRating, testimonials: hasTestimonials },
      });

      // hyper_local_title
      const title = meta.title || '';
      // Common city/location indicators
      const locationPattern = /\b(?:in|near|serving)\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?\b/;
      const titleHasLocation = locationPattern.test(title);

      checks.push({
        id: 'hyper_local_title',
        category: 'local',
        severity: titleHasLocation ? 'pass' : 'warning',
        title: 'Hyper-Local Title Tag',
        finding: titleHasLocation
          ? `Title contains location reference: "${title}"`
          : `Title lacks city/neighborhood name: "${title}"`,
        recommendation: !titleHasLocation
          ? 'Include your city or neighborhood in the title tag (e.g., "Plumber in Calgary | Business Name")'
          : undefined,
        data: { title, hasLocation: titleHasLocation },
      });

      // near_me_optimization
      const bodyLower = bodyText.toLowerCase();
      const localTerms = ['near me', 'nearby', 'local', 'in the area', 'serving'];
      const cityMentions = bodyText.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) || [];
      // Filter for likely city names (2+ mentions of same capitalized word)
      const wordFreq: Record<string, number> = {};
      for (const w of cityMentions) {
        if (w.length >= 4) wordFreq[w] = (wordFreq[w] || 0) + 1;
      }
      const repeatedLocations = Object.entries(wordFreq).filter(([_, count]) => count >= 2).map(([word]) => word);
      const hasLocalTerms = localTerms.some(t => bodyLower.includes(t));

      checks.push({
        id: 'near_me_optimization',
        category: 'local',
        severity: hasLocalTerms || repeatedLocations.length >= 2 ? 'pass' : 'warning',
        title: 'Near-Me & Area Optimization',
        finding: `${hasLocalTerms ? 'Local terms found in body text. ' : 'No local terms (near me, nearby, local) in body. '}${repeatedLocations.length > 0 ? `Repeated location names: ${repeatedLocations.slice(0, 5).join(', ')}` : 'No repeated location names detected'}`,
        recommendation: !hasLocalTerms && repeatedLocations.length < 2
          ? 'Mention your city, neighborhood, and service area names naturally throughout the content'
          : undefined,
        data: { localTerms: hasLocalTerms, repeatedLocations: repeatedLocations.slice(0, 10) },
      });

      const criticals = checks.filter(c => c.severity === 'critical').length;
      const warnings = checks.filter(c => c.severity === 'warning').length;
      const summary = criticals > 0
        ? `Local SEO analysis: ${criticals} critical, ${warnings} warning(s)`
        : warnings > 0
          ? `Local SEO analysis: ${warnings} warning(s) — local signals need improvement`
          : `Local SEO analysis: all checks passed — strong local presence`;

      return toolResult(JSON.stringify(buildResult('seo_analyze_local', url, checks, summary), null, 2));
    } catch (e) {
      return toolError(e);
    }
  });
}
