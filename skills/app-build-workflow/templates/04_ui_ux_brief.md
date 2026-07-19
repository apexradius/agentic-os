# UI/UX Design Brief

> Shared registers (decision log, assumptions, open questions, change requests) are maintained in `00_build_intake.md` / `01_prd.md`; log any raised here there.

## Product Personality

## Visual References Or Competitors
| Reference | Screen / Flow | Useful Pattern | What We Are Not Copying |
| --- | --- | --- | --- |

## Platform-Native Direction
- Target platform(s):
- Native typography:
- Native materials / depth:
- Navigation pattern:
- Permission prompts:
- Privacy affordances:

## Layout Principles
- Base grid system: [Default: 4px or 8px base grid for all spacing and padding]
- Visual hierarchy:
- Whitespace and density: [Rule: Avoid double-nesting cards; use whitespace or thin dividers for secondary grouping]
- Progressive disclosure: [Rule: Hide secondary actions in popovers, slide-out panels, or reveal on hover]
- Empty states: [Rule: Design instructive empty states with imagery, helpful copy, and a primary call-to-action]
- Header/title/subtext alignment:
- Icon and row alignment:
- Final action placement:
- Link/control styling:

## Full-Product Atlas Coverage
| Role / Mode | Route Or Surface | Primary Job | Required States | Handoff Destination |
| --- | --- | --- | --- | --- |

Coverage rule: map every in-scope route, role, empty/loading/error/success state, and cross-screen handoff before polishing any single screen.

## Surface And Depth Hierarchy
- Canvas background: [Rule: Avoid pure white or pure black; use off-whites for light mode, bluish-blacks/dark blues for dark mode]
- Primary instrument surface:
- Secondary card:
- Floating control:
- Selected / focused surface:
- Shadow and border restraint: [Rule: Avoid harsh default black shadows. Use light gray or tinted drop shadows with 15-20% opacity and increased blur]
- Dark mode depth: [Rule: Use lighter background colors for elevated elements, not shadows]

## Color Palette
> Register rule: apps are the **operational** register — build a *layered neutral shell*, not a 60-30-10 split (60-30-10 is a marketing/landing heuristic only).
- Base neutral (workspace background): [Off-white in light mode / off-black in dark mode — never pure #fff or #000]
- Structural-zone neutral: [One step off the base to separate nav / sidebar / cards; use whitespace or a soft shadow over borders]
- Dominant accent: [Reserved for the primary action only — not spread across tabs/categories]
- Active/selected state: [Mark with at least TWO cues, e.g. fill + weight; never color alone]
- Semantic colors: [Red (Destructive), Green (Success), Yellow (Warning), Blue/Purple (Active/Trust)]

## Typography
- Primary font (Sans-serif body): 
- Secondary font (Display/Headers only - limit to 2 fonts total): 
- Kerning & Line-height (Large text): [Rule: Over 70px, tighten kerning by -2% to -4%, line-height 110%-120%]
- Paragraph line-height: [Rule: ~150%]
- Copy rule: [Strictly ban 'Lorem Ipsum'; use realistic, natural language]

## Iconography And Illustration
- Category icon style:
- Functional icon style:
- Empty-state illustration style:
- App icon source:

## Companion / Mascot / Assistant Art Direction
- Use or omit:
- Canonical asset:
- Personality:
- Expressions:
- Motion:
- In-context placement:
- Reduced-motion fallback:

## Component List

## Analytics And Data Visualization
| User Question / Decision | Primary Metric | Chart Type | Comparison | Axes / Units | Current-Point Detail | Provenance / Freshness | Mobile Adaptation |
| --- | --- | --- | --- | --- | --- | --- | --- |

Each chart must make its series mapping explicit, label units, show an exact current-period value, name its comparison window, and identify data freshness. Use dual axes only when the two scales answer one decision together.

## Responsive Behavior
- Mobile:
- Tablet:
- Desktop:

## Accessibility Requirements
- Keyboard:
- Screen reader:
- Contrast:
- Reduced motion:
- Touch targets:

## Interaction State Matrix
| Component | Default | Hover | Focus | Disabled | Loading | Empty | Error | Success |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Motion And Microinteraction Rules
> **Key Guidelines:** 
> - **State Coverage:** All interactive elements must have Default, Hover, Active/Pressed, and Disabled states. Inputs must have Focused and Error states.
> - **Optimistic UI:** Instantly update UI for common non-destructive actions before server responses.
> - **Easing Curves:** Ban linear animations; use natural easing (custom bezier, spring dynamics, ease-out).
> - **Loops:** Looping animations (preloaders) must be slow-moving, minimal, and short.

| Motion | Trigger | Purpose | Duration | Easing | Reduced-Motion Fallback |
| --- | --- | --- | --- | --- | --- |

## Copy Tone

## Screen-By-Screen Rough Layout

## Prototype Or Annotated Screenshot Plan

## Visual Critique Passes
1. Coverage: routes, roles, states, and handoffs are complete.
2. Hierarchy: the dominant task or value is clear within two seconds.
3. Brand: typography, palette, logo, voice, and density are source-backed.
4. Premium restraint: depth, shadows, gradients, and motion establish hierarchy without decorating every surface.
5. Data truth: charts have meaningful scales, labels, legends, comparisons, exact values, and provenance.
6. Responsive proof: desktop, tablet, and mobile are rendered after transitions settle and inspected individually.

## Mobile And Desktop Verification Plan

## Gate
- [ ] First screen is the actual product experience.
- [ ] Interface matches the app category.
- [ ] Text cannot overlap or depend on viewport-scaled fonts.
- [ ] Final actions do not cover content; users can scroll to them when needed.
- [ ] In-app controls do not inherit browser-default link underlines unless intentionally designed.
- [ ] Icons, text, subtext, and trailing values align consistently in rows and buttons.
- [ ] Companion/mascot appears alive only through bounded, accessible, non-distracting motion.
- [ ] Every in-scope route, role, primary state, and cross-screen handoff appears in the atlas.
- [ ] The dominant task or value and primary action are identifiable within two seconds.
- [ ] Depth is hierarchical; cards do not all use the same shadow or decorative treatment.
- [ ] Every decision-bearing chart has a question, units, comparison, legend, exact current value, provenance, and responsive adaptation.
- [ ] Mobile charts remain readable; controls and callouts adapt instead of compressing a desktop plot into illegibility.
- [ ] Controls use familiar patterns.
- [ ] Focus states, keyboard paths, and screen-reader labels are specified.
- [ ] Contrast and touch targets meet the target platform's accessibility floor (min 44px tap targets for mobile).
- [ ] Mobile and desktop layouts are specified.
- [ ] Screenshot or prototype evidence is named before launch.
- [ ] Operational color uses a layered neutral shell (not 60-30-10); backgrounds avoid pure black/white; the accent is reserved for the primary action.
- [ ] Shadows are softened (low opacity, high blur) or removed; dark mode elevation uses lightness, not shadows.
- [ ] No more than two fonts are used; display fonts are kept out of paragraph text.
- [ ] Large text kerning is tightened (-2% to -4%) and line-heights are mathematically defined (150% for body, 110-130% for headers).
- [ ] Realistic copy is used everywhere (no Lorem Ipsum).
- [ ] Icons are sourced from a single consistent pack and matched in line weight and style.
