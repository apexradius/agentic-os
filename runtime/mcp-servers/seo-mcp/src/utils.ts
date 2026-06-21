/**
 * SEO utility functions — readability, URL normalization, text extraction.
 */

/** Count syllables in a word (English approximation). */
export function syllableCount(word: string): number {
  const w = word.toLowerCase().replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const vowels = w.match(/[aeiouy]{1,2}/g);
  return vowels ? vowels.length : 1;
}

/** Flesch-Kincaid readability grade level. */
export function fleschKincaidGrade(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (sentences.length === 0 || words.length === 0) return 0;
  const totalSyllables = words.reduce((sum, w) => sum + syllableCount(w.replace(/[^a-zA-Z]/g, '')), 0);
  return 0.39 * (words.length / sentences.length) + 11.8 * (totalSyllables / words.length) - 15.59;
}

/** Flesch Reading Ease score (0-100, higher = easier). */
export function fleschReadingEase(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (sentences.length === 0 || words.length === 0) return 0;
  const totalSyllables = words.reduce((sum, w) => sum + syllableCount(w.replace(/[^a-zA-Z]/g, '')), 0);
  return 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (totalSyllables / words.length);
}

/** Normalize a URL (lowercase host, remove trailing slash, remove fragment). */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    let result = u.toString();
    if (result.endsWith('/') && u.pathname === '/') result = result.slice(0, -1);
    return result;
  } catch {
    return url;
  }
}

/** Extract domain from URL. */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Extract visible text from HTML (strip tags). */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Count words in text. */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

/** Check if a token count is ~18 (self-contained quotable sentence for AEO). */
export function isQuotableSentence(sentence: string): boolean {
  const tokens = sentence.split(/\s+/).filter(w => w.length > 0);
  return tokens.length >= 12 && tokens.length <= 25;
}

/** Extract sentences from text. */
export function extractSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);
}

/** ISO 8601 timestamp. */
export function isoNow(): string {
  return new Date().toISOString();
}

/** SEO check result interface — shared across all tools. */
export interface CheckResult {
  id: string;
  category: string;
  severity: 'critical' | 'warning' | 'pass' | 'info';
  title: string;
  finding: string;
  recommendation?: string;
  data?: Record<string, unknown>;
}

/** Analysis result wrapper — returned by every tool. */
export interface AnalysisResult {
  tool: string;
  url: string;
  timestamp: string;
  checks: CheckResult[];
  summary: string;
}

/** Build an AnalysisResult. */
export function buildResult(tool: string, url: string, checks: CheckResult[], summary: string): AnalysisResult {
  return { tool, url, timestamp: isoNow(), checks, summary };
}
