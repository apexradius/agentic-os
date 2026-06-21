/**
 * Pure scoring functions — calculates weighted SEO health score from check results.
 * Uses scoring-spec.json for weights and grade boundaries.
 */

import type { CheckResult } from '../utils.js';
import scoringSpec from '../scoring-spec.json' with { type: 'json' };

const SEVERITY_SCORES: Record<string, number | null> = scoringSpec.severity_scores as Record<string, number | null>;

interface CategoryScore {
  score: number;
  weight: number;
  checksPassed: number;
  checksTotal: number;
  grade: string;
}

interface ScoreResult {
  overallScore: number;
  grade: string;
  categories: Record<string, CategoryScore>;
  criticalIssues: CheckResult[];
  warnings: CheckResult[];
  quickWins: CheckResult[];
  totalChecks: number;
  passedChecks: number;
}

/** Assign letter grade based on score. */
export function assignGrade(score: number): string {
  const grades = scoringSpec.grades as unknown as Record<string, [number, number]>;
  for (const [grade, [min, max]] of Object.entries(grades)) {
    if (score >= min && score <= max) return grade;
  }
  return 'F';
}

/** Calculate score for a single category. */
export function calculateCategoryScore(checks: CheckResult[], category: string): CategoryScore {
  const categoryChecks = checks.filter(c => c.category === category);
  if (categoryChecks.length === 0) {
    return { score: 100, weight: getCategoryWeight(category), checksPassed: 0, checksTotal: 0, grade: 'A' };
  }

  let totalWeight = 0;
  let earnedWeight = 0;
  let passed = 0;

  for (const check of categoryChecks) {
    const severityScore = SEVERITY_SCORES[check.severity];
    if (severityScore === null || severityScore === undefined) continue; // info checks not scored
    totalWeight += 1;
    earnedWeight += severityScore;
    if (check.severity === 'pass') passed++;
  }

  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 100;
  const weight = getCategoryWeight(category);

  return { score, weight, checksPassed: passed, checksTotal: categoryChecks.length, grade: assignGrade(score) };
}

function getCategoryWeight(category: string): number {
  const cats = scoringSpec.categories as Record<string, { weight: number }>;
  return cats[category]?.weight ?? 0;
}

/** Calculate overall weighted score from all check results. */
export function calculateOverallScore(checks: CheckResult[]): ScoreResult {
  const categories: Record<string, CategoryScore> = {};
  const allCategories = Object.keys(scoringSpec.categories);

  let weightedSum = 0;
  let totalWeight = 0;

  for (const cat of allCategories) {
    const catScore = calculateCategoryScore(checks, cat);
    categories[cat] = catScore;
    if (catScore.checksTotal > 0) {
      weightedSum += catScore.score * catScore.weight;
      totalWeight += catScore.weight;
    }
  }

  // Normalize if not all categories have checks
  const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  const criticalIssues = checks.filter(c => c.severity === 'critical');
  const warnings = checks.filter(c => c.severity === 'warning');
  const quickWins = warnings.filter(c => c.recommendation && c.recommendation.length < 200);
  const passedChecks = checks.filter(c => c.severity === 'pass').length;

  return {
    overallScore,
    grade: assignGrade(overallScore),
    categories,
    criticalIssues,
    warnings,
    quickWins,
    totalChecks: checks.filter(c => SEVERITY_SCORES[c.severity] !== null).length,
    passedChecks,
  };
}
