// rules/content.mjs — copy rules from design.md's "Copy" section.

import { walk } from '../lib/html.mjs';
import { eachDecl } from './_shared.mjs';

const LOREM = /lorem\s+ipsum/i;

export default [
  {
    id: 'lorem-ipsum',
    title: 'Placeholder Lorem Ipsum copy on a shipped surface',
    severity: 'note',
    register: 'any',
    ref: 'design.md:59',
    check(surface) {
      const findings = [];
      if (surface.dom) {
        walk(surface.dom, (node) => {
          if (node.text && LOREM.test(node.text)) {
            findings.push({
              line: node.line,
              evidence: `<${node.tag}> contains Lorem Ipsum — use real, domain-true copy`,
            });
          }
        });
      }
      for (const { decl, rule } of eachDecl(surface)) {
        if (decl.prop === 'content' && LOREM.test(decl.value)) {
          findings.push({
            line: decl.line,
            evidence: `${rule.selectors[0]} { content: ${decl.value} } — Lorem Ipsum placeholder`,
          });
        }
      }
      return findings;
    },
  },
];
