// rules/_shared.mjs — helpers shared across rule modules.

import { parseColor, COLOR_KEYWORDS } from "../lib/color.mjs";

/** Every declaration across every rule, with its owning rule attached. */
export function* eachDecl(surface) {
  if (!surface.css) return;
  for (const rule of surface.css.rules) {
    for (const decl of rule.decls) yield { decl, rule };
  }
}

/** All px lengths appearing in a value (e.g. "1px 8px" → [1, 8]). */
export function pxLengths(value) {
  const out = [];
  const re = /(-?\d*\.?\d+)px\b/g;
  let m;
  while ((m = re.exec(value))) out.push(parseFloat(m[1]));
  return out;
}

/** A single px value, or 0 for a bare `0`, or null if not a simple px/zero length. */
export function singlePx(value) {
  const v = value.trim();
  if (v === "0") return 0;
  const m = v.match(/^(-?\d*\.?\d+)px$/);
  return m ? parseFloat(m[1]) : null;
}

const TOKEN_DEF_SCOPE = /(^|[\s,])(:root|html|\*|:host)\b|\[data-theme|\[data-mode|\.theme-/i;
/** Is this rule a token-definition context, where literal color values are expected? */
export function isTokenDefScope(rule) {
  return rule.selectors.some((s) => TOKEN_DEF_SCOPE.test(s));
}

const INTERACTIVE = /(^|[\s,>+~])(button|a|input|select|textarea|summary)\b|\[role=["']?(button|link|tab|menuitem|switch|checkbox)|\.btn\b|\.button\b|\bbtn[-_]/i;
export function isInteractiveSelector(rule) {
  return rule.selectors.some((s) => INTERACTIVE.test(s));
}

const CARD_SELECTOR = /\.card\b|\.card$|[-_]card\b|\bcard[-_]/i;
export function isCardSelector(rule) {
  return rule.selectors.some((s) => CARD_SELECTOR.test(s));
}

/** Value is a literal color (not a var/keyword/currentColor) we should have tokenized. */
export function isLiteralColor(value) {
  const v = value.trim().toLowerCase();
  if (v.startsWith("var(") || v.includes("var(")) return false;
  if (COLOR_KEYWORDS.has(v)) return false;
  return parseColor(v) != null;
}

/** Find a declaration by property within a rule (last wins, like the cascade). */
export function declOf(rule, propRe) {
  let found = null;
  for (const d of rule.decls) if (propRe.test(d.prop)) found = d;
  return found;
}

/** Quick membership test for "is this surface in this register?" */
export function registerApplies(rule, surface) {
  if (rule.register === "any") return true;
  return surface.register === rule.register;
}
