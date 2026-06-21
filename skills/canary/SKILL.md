---
name: canary
description: "Post-deploy canary monitoring — watch live site for errors, performance regressions, broken pages. Takes periodic screenshots and compares against baselines. Use after deploying, or /canary."
user-invocable: true
argument-hint: "[url] [duration-minutes]"
---

# Canary — Post-Deploy Monitoring

Watch a live deployment for issues after shipping.

## Checks (run every 2 minutes for specified duration)

1. **HTTP Status**: All key pages return 200
2. **Console Errors**: Check for new JS errors via Chrome DevTools MCP
3. **Performance**: Compare LCP/CLS against pre-deploy baseline
4. **Visual**: Screenshot and compare against baseline screenshots
5. **Network**: Check for failed API calls, 404s, 500s

## Key Pages to Monitor
- Homepage
- Product/main content page
- Cart/conversion page
- Search
- API endpoints (if applicable)

## Alert Conditions
- Any 5xx error → CRITICAL
- New console error not in baseline → HIGH
- LCP regression >500ms → MEDIUM
- Visual difference detected → LOW (manual review)

## Process
1. Take baseline screenshots BEFORE deploy
2. Deploy
3. Start canary monitoring loop
4. Log all checks to `canary-log.md`
5. Alert immediately on critical issues
6. After duration, produce summary report

## Output
```markdown
# Canary Report
**Deploy**: [commit] | **Duration**: [X] min | **Status**: PASS/FAIL

## Checks: [passed]/[total]
| Check | Result | Details |
|-------|--------|---------|
| HTTP 200 | ✅ | All pages OK |
| Console | ⚠️ | 1 new warning |
| Performance | ✅ | LCP +50ms (within threshold) |
```
