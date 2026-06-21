---
name: qa
description: "QA test a web application — find bugs, fix them, verify fixes. Three tiers: quick (critical only), standard (+ medium), exhaustive (+ cosmetic). Produces health score and fix evidence. Use when testing, QA, finding bugs, or /qa."
user-invocable: true
argument-hint: "[url-or-project] [quick|standard|exhaustive]"
---

# QA — Quality Assurance Testing

Systematically test, find bugs, fix them, and verify.

## Tiers

| Tier | Scope | Time |
|------|-------|------|
| **Quick** | Critical + high severity only | ~10 min |
| **Standard** | + medium severity | ~30 min |
| **Exhaustive** | + cosmetic, edge cases | ~60 min |

## Test Categories

### Functional
- Navigation: all links work, correct destinations
- Forms: validation, submission, error states
- Cart/checkout: add, remove, quantity, pricing
- Search: returns results, handles empty queries
- Auth: login, logout, protected pages

### Visual
- Responsive: 375px, 768px, 1024px, 1440px
- Cross-browser: Chrome, Safari, Firefox
- Dark mode (if applicable)
- Image loading, alt text, broken images
- Typography: overflow, truncation, readability

### Performance
- Page load time (target: <3s)
- Largest Contentful Paint
- Console errors (zero tolerance)
- Network failures (404s, 500s)

### Accessibility
- Keyboard navigation (tab order, focus visible)
- Screen reader basics (headings, alt text, ARIA)
- Color contrast (4.5:1 minimum)
- Touch targets (48px minimum on mobile)

## Process
1. **Scan**: Run through all test categories, log every issue
2. **Prioritize**: Critical → High → Medium → Low → Cosmetic
3. **Fix**: Address issues in priority order, one commit per fix
4. **Verify**: Re-test each fix, screenshot before/after
5. **Report**: Health score (0-100), issues found, issues fixed, remaining

## Output
```markdown
# QA Report: [Project]
**Date**: [date] | **Tier**: [tier] | **Score**: [X]/100

## Issues Found: [N]
| # | Severity | Description | Status |
|---|----------|-------------|--------|
| 1 | Critical | [desc] | Fixed |
| 2 | High | [desc] | Fixed |
| 3 | Medium | [desc] | Open |
```
