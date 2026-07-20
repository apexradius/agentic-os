// rules/index.mjs — the rule registry. The gate runs exactly what this array contains;
// the selftest asserts every rule here has a RED + GREEN fixture, so coverage can't rot.

import a11y from './a11y.mjs';
import color from './color.mjs';
import content from './content.mjs';
import layout from './layout.mjs';
import motion from './motion.mjs';
import type from './type.mjs';

export const RULES = [...color, ...type, ...motion, ...layout, ...a11y, ...content];

// Fail fast on a duplicate id (a copy-paste hazard when adding rules).
const seen = new Set();
for (const r of RULES) {
  if (seen.has(r.id)) throw new Error(`duplicate rule id: ${r.id}`);
  seen.add(r.id);
}
