// lib/surface.mjs — turn one file into the unified model the rules read.
//
// A Surface normalizes the three sources of style (a .css file, <style> blocks, and
// CSS-in-JS) into one css model, collects inline styles as synthetic rules so the same
// color/motion/token rules catch them, and exposes the DOM tree for structural rules.

import { parseCss, parseInlineDeclarations } from './css.mjs';
import { parseHtml } from './html.mjs';

function typeForPath(file) {
  const ext = (file.match(/\.([a-z]+)$/i) || [, ''])[1].toLowerCase();
  if (ext === 'css' || ext === 'scss' || ext === 'less' || ext === 'sass') return 'css';
  if (ext === 'html' || ext === 'htm' || ext === 'vue' || ext === 'svelte') return 'html';
  if (ext === 'jsx' || ext === 'tsx' || ext === 'js' || ext === 'ts' || ext === 'mjs') return 'jsx';
  return 'unknown';
}

// Merge any number of parsed-css models into one (rules + custom props + flags).
function mergeCss(models) {
  const merged = {
    rules: [],
    customProps: new Map(),
    keyframes: [],
    hasReducedMotionQuery: false,
    focusVisibleSelectors: [],
  };
  for (const m of models) {
    merged.rules.push(...m.rules);
    for (const [k, v] of m.customProps) merged.customProps.set(k, v);
    merged.keyframes.push(...m.keyframes);
    merged.hasReducedMotionQuery ||= m.hasReducedMotionQuery;
    merged.focusVisibleSelectors.push(...m.focusVisibleSelectors);
  }
  return merged;
}

// JSX/inline `style={{ marginTop: 8, color: 'red' }}` → declaration objects.
function extractJsxStyleObjects(text) {
  const out = [];
  const re = /style\s*=\s*\{\{([^}]*)\}\}/g;
  let m;
  while ((m = re.exec(text))) {
    const line = (text.slice(0, m.index).match(/\n/g) || []).length + 1;
    const decls = [];
    for (const pair of m[1].split(',')) {
      const km = pair.match(/['"]?([A-Za-z-]+)['"]?\s*:\s*(.+)/);
      if (!km) continue;
      const prop = km[1].replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
      let value = km[2].trim().replace(/^['"]|['"]$/g, '');
      if (
        /^\d+$/.test(value) &&
        prop !== 'z-index' &&
        prop !== 'opacity' &&
        prop !== 'flex' &&
        prop !== 'line-height'
      ) {
        value += 'px'; // React turns a bare number into px
      }
      if (prop && value) decls.push({ prop: prop.toLowerCase(), value, line });
    }
    if (decls.length)
      out.push({ selectors: ['[jsx-inline]'], decls, line, media: null, inline: true });
  }
  return out;
}

export function buildSurface(file, content, { register = null } = {}) {
  const type = typeForPath(file);
  const surface = { file, type, register, css: null, dom: null };

  if (type === 'css') {
    surface.css = parseCss(content);
    return surface;
  }

  const jsx = type === 'jsx';
  const { root, styleBlocks, cssInJs, inlineStyles } = parseHtml(content, { jsx });
  surface.dom = root;

  const models = [
    ...styleBlocks.map((b) => parseCss(b.css)),
    ...cssInJs.map((b) => parseCss(b.css)),
  ];
  const css = mergeCss(models);

  // inline style="" attributes → synthetic single-selector rules
  for (const s of inlineStyles) {
    css.rules.push({
      selectors: ['[inline-style]'],
      decls: parseInlineDeclarations(s.decls, s.line),
      line: s.line,
      media: null,
      inline: true,
    });
  }
  if (jsx) css.rules.push(...extractJsxStyleObjects(content));

  surface.css = css;
  return surface;
}
