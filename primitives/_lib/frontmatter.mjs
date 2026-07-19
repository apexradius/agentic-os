// frontmatter.mjs — parse YAML frontmatter without tripping on `---` inside the body.
//
// Why this is its own module: every agent body contains markdown rules (`---`) and
// dense XML. A naive `text.split('---')` mis-parses all of them. The only correct
// reading is: frontmatter is the block between the `---` on line 1 and the NEXT line
// that is exactly `---`. Everything after that closing fence is body — even if it
// contains a hundred more `---` lines.

import { parse as parseYaml } from 'yaml';

const FENCE = /^---[ \t]*$/;

/**
 * Split a document into { data, body, hasFrontmatter }.
 * - data: parsed YAML frontmatter (object; {} when absent or empty)
 * - body: everything after the closing fence, verbatim (may contain `---` lines)
 * - hasFrontmatter: whether a frontmatter block was present
 *
 * Throws if a block is opened on line 1 but never closed — that is a real authoring
 * error, not something to paper over.
 */
export function parseFrontmatter(raw) {
  const text = stripBom(String(raw));
  const lines = text.split(/\r?\n/);

  if (!FENCE.test(lines[0] ?? '')) {
    return { data: {}, body: text, hasFrontmatter: false };
  }

  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (FENCE.test(lines[i])) {
      close = i;
      break;
    }
  }
  if (close === -1) {
    throw new Error('frontmatter opened with `---` on line 1 but no closing `---` line was found');
  }

  const fmText = lines.slice(1, close).join('\n');
  const body = lines.slice(close + 1).join('\n');
  const data = fmText.trim() === '' ? {} : parseYaml(fmText);

  return { data: data ?? {}, body, hasFrontmatter: true };
}

function stripBom(s) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}
