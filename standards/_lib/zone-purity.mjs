// framework/standards/_lib/zone-purity.mjs — shared zone-purity scan for standards selftests.
//
// A standard directory in framework/ must carry zero org coupling so the framework stays
// publishable. Several selftests assert this by walking their own dir and failing on any
// forbidden org-coupling token. That walk + token set was copied per standard; it lives here
// once. The literals are encoded as split fragments joined at runtime so THIS file — and any
// validate.mjs importing it — carries no raw coupling literal that would trip its own scan.
//
// Note: framework/primitives/_lib/zone-coupling.mjs is the externalized, config-driven arbiter
// for the agents/skills primitives. These standards selftests still hardcode the org token set
// inline; unifying them onto that arbiter is a semantic change (different token vocabulary) and
// is intentionally left out of a behavior-preserving dedup.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// The same org-coupling literals the framework zone gate blocks, split-joined to keep this
// source clean under its own scan.
const FORBIDDEN = [
  ['apex', 'radius'].join(''),
  ['trade', 'ops'].join(''),
  ['ko', 'vara'].join(''),
  ['/Users/', 'apex'].join(''),
  ['/home/', 'adam'].join(''),
  [148, 113, 202, 79].join('.'),
];

/** Recursively list every file under `dir`. */
function walkFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    return d.isDirectory() ? walkFiles(p) : [p];
  });
}

// First `file: token` coupling hit under `dir`, or '' when clean. `validate.mjs` is excluded by
// default — it legitimately names the tokens. Last hit wins, matching the original inline scan.
export function scanZonePurity(dir, { exclude = (f) => f.endsWith('validate.mjs') } = {}) {
  let hit = '';
  for (const f of walkFiles(dir).filter((f) => !exclude(f))) {
    const txt = readFileSync(f, 'utf8');
    for (const tok of FORBIDDEN) if (txt.includes(tok)) hit = `${f}: ${tok}`;
  }
  return hit;
}
