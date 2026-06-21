---
name: browser-test
description: "Visual browser testing using Chrome DevTools MCP. Navigates pages, takes screenshots, checks responsive layouts, validates UI. Use when testing themes, checking deployments, visual regression, or /browser-test."
user-invocable: true
argument-hint: "[url]"
---

# Browser Test — Visual UI Validation

Automated visual testing using the Chrome DevTools MCP tools.

## Prerequisites
- Chrome running with remote debugging: `chrome-debug` alias or `open -a "Google Chrome" --args --remote-debugging-port=9222`
- Chrome DevTools MCP connected

## Test Suite

### 1. Desktop Check (1440px)
```
mcp__chrome-devtools__new_page → navigate_page [url]
mcp__chrome-devtools__resize_page width:1440 height:900
mcp__chrome-devtools__take_screenshot → review
```

### 2. Tablet Check (768px)
```
mcp__chrome-devtools__resize_page width:768 height:1024
mcp__chrome-devtools__take_screenshot → review
```

### 3. Mobile Check (375px)
```
mcp__chrome-devtools__resize_page width:375 height:812
mcp__chrome-devtools__take_screenshot → review
```

### 4. Interaction Tests
- Click navigation links, verify page loads
- Open mobile menu, verify drawer appears
- Add to cart, verify cart updates
- Fill forms, verify validation

### 5. Performance Check
```
mcp__chrome-devtools__lighthouse_audit → review scores
```

### 6. Console Errors
```
mcp__chrome-devtools__list_console_messages → flag errors
```

## Review Criteria
For each screenshot, check:
- [ ] No layout overflow or horizontal scroll
- [ ] Text is readable (not cut off or overlapping)
- [ ] Images display correctly (no broken images)
- [ ] Navigation is accessible
- [ ] Interactive elements are tappable on mobile (48px min)
- [ ] No visual regressions from last check

## Multi-Page Testing
For Shopify themes, test these pages:
1. Homepage
2. Collection page (`/collections/all`)
3. Product page (first product)
4. Cart page (`/cart`)
5. Search page (`/search?q=test`)
6. 404 page (`/not-a-page`)

## Output
Screenshot each page at each breakpoint. Flag any issues found with description and severity.
