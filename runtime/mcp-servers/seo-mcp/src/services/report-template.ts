/**
 * HTML report template generator — produces self-contained HTML with inline SVG charts.
 * No external dependencies, no JavaScript libraries.
 */

interface CategoryData {
  score: number;
  weight: number;
  checksPassed: number;
  checksTotal: number;
  grade: string;
}

interface ReportData {
  url: string;
  date: string;
  overallScore: number;
  grade: string;
  totalChecks: number;
  passedChecks: number;
  categories: Record<string, CategoryData>;
  criticalIssues: Array<{ id: string; category: string; title: string; finding: string; recommendation?: string }>;
  warnings: Array<{ id: string; category: string; title: string; finding: string; recommendation?: string }>;
  quickWins: Array<{ id: string; title: string; recommendation?: string }>;
}

function scoreColor(score: number): string {
  if (score >= 90) return '#22c55e';
  if (score >= 80) return '#84cc16';
  if (score >= 70) return '#eab308';
  if (score >= 60) return '#f97316';
  return '#ef4444';
}

function svgScoreCircle(score: number, size: number = 120): string {
  const r = (size - 10) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="8"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="8"
      stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
      transform="rotate(-90 ${size/2} ${size/2})" stroke-linecap="round"/>
    <text x="${size/2}" y="${size/2 - 8}" text-anchor="middle" font-size="32" font-weight="bold" fill="${color}">${score}</text>
    <text x="${size/2}" y="${size/2 + 16}" text-anchor="middle" font-size="14" fill="#6b7280">/100</text>
  </svg>`;
}

function svgCategoryBar(name: string, score: number, maxWidth: number = 300): string {
  const color = scoreColor(score);
  const width = (score / 100) * maxWidth;
  const displayName = name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ');
  return `<div style="display:flex;align-items:center;margin:8px 0;gap:12px;">
    <span style="width:140px;font-size:14px;color:#374151;">${displayName}</span>
    <svg width="${maxWidth + 10}" height="24" viewBox="0 0 ${maxWidth + 10} 24">
      <rect x="0" y="4" width="${maxWidth}" height="16" rx="8" fill="#f3f4f6"/>
      <rect x="0" y="4" width="${width}" height="16" rx="8" fill="${color}"/>
    </svg>
    <span style="font-size:14px;font-weight:600;color:${color};min-width:40px;">${score}</span>
  </div>`;
}

function issueCard(issue: { title: string; finding: string; category: string; recommendation?: string }, severity: string): string {
  const colors: Record<string, { bg: string; border: string; label: string }> = {
    critical: { bg: '#fef2f2', border: '#fca5a5', label: '#dc2626' },
    warning: { bg: '#fffbeb', border: '#fcd34d', label: '#d97706' },
    quickwin: { bg: '#f0fdf4', border: '#86efac', label: '#16a34a' },
  };
  const c = colors[severity] || colors.warning;
  return `<div style="background:${c.bg};border:1px solid ${c.border};border-radius:8px;padding:12px 16px;margin:8px 0;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <strong style="color:#111827;">${issue.title}</strong>
      <span style="font-size:12px;background:${c.label};color:white;padding:2px 8px;border-radius:12px;">${issue.category}</span>
    </div>
    <p style="color:#4b5563;margin:4px 0 0;font-size:14px;">${issue.finding}</p>
    ${issue.recommendation ? `<p style="color:#059669;margin:4px 0 0;font-size:13px;">→ ${issue.recommendation}</p>` : ''}
  </div>`;
}

export function generateReportHtml(data: ReportData): string {
  const categoryBars = Object.entries(data.categories)
    .sort(([, a], [, b]) => b.weight - a.weight)
    .map(([name, cat]) => svgCategoryBar(name, cat.score))
    .join('\n');

  const criticals = data.criticalIssues.map(i => issueCard(i, 'critical')).join('\n');
  const warns = data.warnings.slice(0, 10).map(i => issueCard(i, 'warning')).join('\n');
  const qw = data.quickWins.slice(0, 5).map(i => issueCard({ ...i, finding: i.recommendation || '', category: 'quick win' }, 'quickwin')).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SEO Audit — ${data.url}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; color: #111827; }
    .header { background: linear-gradient(135deg, #1e1b4b, #312e81); color: white; padding: 40px; text-align: center; }
    .header h1 { font-size: 28px; margin-bottom: 8px; word-break: break-all; }
    .header .meta { color: #c7d2fe; font-size: 14px; }
    .score-section { display: flex; justify-content: center; align-items: center; gap: 24px; margin: 24px 0; }
    .grade-badge { font-size: 48px; font-weight: 800; }
    .container { max-width: 900px; margin: 0 auto; padding: 24px; }
    .card { background: white; border-radius: 12px; padding: 24px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .card h2 { font-size: 20px; margin-bottom: 16px; color: #1e1b4b; }
    .stats { display: flex; gap: 16px; flex-wrap: wrap; margin: 16px 0; }
    .stat { background: #f3f4f6; border-radius: 8px; padding: 12px 20px; text-align: center; flex: 1; min-width: 120px; }
    .stat .value { font-size: 24px; font-weight: 700; }
    .stat .label { font-size: 12px; color: #6b7280; }
    .footer { text-align: center; padding: 32px; color: #9ca3af; font-size: 13px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${data.url}</h1>
    <div class="meta">SEO Audit Report • ${data.date}</div>
    <div class="score-section">
      ${svgScoreCircle(data.overallScore, 140)}
      <div class="grade-badge" style="color:${scoreColor(data.overallScore)}">${data.grade}</div>
    </div>
  </div>
  <div class="container">
    <div class="stats">
      <div class="stat"><div class="value">${data.totalChecks}</div><div class="label">Total Checks</div></div>
      <div class="stat"><div class="value" style="color:#22c55e">${data.passedChecks}</div><div class="label">Passed</div></div>
      <div class="stat"><div class="value" style="color:#ef4444">${data.criticalIssues.length}</div><div class="label">Critical</div></div>
      <div class="stat"><div class="value" style="color:#f97316">${data.warnings.length}</div><div class="label">Warnings</div></div>
    </div>

    <div class="card">
      <h2>Score Breakdown</h2>
      ${categoryBars}
    </div>

    ${data.criticalIssues.length > 0 ? `<div class="card">
      <h2 style="color:#dc2626;">Critical Issues (${data.criticalIssues.length})</h2>
      ${criticals}
    </div>` : ''}

    ${data.warnings.length > 0 ? `<div class="card">
      <h2 style="color:#d97706;">Warnings (${data.warnings.length})</h2>
      ${warns}
      ${data.warnings.length > 10 ? `<p style="color:#9ca3af;margin-top:12px;">+ ${data.warnings.length - 10} more warnings</p>` : ''}
    </div>` : ''}

    ${data.quickWins.length > 0 ? `<div class="card">
      <h2 style="color:#16a34a;">Quick Wins (${data.quickWins.length})</h2>
      ${qw}
    </div>` : ''}
  </div>
  <div class="footer">
    Generated by ${process.env.SEO_REPORT_BRAND ? process.env.SEO_REPORT_BRAND + ' ' : ''}SEO Audit Engine • ${data.date}
  </div>
</body>
</html>`;
}
