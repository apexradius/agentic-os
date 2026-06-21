// rules/color.mjs — color, contrast, and palette rules from design.md's "Color" section.

import { parseColor, extractColors, COLOR_KEYWORDS } from "../lib/color.mjs";
import { contrast } from "../lib/color.mjs";
import { resolveVar } from "../lib/css.mjs";
import { classifyPalette, isPurpleBlueDominated } from "../lib/histogram.mjs";
import { eachDecl, isTokenDefScope, isLiteralColor, declOf } from "./_shared.mjs";
import { walk } from "../lib/html.mjs";

const EXACT_COLOR_PROPS = /^(color|background-color|border(-(top|right|bottom|left|block|inline))?-color|outline-color|fill|stroke|caret-color|text-decoration-color|column-rule-color|accent-color)$/;
const SHORTHAND_COLOR_PROPS = /^(background|border(-(top|right|bottom|left))?|outline)$/;

export default [
  {
    id: "gradient-text",
    title: "Gradient-clipped transparent text",
    severity: "blocking",
    register: "any",
    ref: "design.md:40",
    check(surface) {
      const findings = [];
      for (const rule of surface.css?.rules ?? []) {
        const clip = declOf(rule, /^(-webkit-)?background-clip$/);
        const fill = declOf(rule, /^(color|-webkit-text-fill-color)$/);
        const clipsText = clip && /\btext\b/.test(clip.value);
        const transparent = fill && /transparent/i.test(fill.value);
        if (clipsText && transparent) {
          findings.push({ line: clip.line, evidence: `${rule.selectors[0]} { background-clip: text; ${fill.prop}: ${fill.value} }` });
        }
      }
      return findings;
    },
  },
  {
    id: "gradient-domination",
    title: "Purple/blue gradient domination",
    severity: "note",
    register: "any",
    ref: "design.md:40",
    check(surface) {
      const findings = [];
      for (const { decl, rule } of eachDecl(surface)) {
        if (!/gradient\(/.test(decl.value)) continue;
        const colors = extractColors(decl.value).map((c) => c.rgb);
        if (isPurpleBlueDominated(colors)) {
          findings.push({ line: decl.line, evidence: `${rule.selectors[0]}: ${decl.value.slice(0, 60)}` });
        }
      }
      return findings;
    },
  },
  {
    id: "one-hue-palette",
    title: "One-hue palette (no semantic color range)",
    severity: "note",
    register: "any",
    ref: "design.md:40",
    check(surface) {
      const colors = collectPalette(surface);
      const p = classifyPalette(colors);
      if (p.oneHue) {
        return [{ line: 1, evidence: `${p.chromaticCount} chromatic colors all within ${p.spreadDegrees}° of hue ~${p.dominantHue}` }];
      }
      return [];
    },
  },
  {
    id: "beige-brown-monotone",
    title: "Beige/brown monotone palette",
    severity: "note",
    register: "any",
    ref: "design.md:40",
    check(surface) {
      const colors = collectPalette(surface);
      const p = classifyPalette(colors);
      if (p.beigeBrown) {
        return [{ line: 1, evidence: `dominant warm-muted band (beige/brown), ${p.chromaticCount} chromatic colors` }];
      }
      return [];
    },
  },
  {
    id: "untokenized-color",
    title: "One-off color literal in a component",
    severity: "blocking",
    register: "any",
    ref: "design.md:53",
    check(surface) {
      const findings = [];
      for (const rule of surface.css?.rules ?? []) {
        if (isTokenDefScope(rule)) continue;
        for (const decl of rule.decls) {
          if (decl.prop.startsWith("--")) continue; // a token definition itself
          let literal = null;
          if (EXACT_COLOR_PROPS.test(decl.prop) && isLiteralColor(decl.value)) {
            literal = decl.value.trim();
          } else if (SHORTHAND_COLOR_PROPS.test(decl.prop)) {
            literal = literalColorIn(decl.value);
          }
          if (literal) {
            findings.push({ line: decl.line, evidence: `${rule.selectors[0]} { ${decl.prop}: …${literal}… } — use a var(--token)` });
          }
        }
      }
      return findings;
    },
  },
  {
    id: "contrast-aa",
    title: "Text contrast below WCAG AA (4.5:1)",
    severity: "blocking",
    register: "any",
    ref: "design.md:51",
    check(surface) {
      const findings = [];
      const cp = surface.css?.customProps ?? new Map();
      for (const rule of surface.css?.rules ?? []) {
        const fgD = declOf(rule, /^color$/);
        const bgD = declOf(rule, /^(background-color|background)$/);
        if (!fgD || !bgD) continue;
        const fg = parseColor(resolveVar(fgD.value, cp));
        const bgRaw = resolveVar(bgD.value, cp);
        const bg = parseColor(firstColorToken(bgRaw));
        if (!fg || !bg || bg.a < 1) continue; // need a solid, resolvable pair
        const ratio = contrast(fg, bg);
        if (ratio < 4.5) {
          findings.push({ line: fgD.line, evidence: `${rule.selectors[0]}: ${ratio.toFixed(2)}:1 (need 4.5:1) — fg ${fgD.value} on bg ${bgD.value}` });
        }
      }
      return findings;
    },
  },
  {
    id: "color-only-status",
    title: "Status conveyed by color alone",
    severity: "note",
    register: "any",
    ref: "design.md:41",
    check(surface) {
      if (!surface.dom) return [];
      const findings = [];
      const statusRe = /\b(status|badge|indicator|dot|chip|state)\b/i;
      const variantRe = /\b(success|error|danger|warning|info|online|offline|active|inactive|green|red|amber|good|bad)\b/i;
      walk(surface.dom, (node) => {
        const cls = node.classes.join(" ");
        if (!statusRe.test(cls) || !variantRe.test(cls)) return;
        const hasText = node.text && node.text.replace(/\s/g, "").length > 0;
        const hasLabel = node.attrs["aria-label"] || node.attrs.title || node.attrs["aria-labelledby"];
        const hasIcon = node.children.some((c) => c.tag === "svg" || c.tag === "i" || c.tag === "use" || /icon/i.test(c.classes.join(" ")));
        if (!hasText && !hasLabel && !hasIcon) {
          findings.push({ line: node.line, evidence: `<${node.tag} class="${cls}"> conveys status with color only — add text or icon` });
        }
      });
      return findings;
    },
  },
];

function collectPalette(surface) {
  const colors = [];
  for (const { decl } of eachDecl(surface)) {
    if (!/color|background|border|fill|stroke|gradient|shadow/.test(decl.prop) && !/gradient\(/.test(decl.value)) continue;
    for (const c of extractColors(decl.value)) colors.push(c.rgb);
  }
  for (const v of (surface.css?.customProps ?? new Map()).values()) {
    for (const c of extractColors(v)) colors.push(c.rgb);
  }
  return colors;
}

function literalColorIn(value) {
  if (/gradient\(/.test(value)) return null; // gradients handled by gradient rules
  const m = value.match(/#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?)\([^)]*\)/);
  if (m && !value.includes("var(")) return m[0];
  // a bare named color that isn't a keyword
  for (const tok of value.split(/\s+/)) {
    const v = tok.toLowerCase();
    if (!COLOR_KEYWORDS.has(v) && parseColor(v) && !/^\d/.test(v) && !v.includes("(")) return tok;
  }
  return null;
}

function firstColorToken(value) {
  if (/gradient\(/.test(value)) return null;
  const m = value.match(/#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?)\([^)]*\)|\b[a-zA-Z]+\b/);
  return m ? m[0] : value;
}
