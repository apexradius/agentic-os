// rules/index.mjs — the tool-gate rule registry. The gate runs exactly what this array
// contains; the selftest asserts every rule here has a RED + GREEN fixture, so coverage
// can't rot.

import destructive from './destructive.mjs';
import exfiltration from './exfiltration.mjs';
import injection from './injection.mjs';
import secrets from './secret-scan.mjs';

export const RULES = [...destructive, ...exfiltration, ...secrets, ...injection];

// Fail fast on a duplicate id (a copy-paste hazard when adding rules).
const seen = new Set();
for (const r of RULES) {
  if (seen.has(r.id)) throw new Error(`duplicate rule id: ${r.id}`);
  seen.add(r.id);
}
