---
name: design-system
description: "Create or document a design system — tokens, components, patterns, usage guidelines. Outputs CSS custom properties + component library. Use when establishing design standards, or /design-system."
user-invocable: true
argument-hint: "[brand-name-or-project]"
---

# Design System Generator

Create a comprehensive design system with tokens, components, and documentation.

## Design Tokens

### Colors
```css
:root {
  /* Brand */
  --color-primary: [from brand-kit];
  --color-primary-hover: [10% darker];
  --color-primary-light: [90% lighter];
  
  /* Semantic */
  --color-success: #22C55E;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;
  
  /* Neutral */
  --color-gray-50 through --color-gray-900;
}
```

### Typography Scale
```css
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */
```

### Spacing Scale
```css
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-12: 3rem;    /* 48px */
--space-16: 4rem;    /* 64px */
```

## Design Principles

### 60-30-10 Color Rule
- **60%**: Dominant/background color (neutral)
- **30%**: Secondary color (structural elements, nav, cards)
- **10%**: Accent/action color (CTAs, highlights, interactive states)

### Typography Foundation
- Base size: 16px minimum for body text (accessibility)
- Increment rule: use 2px jumps within a size range, not arbitrary values
- Weight hierarchy: Regular (400) for body, Medium (500) for UI labels, Bold (700) for headings only
- Letter-spacing: tight (-0.02em) for luxury, wide (0.05em) for minimal/clean, normal for friendly

### Visual Hierarchy
- Maximum 3 levels of visual weight per section
- Negative space = breathing room; don't fill every pixel
- Contrast drives attention: highest contrast = primary CTA

### 10-Second Website Orientation
Every page must answer within the first scroll (no jargon):
1. **What is this?** — clear category/product name
2. **Is this for me?** — audience signal in the headline or subheadline
3. **Can I trust it?** — visible logos, testimonials, or credentials

### Bento Box Grid Pattern
For feature grids: mix 2×1, 1×2, and 1×1 cells rather than uniform grids — creates visual interest while maintaining alignment.

## Component Patterns
- Buttons (primary, secondary, ghost, danger, sizes)
- Form inputs (text, select, checkbox, radio, toggle)
- Cards (basic, interactive, media)
- Navigation (header, sidebar, breadcrumb, tabs)
- Feedback (alert, toast, badge, progress)
- Layout (container, grid, stack, divider)

## Output
`design-system/`
  - `tokens.css` — all design tokens
  - `components.css` — component styles
  - `GUIDE.md` — usage documentation with examples
