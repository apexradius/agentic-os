// rules/type.mjs — typography rules from design.md's "Type" section.

import { eachDecl } from './_shared.mjs';

const BODY_SELECTOR = /(^|[\s,])(body|html|:root|p)(\s|$|,|\.|:)/i;

export default [
  {
    id: 'body-text-min-size',
    title: 'Body text below 16px',
    severity: 'blocking',
    register: 'any',
    ref: 'design.md:37',
    check(surface) {
      const findings = [];
      for (const rule of surface.css?.rules ?? []) {
        if (!rule.selectors.some((s) => BODY_SELECTOR.test(s))) continue;
        for (const decl of rule.decls) {
          if (decl.prop !== 'font-size') continue;
          const px = toPx(decl.value);
          if (px != null && px < 16) {
            findings.push({
              line: decl.line,
              evidence: `${rule.selectors[0]} { font-size: ${decl.value} } — body text floor is 16px`,
            });
          }
        }
      }
      return findings;
    },
  },
  {
    id: 'viewport-font-scaling',
    title: 'Viewport-unit font scaling',
    severity: 'blocking',
    register: 'any',
    ref: 'design.md:37',
    check(surface) {
      const findings = [];
      for (const { decl, rule } of eachDecl(surface)) {
        if (decl.prop !== 'font-size') continue;
        if (/\d*\.?\d+(vw|vh|vmin|vmax)\b/i.test(decl.value)) {
          findings.push({
            line: decl.line,
            evidence: `${rule.selectors[0]} { font-size: ${decl.value} } — use stable role-based sizes`,
          });
        }
      }
      return findings;
    },
  },
];

function toPx(value) {
  const v = value.trim();
  let m = v.match(/^(-?\d*\.?\d+)px$/);
  if (m) return parseFloat(m[1]);
  m = v.match(/^(-?\d*\.?\d+)rem$/);
  if (m) return parseFloat(m[1]) * 16;
  m = v.match(/^(-?\d*\.?\d+)pt$/);
  if (m) return parseFloat(m[1]) * (96 / 72);
  return null;
}
