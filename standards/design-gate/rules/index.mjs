// rules/index.mjs — the rule registry. The gate runs exactly what this array contains;
// the selftest asserts every rule here has a RED + GREEN fixture, so coverage can't rot.

import color from "./color.mjs";
import type from "./type.mjs";
import motion from "./motion.mjs";
import layout from "./layout.mjs";
import a11y from "./a11y.mjs";

export const RULES = [...color, ...type, ...motion, ...layout, ...a11y];

// Fail fast on a duplicate id (a copy-paste hazard when adding rules).
const seen = new Set();
for (const r of RULES) {
  if (seen.has(r.id)) throw new Error(`duplicate rule id: ${r.id}`);
  seen.add(r.id);
}

export const RULES_BY_ID = new Map(RULES.map((r) => [r.id, r]));
