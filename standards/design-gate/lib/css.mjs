// lib/css.mjs — a small, honest CSS tokenizer. Not a full CSS spec parser; it extracts
// exactly what the design rules need: style rules (selectors + declarations with line
// numbers), custom-property definitions, @media/@supports context, and @keyframes names.
// It is comment- and string-safe and balances parens so url()/gradient commas don't split
// declarations. SCSS nesting is not resolved (documented boundary) — nested blocks are
// still walked, so flat declarations are seen regardless.

function stripComments(text) {
  // Replace /* */ comments with equal-length whitespace so byte offsets (and thus line
  // numbers) are preserved. Newlines inside comments are kept.
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? text.length : end + 2;
      for (let j = i; j < stop; j++) out += text[j] === "\n" ? "\n" : " ";
      i = stop;
    } else {
      out += text[i];
      i++;
    }
  }
  return out;
}

function lineAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text[i] === "\n") line++;
  return line;
}

// Split a string on a delimiter char, but only at brace/paren depth 0 and outside strings.
function splitTop(str, delim) {
  const parts = [];
  let depthParen = 0, depthBrace = 0, quote = null, buf = "";
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (quote) {
      buf += c;
      if (c === quote && str[i - 1] !== "\\") quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; buf += c; continue; }
    if (c === "(") depthParen++;
    else if (c === ")") depthParen--;
    else if (c === "{") depthBrace++;
    else if (c === "}") depthBrace--;
    if (c === delim && depthParen === 0 && depthBrace === 0) {
      parts.push(buf);
      buf = "";
    } else {
      buf += c;
    }
  }
  if (buf.trim()) parts.push(buf);
  return parts;
}

// Parse a declaration body ("prop: value; prop: value") into [{prop, value, line}].
function parseDeclarations(body, baseOffset, src) {
  const decls = [];
  let i = 0;
  for (const chunk of splitTop(body, ";")) {
    const start = baseOffset + i;
    i += chunk.length + 1; // +1 for the consumed ';'
    const idx = chunk.indexOf(":");
    if (idx === -1) continue;
    const prop = chunk.slice(0, idx).trim().toLowerCase();
    const value = chunk.slice(idx + 1).trim();
    if (!prop || !value) continue;
    // offset of the prop within the original source, for the line number
    const propOffset = start + chunk.indexOf(chunk.trimStart());
    decls.push({ prop, value, line: lineAt(src, propOffset) });
  }
  return decls;
}

// Walk balanced top-level blocks: returns [{prelude, body, preludeOffset, bodyOffset}].
// Walk text into ordered items at brace depth 0: `block` ({selector|at-rule}{body}),
// `statement` (a `;`-terminated top-level run — an @import OR a CSS-in-JS loose decl), and
// `tail` (un-terminated trailing text). Emitting statements (instead of silently dropping
// them) is what lets the caller recover loose declarations from CSS-in-JS template bodies.
function walkBlocks(text, offset) {
  const items = [];
  let i = 0, quote = null, segStart = 0;
  while (i < text.length) {
    const c = text[i];
    if (quote) {
      if (c === quote && text[i - 1] !== "\\") quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; i++; continue; }
    if (c === "{") {
      // find the matching close, skipping nested braces and strings
      let j = i + 1, d = 1, q2 = null;
      while (j < text.length && d > 0) {
        const cj = text[j];
        if (q2) { if (cj === q2 && text[j - 1] !== "\\") q2 = null; }
        else if (cj === '"' || cj === "'") q2 = cj;
        else if (cj === "{") d++;
        else if (cj === "}") d--;
        j++;
      }
      items.push({
        type: "block",
        prelude: text.slice(segStart, i).trim(),
        body: text.slice(i + 1, j - 1),
        preludeOffset: offset + segStart,
        bodyOffset: offset + i + 1,
      });
      i = j;
      segStart = j;
      continue;
    }
    if (c === ";") {
      const seg = text.slice(segStart, i);
      if (seg.trim()) items.push({ type: "statement", text: seg, textOffset: offset + segStart });
      segStart = i + 1;
    }
    i++;
  }
  const tail = text.slice(segStart);
  if (tail.trim()) items.push({ type: "tail", text: tail, textOffset: offset + segStart });
  return items;
}

