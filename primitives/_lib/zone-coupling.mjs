// framework/primitives/_lib/zone-coupling.mjs — the zone-coupling ARBITER source, externalized.
//
// The skills/agents validators enforce that a framework/ primitive carries zero ORG coupling. A
// reusable framework can't hardcode one org's coupling vocabulary, so the token list lives in config:
// framework/ ships only a GENERIC default (RFC-5737 doc IPs + `example-*` tokens — proves the guard
// fires, bans nothing real). An adopter declares their org's forbidden tokens in
//   apex/config/zone-coupling.json   (per-profile arrays, e.g. {"skills": ["acme-corp", ...]})
// or the ZONE_COUPLING_PATTERN env var (a raw regex source, applied to all profiles). The adopter's
// real list lives OUTSIDE framework/ — so framework/ stays publishable while the live arbiter is
// unchanged for the adopter. Rationale recorded in the retired ledger engine's SEAM doc,
// archived to a git tag with the rest of that engine (CLEANUP C3).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..', '..', '..');
const CONFIG = join(REPO, 'apex', 'config', 'zone-coupling.json');

// GENERIC defaults — example tokens with zero real-org meaning (198.51.100/203.0.113 are RFC-5737
// documentation ranges). The selftest matches against THESE, so it passes identically whether or not
// an adopter config is present. RUNTIME tokens (specific runtime plugins, not org coupling) are
// generic already and stay inline in the agents validator.
export const GENERIC_COUPLING = {
  agents:
    /example-corp|\bacme\b|198\.51\.100\.|203\.0\.113\.|\/home\/example\b|\bexample-secret\b/i,
  skills:
    /example-corp|\bacme\b|198\.51\.100\.|203\.0\.113\.|\/home\/example\b|\bexample-secret\b|mcp__example-/i,
};

function fromTokens(tokens) {
  return Array.isArray(tokens) && tokens.length ? new RegExp(tokens.join('|'), 'i') : null;
}

// Resolve the active coupling matcher for a profile ("agents" | "skills"): ZONE_COUPLING_PATTERN env
// (raw regex) wins, else apex/config/zone-coupling.json[profile], else the GENERIC default. Adopter
// config makes the guard enforce THEIR coupling without editing framework/.
export function loadCoupling(profile) {
  const env = process.env.ZONE_COUPLING_PATTERN;
  if (env) {
    try {
      return new RegExp(env, 'i');
    } catch {
      /* ignore malformed override */
    }
  }
  if (existsSync(CONFIG)) {
    try {
      const rx = fromTokens(JSON.parse(readFileSync(CONFIG, 'utf8'))[profile]);
      if (rx) return rx;
    } catch {
      /* ignore malformed config — fall back to generic */
    }
  }
  return GENERIC_COUPLING[profile] ?? GENERIC_COUPLING.skills;
}

// First coupling token found across texts, or null. `pattern` overrides the resolved matcher — the
// selftest passes GENERIC_COUPLING.skills so it proves the MECHANISM, not the adopter's config.
export function couplingMatch(texts, pattern) {
  const rx = pattern ?? loadCoupling('skills');
  for (const t of texts) {
    const m = t.match(rx);
    if (m) return m[0];
  }
  return null;
}
