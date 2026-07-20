// framework/standards/_lib/fs-scan.mjs — filesystem walk helpers for standards validators.
// Zero npm deps — plain node:fs recursion, so importing this keeps the standard-shape contract.

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Every path under `dir` whose basename is exactly `name` (recursive). */
export function walkNamed(dir, name, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkNamed(p, name, acc);
    else if (e.name === name) acc.push(p);
  }
  return acc;
}
