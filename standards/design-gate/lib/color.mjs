// lib/color.mjs — color parsing + WCAG contrast + rgb/hsl, dependency-free.
//
// The gate must reason about color deterministically: is this pair AA-legible? is the
// palette one-hue? Those answers need real color math, not regex guesses. Everything
// here is a pure function over {r,g,b,a} with r,g,b in 0–255 and a in 0–1.

// The 16 CSS level-1 names plus the handful that actually show up in real stylesheets.
// Unknown names resolve to null — a rule that can't resolve a color skips it (honest:
// we never assert contrast on a color we couldn't read).
const NAMED = {
  black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000",
  blue: "#0000ff", yellow: "#ffff00", orange: "#ffa500", purple: "#800080",
  gray: "#808080", grey: "#808080", silver: "#c0c0c0", maroon: "#800000",
  olive: "#808000", lime: "#00ff00", aqua: "#00ffff", cyan: "#00ffff",
  teal: "#008080", navy: "#000080", fuchsia: "#ff00ff", magenta: "#ff00ff",
  indigo: "#4b0082", violet: "#ee82ee", gold: "#ffd700", pink: "#ffc0cb",
  brown: "#a52a2a", beige: "#f5f5dc", tan: "#d2b48c", crimson: "#dc143c",
  slategray: "#708090", slategrey: "#708090", darkgray: "#a9a9a9", darkgrey: "#a9a9a9",
  lightgray: "#d3d3d3", lightgrey: "#d3d3d3", whitesmoke: "#f5f5f5", gainsboro: "#dcdcdc",
};

// Keywords that are NOT a literal color value — used by the tokenize rule to know that
// `color: inherit` is fine but `color: #fff` is a hard-coded literal.
export const COLOR_KEYWORDS = new Set([
  "inherit", "initial", "unset", "revert", "currentcolor", "transparent", "none",
]);

function clamp(n, lo, hi) {
  return n < lo ? lo : n > hi ? hi : n;
}

function hexToRgb(hex) {
  let h = hex.slice(1);
  if (h.length === 3 || h.length === 4) {
    h = h.split("").map((c) => c + c).join("");
  }
  if (h.length !== 6 && h.length !== 8) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  if ([r, g, b].some(Number.isNaN)) return null;
  return { r, g, b, a };
}

function parseChannel(tok) {
  tok = tok.trim();
  if (tok.endsWith("%")) return clamp(Math.round((parseFloat(tok) / 100) * 255), 0, 255);
  return clamp(Math.round(parseFloat(tok)), 0, 255);
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 100) / 100;
  l = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/** Parse a single CSS color token to {r,g,b,a}, or null if it isn't a resolvable color. */
export function parseColor(input) {
  if (!input) return null;
  const v = String(input).trim().toLowerCase();
  if (COLOR_KEYWORDS.has(v)) return v === "transparent" ? { r: 0, g: 0, b: 0, a: 0 } : null;
  if (v.startsWith("#")) return hexToRgb(v);
  if (NAMED[v]) return hexToRgb(NAMED[v]);

  const fn = v.match(/^(rgba?|hsla?)\(([^)]*)\)$/);
  if (fn) {
    const kind = fn[1];
    // Support both comma and space (with optional `/ alpha`) syntaxes.
    const body = fn[2].replace(/\//g, " ").replace(/,/g, " ").trim();
    const parts = body.split(/\s+/).filter(Boolean);
    if (kind.startsWith("rgb")) {
      if (parts.length < 3) return null;
      const r = parseChannel(parts[0]);
      const g = parseChannel(parts[1]);
      const b = parseChannel(parts[2]);
      const a = parts[3] != null ? clamp(parseFloat(parts[3]), 0, 1) : 1;
      if ([r, g, b].some(Number.isNaN)) return null;
      return { r, g, b, a: Number.isNaN(a) ? 1 : a };
    }
    // hsl
    if (parts.length < 3) return null;
    const h = parseFloat(parts[0]);
    const s = parseFloat(parts[1]);
    const l = parseFloat(parts[2]);
    const a = parts[3] != null ? clamp(parseFloat(parts[3]), 0, 1) : 1;
    if ([h, s, l].some(Number.isNaN)) return null;
    return { ...hslToRgb(h, s, l), a: Number.isNaN(a) ? 1 : a };
  }
  return null;
}

/** Composite a (possibly translucent) foreground over an opaque background. */
export function flatten(fg, bg) {
  if (fg.a >= 1) return fg;
  const a = fg.a;
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
    a: 1,
  };
}

/** WCAG relative luminance of an opaque rgb. */
export function luminance({ r, g, b }) {
  const lin = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** WCAG contrast ratio (1–21). Translucent fg is composited over bg first. */
export function contrast(fg, bg) {
  const f = flatten(fg, bg);
  const l1 = luminance(f);
  const l2 = luminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** rgb → {h:0–360, s:0–100, l:0–100}. */
export function rgbToHsl({ r, g, b }) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

/** A color is "near-neutral" when it carries almost no hue (low saturation or near b/w). */
export function isNeutral(rgb) {
  const { s, l } = rgbToHsl(rgb);
  return s < 12 || l < 6 || l > 96;
}

/** Pull every resolvable color literal out of an arbitrary value string (e.g. a gradient). */
export function extractColors(value) {
  const out = [];
  const re = /#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?)\([^)]*\)|\b[a-zA-Z]+\b/g;
  const m = value.match(re) || [];
  for (const tok of m) {
    const c = parseColor(tok);
    if (c) out.push({ token: tok, rgb: c });
  }
  return out;
}