const NESTING_ATRULES = /^@(media|supports|container|layer|scope)\b/i;

/**
 * Parse CSS text into a flat model the rules consume.
 * @returns {{
 *   rules: Array<{selectors:string[], decls:Array<{prop,value,line}>, line:number, media:string|null}>,
 *   customProps: Map<string,string>,
 *   keyframes: string[],
 *   hasReducedMotionQuery: boolean,
 *   focusVisibleSelectors: string[]
 * }}
 */
export function parseCss(rawText) {
  const src = stripComments(rawText || "");
  const model = {
    rules: [],
    customProps: new Map(),
    keyframes: [],
    hasReducedMotionQuery: false,
    focusVisibleSelectors: [],
  };

  const recordRule = (selectors, decls, line, media) => {
    for (const d of decls) if (d.prop.startsWith("--")) model.customProps.set(d.prop, d.value);
    if (selectors.some((s) => /:focus-visible/.test(s))) model.focusVisibleSelectors.push(...selectors);
    if (selectors.length && decls.length) model.rules.push({ selectors, decls, line, media });
  };

  // Declarations sitting at brace depth 0 — a CSS-in-JS template body, or runs between
  // and after nested blocks — attach to a synthetic `&` rule so color/motion/token rules
  // still see them. Pure whitespace (no `:`) is ignored, so normal CSS gains no phantom rules.
  const looseFrom = (text, baseOffset, media) => {
    if (!text || !text.includes(":")) return;
    const decls = parseDeclarations(text, baseOffset, src).filter((d) => !d.prop.includes("{") && !d.prop.includes("}"));
    if (decls.length) recordRule(["&"], decls, lineAt(src, baseOffset), media);
  };

  const visit = (text, offset, media) => {
    for (const item of walkBlocks(text, offset)) {
      if (item.type !== "block") {
        // a top-level `;`-terminated run or trailing text. An @-statement (@import,
        // @charset) is ignored; anything else with a `:` is a CSS-in-JS loose declaration.
        if (!item.text.trim().startsWith("@")) looseFrom(item.text, item.textOffset, media);
        continue;
      }
      const prelude = item.prelude;
      if (prelude.startsWith("@")) {
        if (NESTING_ATRULES.test(prelude)) {
          if (/prefers-reduced-motion\s*:\s*reduce/i.test(prelude)) model.hasReducedMotionQuery = true;
          visit(item.body, item.bodyOffset, prelude);
          continue;
        }
        if (/^@keyframes\b/i.test(prelude)) {
          model.keyframes.push(prelude.replace(/^@keyframes\s+/i, "").trim());
          visit(item.body, item.bodyOffset, media); // steps may animate non-transform props
          continue;
        }
        // @font-face / @page: treat as a decl block (falls through)
      }
      const selectors = splitTop(prelude, ",").map((s) => s.trim()).filter(Boolean);
      recordRule(selectors, parseDeclarations(item.body, item.bodyOffset, src), lineAt(src, item.preludeOffset), media);
    }
  };

  visit(src, 0, null);
  return model;
}

/** Parse an inline `prop: value; prop: value` string (style="" / style={{}}) into decls. */
export function parseInlineDeclarations(text, line = 0) {
  const decls = [];
  for (const chunk of splitTop(String(text || ""), ";")) {
    const idx = chunk.indexOf(":");
    if (idx === -1) continue;
    const prop = chunk.slice(0, idx).trim().toLowerCase();
    const value = chunk.slice(idx + 1).trim();
    if (prop && value) decls.push({ prop, value, line });
  }
  return decls;
}

/** Resolve a value that may be `var(--token)` against collected custom props (one hop). */
export function resolveVar(value, customProps) {
  const m = String(value).trim().match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)$/);
  if (!m) return value;
  if (customProps.has(m[1])) return customProps.get(m[1]).trim();
  return m[2] != null ? m[2].trim() : value; // fall back to the var()'s default
}
