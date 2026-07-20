// lib/text.mjs — tiny text helpers shared by the design-gate parsers (css.mjs, html.mjs).

/** 1-based line number of a byte offset within `text`. */
export function lineAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text[i] === '\n') line++;
  return line;
}
