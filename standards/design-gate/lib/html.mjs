// lib/html.mjs — a lightweight markup scanner for HTML and (tolerantly) JSX/TSX.
//
// It is NOT a spec-compliant parser. It builds a node tree with tags, attributes, text,
// and line numbers — enough for structural rules (card-in-card nesting, icon-only buttons).
// JSX boundary, stated plainly: className is read as class; `style={{...}}` objects and
// styled-components / `css` template literals are extracted as CSS; arbitrary JS
// expressions are ignored. HTML and CSS are the first-class targets — full JSX-AST
// semantics are deferred to the design-critic role.

import { lineAt } from './text.mjs';

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

function parseAttrs(attrText) {
  const attrs = {};
  const re = /([:@]?[\w-]+)\s*=\s*("[^"]*"|'[^']*'|\{[^}]*\}|\S+)|([:@]?[\w-]+)(?=\s|$)/g;
  let m;
  while ((m = re.exec(attrText))) {
    if (m[3]) {
      attrs[m[3].toLowerCase()] = ''; // boolean attribute
      continue;
    }
    let name = m[1].toLowerCase();
    let val = m[2];
    if (val[0] === '"' || val[0] === "'") val = val.slice(1, -1);
    // JSX className → class; keep brace-expression values raw (rules treat them as opaque)
    if (name === 'classname') name = 'class';
    attrs[name] = val;
  }
  return attrs;
}

/**
 * Scan markup into a tree.
 * @returns {{ root:Node, styleBlocks:Array<{css:string,line:number}>,
 *             cssInJs:Array<{css:string,line:number}>, inlineStyles:Array<{decls:string,line:number,node:Node}> }}
 * Node = { tag, attrs, classes:string[], children:Node[], parent, line, text }
 */
export function parseHtml(rawText, { jsx = false } = {}) {
  const text = rawText || '';
  const root = {
    tag: '#root',
    attrs: {},
    classes: [],
    children: [],
    parent: null,
    line: 0,
    text: '',
  };
  const stack = [root];
  const styleBlocks = [];
  const cssInJs = [];
  const inlineStyles = [];

  // Extract CSS-in-JS from JSX/TSX: styled.x`...`, styled(X)`...`, css`...`, createGlobalStyle`...`
  if (jsx) {
    const tpl = /(?:styled(?:\.\w+|\([^)]*\))|css|createGlobalStyle)\s*`([\s\S]*?)`/g;
    let tm;
    while ((tm = tpl.exec(text))) {
      cssInJs.push({ css: tm[1], line: lineAt(text, tm.index) });
    }
  }

  const tagRe =
    /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w.-]*)((?:[^>"'{]|"[^"]*"|'[^']*'|\{[^}]*\})*?)(\/?)>/g;
  let last = 0,
    m;
  while ((m = tagRe.exec(text))) {
    // text node between tags
    const between = text.slice(last, m.index).trim();
    if (between && stack.length) {
      const top = stack[stack.length - 1];
      top.text += (top.text ? ' ' : '') + between.replace(/\{[^}]*\}/g, '').trim();
    }
    last = m.index + m[0].length;

    if (m[0].startsWith('<!--')) continue;
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrText = m[3] || '';
    const selfClose = m[4] === '/' || VOID_TAGS.has(tag);

    if (closing) {
      // pop to matching tag
      for (let k = stack.length - 1; k >= 1; k--) {
        if (stack[k].tag === tag) {
          stack.length = k;
          break;
        }
      }
      continue;
    }

    const attrs = parseAttrs(attrText);
    const classAttr = attrs.class && !attrs.class.startsWith('{') ? attrs.class : '';
    const node = {
      tag,
      attrs,
      classes: classAttr.split(/\s+/).filter(Boolean),
      children: [],
      parent: stack[stack.length - 1],
      line: lineAt(text, m.index),
      text: '',
    };
    stack[stack.length - 1].children.push(node);

    if (attrs.style && !attrs.style.startsWith('{')) {
      inlineStyles.push({ decls: attrs.style, line: node.line, node });
    }

    if (tag === 'style') {
      // capture raw CSS until </style>
      const close = text.indexOf('</style>', last);
      const css = close === -1 ? '' : text.slice(last, close);
      styleBlocks.push({ css, line: node.line });
      if (close !== -1) {
        tagRe.lastIndex = close;
        last = close;
      }
      continue;
    }
    if (!selfClose) stack.push(node);
  }

  return { root, styleBlocks, cssInJs, inlineStyles };
}

/** Depth-first walk of the node tree (excludes the synthetic #root). */
export function walk(node, fn, depth = 0) {
  for (const child of node.children) {
    fn(child, depth);
    walk(child, fn, depth + 1);
  }
}

/** A class token names a "card" if it is `card`, ends with -card/_card, or is PascalCase *Card. */
function isCardClass(cls) {
  return /^card$/i.test(cls) || /[-_]card$/i.test(cls) || /^[A-Z][\w]*Card$/.test(cls);
}

/** Is a node a card (any of its classes reads as a card)? */
export function isCard(node) {
  return node.classes.some(isCardClass);
}
