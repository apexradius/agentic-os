// rules/layout.mjs — radius (register-aware), spacing grid, card structure, and the
// "generic-AI look" surface tells (glassmorphism, decorative orbs, gradient heroes).

import { isCard, walk } from '../lib/html.mjs';
import {
  declOf,
  isCardSelector,
  isInteractiveSelector,
  isTokenDefScope,
  pxLengths,
} from './_shared.mjs';

const RADIUS_PROP = /^border(-(top|bottom)-(left|right))?-radius$/;

function radiusInfo(value) {
  const v = value.trim().toLowerCase();
  if (v === '0' || /^0(px|%|rem|em)$/.test(v)) return { zero: true, full: false, maxPx: 0 };
  const pxs = pxLengths(v);
  const maxPx = pxs.length ? Math.max(...pxs.map(Math.abs)) : null;
  const full =
    /\b50%/.test(v) || /\b9999px/.test(v) || /\b999px/.test(v) || (maxPx != null && maxPx >= 100);
  return { zero: false, full, maxPx };
}

function radiusOf(rule) {
  let info = null;
  for (const d of rule.decls)
    if (RADIUS_PROP.test(d.prop)) info = { ...radiusInfo(d.value), decl: d };
  return info;
}

export default [
  {
    id: 'radius-marketing-zero',
    title: 'Soft corner radius on a marketing surface',
    severity: 'blocking',
    register: 'marketing',
    ref: 'design.md:35',
    check(surface) {
      const findings = [];
      for (const rule of surface.css?.rules ?? []) {
        const r = radiusOf(rule);
        if (r && !r.zero && !r.full) {
          findings.push({
            line: r.decl.line,
            evidence: `${rule.selectors[0]} { ${r.decl.prop}: ${r.decl.value} } — marketing surfaces use radius 0`,
          });
        }
      }
      return findings;
    },
  },
  {
    id: 'radius-operational-max',
    title: 'Radius over the ~8px operational max',
    severity: 'blocking',
    register: 'operational',
    ref: 'design.md:35',
    check(surface) {
      const findings = [];
      for (const rule of surface.css?.rules ?? []) {
        const r = radiusOf(rule);
        if (r && !r.zero && !r.full && r.maxPx != null && r.maxPx > 8) {
          findings.push({
            line: r.decl.line,
            evidence: `${rule.selectors[0]} { ${r.decl.prop}: ${r.decl.value} } — operational max is ~8px`,
          });
        }
      }
      return findings;
    },
  },
  {
    id: 'pill-everything',
    title: 'Many controls pill-shaped',
    severity: 'note',
    register: 'any',
    ref: 'design.md:35',
    check(surface) {
      const pilled = [];
      for (const rule of surface.css?.rules ?? []) {
        if (!isInteractiveSelector(rule)) continue;
        const r = radiusOf(rule);
        if (r && r.full) pilled.push(rule.selectors[0]);
      }
      if (pilled.length >= 2) {
        return [
          {
            line: 1,
            evidence: `${pilled.length} interactive selectors fully rounded (${pilled.slice(0, 3).join(', ')}…) — don't pill every control`,
          },
        ];
      }
      return [];
    },
  },
  {
    id: 'nested-card',
    title: 'Card nested inside another card',
    severity: 'blocking',
    register: 'any',
    ref: 'design.md:38',
    check(surface) {
      if (!surface.dom) return [];
      const findings = [];
      walk(surface.dom, (node) => {
        if (!isCard(node)) return;
        for (let p = node.parent; p && p.tag !== '#root'; p = p.parent) {
          if (isCard(p)) {
            findings.push({
              line: node.line,
              evidence: `<${node.tag} class="${node.classes.join(' ')}"> is a card inside card <${p.tag} class="${p.classes.join(' ')}">`,
            });
            break;
          }
        }
      });
      return findings;
    },
  },
  {
    id: 'side-stripe-card',
    title: 'Side-stripe (left-border accent) card',
    severity: 'blocking',
    register: 'any',
    ref: 'design.md:40',
    check(surface) {
      const findings = [];
      for (const rule of surface.css?.rules ?? []) {
        if (!isCardSelector(rule)) continue;
        const stripe = declOf(rule, /^border-(left|inline-start)(-width)?$/);
        const fullBorder = declOf(rule, /^border$/);
        if (stripe && !fullBorder) {
          const w = pxLengths(stripe.value);
          if (w.some((n) => n >= 3)) {
            findings.push({
              line: stripe.line,
              evidence: `${rule.selectors[0]} { ${stripe.prop}: ${stripe.value} } — side-stripe card`,
            });
          }
        }
      }
      return findings;
    },
  },
  {
    id: 'off-8px-grid',
    title: 'Spacing off the 8px grid',
    severity: 'note',
    register: 'any',
    ref: 'design.md:38',
    check(surface) {
      const findings = [];
      const SPACING = /^(margin|padding|gap|row-gap|column-gap)(-(top|right|bottom|left))?$/;
      for (const rule of surface.css?.rules ?? []) {
        for (const decl of rule.decls) {
          if (!SPACING.test(decl.prop)) continue;
          const offenders = pxLengths(decl.value).filter((n) => n !== 0 && Math.abs(n) % 4 !== 0);
          if (offenders.length) {
            findings.push({
              line: decl.line,
              evidence: `${rule.selectors[0]} { ${decl.prop}: ${decl.value} } — off the 4/8px grid`,
            });
          }
        }
      }
      return findings;
    },
  },
  {
    id: 'glassmorphism-default',
    title: 'Glassmorphism (backdrop blur) as default surface',
    severity: 'note',
    register: 'any',
    ref: 'design.md:16',
    check(surface) {
      const findings = [];
      for (const rule of surface.css?.rules ?? []) {
        const bd = declOf(rule, /^(-webkit-)?backdrop-filter$/);
        if (bd && /blur\(/.test(bd.value)) {
          findings.push({
            line: bd.line,
            evidence: `${rule.selectors[0]} { ${bd.prop}: ${bd.value} } — avoid glassmorphism-as-default`,
          });
        }
      }
      return findings;
    },
  },
  {
    id: 'decorative-orbs',
    title: 'Decorative blurred orb/blob',
    severity: 'note',
    register: 'any',
    ref: 'design.md:16',
    check(surface) {
      const findings = [];
      for (const rule of surface.css?.rules ?? []) {
        const sel = rule.selectors.join(' ');
        const byClass = /\b(orb|blob|glow|aurora)\b/i.test(sel);
        const r = radiusOf(rule);
        const filt = declOf(rule, /^filter$/);
        const pos = declOf(rule, /^position$/);
        const blurredRound =
          r &&
          r.full &&
          filt &&
          /blur\(/.test(filt.value) &&
          pos &&
          /absolute|fixed/.test(pos.value);
        if (byClass || blurredRound) {
          findings.push({
            line: rule.line,
            evidence: `${rule.selectors[0]} — decorative orb/blob; design.md rejects atmospheric filler`,
          });
        }
      }
      return findings;
    },
  },
  {
    id: 'gradient-hero',
    title: 'Gradient-filler hero',
    severity: 'note',
    register: 'any',
    ref: 'design.md:16',
    check(surface) {
      const findings = [];
      for (const rule of surface.css?.rules ?? []) {
        const sel = rule.selectors.join(' ');
        if (!/\bhero\b|\bjumbotron\b|\bbanner\b/i.test(sel)) continue;
        const bg = declOf(rule, /^(background|background-image)$/);
        if (bg && /gradient\(/.test(bg.value)) {
          findings.push({
            line: bg.line,
            evidence: `${rule.selectors[0]} uses a gradient fill — confirm real product/place imagery, not generic-AI filler`,
          });
        }
      }
      return findings;
    },
  },
  {
    id: 'untokenized-shadow',
    title: 'One-off box-shadow literal',
    severity: 'note',
    register: 'any',
    ref: 'design.md:53',
    check(surface) {
      const findings = [];
      for (const rule of surface.css?.rules ?? []) {
        if (isTokenDefScope(rule)) continue;
        const sh = declOf(rule, /^box-shadow$/);
        if (sh && sh.value.trim() !== 'none' && !sh.value.includes('var(')) {
          findings.push({
            line: sh.line,
            evidence: `${rule.selectors[0]} { box-shadow: ${sh.value.slice(0, 40)}… } — tokenize shadows`,
          });
        }
      }
      return findings;
    },
  },
];
