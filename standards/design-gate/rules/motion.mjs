// rules/motion.mjs — motion rules from design.md ("animate opacity and transform only";
// "prefers-reduced-motion is mandatory").

import { eachDecl } from './_shared.mjs';

const ALLOWED = new Set(['opacity', 'transform', '-webkit-transform']);
const TIMING =
  /^(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end|steps|cubic-bezier|initial|inherit|unset|none|infinite|alternate|normal|reverse|forwards|backwards|both|running|paused)$/;

function transitionProps(value) {
  const props = [];
  for (const seg of value.split(',')) {
    const tokens = seg.trim().split(/\s+/);
    let prop = null;
    for (const t of tokens) {
      const low = t.toLowerCase();
      if (/^[a-z][a-z-]*$/.test(low) && !TIMING.test(low)) {
        prop = low;
        break;
      }
    }
    props.push(prop); // null = implicit `all`
  }
  return props;
}

export default [
  {
    id: 'motion-properties',
    title: 'Transition animates more than opacity/transform',
    severity: 'blocking',
    register: 'any',
    ref: 'design.md:42',
    check(surface) {
      const findings = [];
      for (const { decl, rule } of eachDecl(surface)) {
        if (decl.prop === 'transition-property' || decl.prop === 'transition') {
          const props =
            decl.prop === 'transition-property'
              ? decl.value.split(',').map((s) => s.trim().toLowerCase())
              : transitionProps(decl.value);
          const bad = props.filter(
            (p) => p === null || p === 'all' || (!ALLOWED.has(p) && p !== 'none'),
          );
          if (bad.length) {
            const shown = bad.map((p) => p ?? 'all (implicit)').join(', ');
            findings.push({
              line: decl.line,
              evidence: `${rule.selectors[0]} { ${decl.prop}: ${decl.value} } — animates ${shown}; use opacity/transform`,
            });
          }
        }
      }
      return findings;
    },
  },
  {
    id: 'reduced-motion-required',
    title: 'Motion present with no prefers-reduced-motion handling',
    severity: 'blocking',
    register: 'any',
    ref: 'design.md:54',
    check(surface) {
      const css = surface.css;
      if (!css) return [];
      const hasMotion =
        css.keyframes.length > 0 ||
        [...eachDecl(surface)].some(
          ({ decl }) =>
            (decl.prop === 'transition' ||
              decl.prop === 'transition-duration' ||
              decl.prop === 'animation' ||
              decl.prop === 'animation-name') &&
            !/^(none|0s?|initial|inherit|unset)$/i.test(decl.value.trim()),
        );
      if (hasMotion && !css.hasReducedMotionQuery) {
        return [
          {
            line: 1,
            evidence:
              'transitions/animations defined but no @media (prefers-reduced-motion: reduce) block',
          },
        ];
      }
      return [];
    },
  },
];
