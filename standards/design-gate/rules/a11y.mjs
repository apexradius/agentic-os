// rules/a11y.mjs — the accessibility constraint floors from design.md (visible focus,
// touch-target size, labeled icon-only controls).

import { walk } from '../lib/html.mjs';
import { declOf, isInteractiveSelector, singlePx } from './_shared.mjs';

export default [
  {
    id: 'focus-removed',
    title: 'Focus outline removed with no visible replacement',
    severity: 'blocking',
    register: 'any',
    ref: 'design.md:51',
    check(surface) {
      const css = surface.css;
      if (!css) return [];
      const hasFocusVisible = css.focusVisibleSelectors.length > 0;
      if (hasFocusVisible) return []; // a :focus-visible rule supplies the visible state
      const findings = [];
      for (const rule of css.rules) {
        const onFocus =
          rule.selectors.some((s) => /:focus\b/.test(s)) || isInteractiveSelector(rule);
        if (!onFocus) continue;
        const outline = declOf(rule, /^(outline|outline-style|outline-width)$/);
        const removed = outline && /(^|\s)(none|0)(\s|$|px)/.test(outline.value.trim());
        const replacement = declOf(rule, /^box-shadow$/) || declOf(rule, /^border$/);
        if (removed && !replacement) {
          findings.push({
            line: outline.line,
            evidence: `${rule.selectors[0]} { ${outline.prop}: ${outline.value} } — removes focus with no visible replacement`,
          });
        }
      }
      return findings;
    },
  },
  {
    id: 'touch-target-min',
    title: 'Interactive target below ~24px',
    severity: 'blocking',
    register: 'any',
    ref: 'design.md:51',
    check(surface) {
      const findings = [];
      for (const rule of surface.css?.rules ?? []) {
        if (!isInteractiveSelector(rule)) continue;
        for (const decl of rule.decls) {
          if (!/^(height|min-height|width|min-width)$/.test(decl.prop)) continue;
          const px = singlePx(decl.value);
          if (px != null && px > 0 && px < 24) {
            findings.push({
              line: decl.line,
              evidence: `${rule.selectors[0]} { ${decl.prop}: ${decl.value} } — touch targets are ≥ ~24px`,
            });
          }
        }
      }
      return findings;
    },
  },
  {
    id: 'icon-only-needs-label',
    title: 'Icon-only control with no accessible label',
    severity: 'blocking',
    register: 'any',
    ref: 'design.md:47',
    check(surface) {
      if (!surface.dom) return [];
      const findings = [];
      walk(surface.dom, (node) => {
        const isControl =
          node.tag === 'button' ||
          node.tag === 'a' ||
          /^(button|link)$/.test(node.attrs.role || '');
        if (!isControl) return;
        const hasText = node.text && node.text.replace(/\s/g, '').length > 0;
        const hasLabel =
          node.attrs['aria-label'] || node.attrs.title || node.attrs['aria-labelledby'];
        const iconChild = node.children.some(
          (c) =>
            c.tag === 'svg' ||
            c.tag === 'i' ||
            c.tag === 'use' ||
            /icon/i.test(c.classes.join(' ')),
        );
        const selfIcon = /icon/i.test(node.classes.join(' '));
        if (!hasText && !hasLabel && (iconChild || selfIcon)) {
          findings.push({
            line: node.line,
            evidence: `<${node.tag}${node.attrs.class ? ` class="${node.attrs.class}"` : ''}> is icon-only — add aria-label or visible text`,
          });
        }
      });
      return findings;
    },
  },
];
