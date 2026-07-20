#!/usr/bin/env node
// validate.mjs — faithfulness-trace standard. It checks the closeout trace
// artifact shape: every done claim must carry evidence with a pointer and observed
// result. It does not judge whether the evidence is sufficient.

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasPersistedRef, hasText, isObject } from '../_lib/shape.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const checks = [];
const ok = (name, cond, detail = '') => {
  checks.push({ name, pass: !!cond, detail });
  return !!cond;
};
const TYPES = new Set(['tool', 'command', 'artifact', 'observed-output']);
const CLAIM_KINDS = new Set([
  'validation-passed',
  'deployed',
  'pushed',
  'committed',
  'artifact-created',
  'runtime-observed',
  'not-verified',
]);
const CLAIM_KIND_HINTS = [
  [
    'validation-passed',
    /\b(validate|validator|validation|test|tests|checks?)\b.*\b(pass|passed|green|valid)\b/i,
  ],
  ['deployed', /\b(deploy|deployed|released|installed)\b/i],
  ['pushed', /\b(push|pushed)\b/i],
  ['committed', /\b(commit|committed)\b/i],
  ['artifact-created', /\b(artifact|file|report|trace)\b.*\b(created|written|emitted)\b/i],
  ['runtime-observed', /\b(observed|verified live|runtime|endpoint|service)\b/i],
];

function hasTimestamp(value) {
  return hasText(value) && Number.isFinite(Date.parse(value));
}

function hintedClaimKind(claim) {
  for (const [kind, re] of CLAIM_KIND_HINTS) if (re.test(claim)) return kind;
  return '';
}

function evidencePointer(evidence) {
  return (
    hasPersistedRef(evidence.ref) ||
    (hasText(evidence.command) && hasExitCode(evidence)) ||
    hasText(evidence.tool)
  );
}

function hasExitCode(evidence) {
  return Number.isInteger(evidence.exit_code) || Number.isInteger(evidence.exitCode);
}

function hasZeroExit(evidence) {
  return evidence.exit_code === 0 || evidence.exitCode === 0;
}

// F40: a probe is an executed artifact, not a citation — a `source.js:NN` line reference
// into code under analysis is the argument restated with a line number, not probe output.
function isSourceCitation(value) {
  return (
    hasText(value) &&
    /\.(m?[jt]sx?|py|rb|go|rs|java|c|h|cpp|php|sh|bash|zsh)(:\d+(-\d+)?)?$/.test(value.trim())
  );
}

function hasProbeRef(value) {
  return hasPersistedRef(value) && !isSourceCitation(value);
}

function hasProbeEvidence(defect) {
  return (
    hasProbeRef(defect.probe) ||
    hasProbeRef(defect.probe_path) ||
    (isObject(defect.evidence) && hasProbeRef(defect.evidence.ref))
  );
}

function defectLists(trace) {
  const lists = [];
  if (Array.isArray(trace.found_defects)) lists.push(['found_defects', trace.found_defects]);
  if (Array.isArray(trace.defects)) lists.push(['defects', trace.defects]);
  return lists;
}

function validateDefectDismissals(trace) {
  const errors = [];
  for (const [key, defects] of defectLists(trace)) {
    defects.forEach((defect, index) => {
      const where = `${key}[${index}]`;
      if (!isObject(defect)) return;
      const disposition = [defect.outcome, defect.disposition, defect.state].find((v) =>
        hasText(v),
      );
      if (
        hasText(disposition) &&
        disposition.trim().toLowerCase() === 'ruled-non-defect' &&
        !hasProbeEvidence(defect)
      ) {
        const cited = [
          defect.probe,
          defect.probe_path,
          isObject(defect.evidence) ? defect.evidence.ref : defect.evidence,
        ].some(
          (v) =>
            hasText(v) &&
            (isSourceCitation(v) ||
              /\.(m?[jt]sx?|py|rb|go|rs|java|c|h|cpp|php|sh|bash|zsh):\d+/.test(v)),
        );
        errors.push(
          cited
            ? `${where}: probe ref is a source citation, not an executed artifact (F40: a probe is run output, not a line number into the code under analysis)`
            : `${where}: ruled-non-defect dismissal requires persisted probe evidence (F35: dismissal carries the same evidence grade as fixed)`,
        );
      }
    });
  }
  return errors;
}

function validateKindEvidence(kind, evidence, where) {
  const errors = [];
  if (kind === 'validation-passed') {
    if (evidence.type !== 'command')
      errors.push(`${where}.evidence.type must be command for validation-passed`);
    if (!hasText(evidence.command) && !hasText(evidence.ref))
      errors.push(`${where}.evidence.command or ref is required for validation-passed`);
    if (!hasZeroExit(evidence))
      errors.push(`${where}.evidence.exit_code must be 0 for validation-passed`);
  } else if (kind === 'deployed') {
    if (!['command', 'tool', 'observed-output'].includes(evidence.type)) {
      errors.push(`${where}.evidence.type must be command, tool, or observed-output for deployed`);
    }
    if (
      !hasText(evidence.service) &&
      !hasText(evidence.endpoint) &&
      !hasText(evidence.runtime_ref)
    ) {
      errors.push(`${where}.evidence requires service, endpoint, or runtime_ref for deployed`);
    }
  } else if (kind === 'pushed') {
    if (!hasText(evidence.git_ref)) errors.push(`${where}.evidence.git_ref is required for pushed`);
    if (!hasText(evidence.remote)) errors.push(`${where}.evidence.remote is required for pushed`);
  } else if (kind === 'committed') {
    if (!hasText(evidence.git_ref))
      errors.push(`${where}.evidence.git_ref is required for committed`);
  } else if (kind === 'artifact-created') {
    if (!hasText(evidence.artifact_path) && !hasText(evidence.ref)) {
      errors.push(`${where}.evidence.artifact_path or ref is required for artifact-created`);
    }
  } else if (kind === 'runtime-observed') {
    if (!['tool', 'command', 'observed-output'].includes(evidence.type)) {
      errors.push(
        `${where}.evidence.type must be tool, command, or observed-output for runtime-observed`,
      );
    }
  } else if (kind === 'not-verified') {
    if (!hasText(evidence.missing_evidence) && !hasText(evidence.blocked_reason)) {
      errors.push(
        `${where}.evidence.missing_evidence or blocked_reason is required for not-verified`,
      );
    }
  }
  return errors;
}

export function validateTrace(trace) {
  const errors = [];
  if (!isObject(trace)) return ['trace is not an object'];
  errors.push(...validateDefectDismissals(trace));
  if (!Array.isArray(trace.claims) || trace.claims.length === 0) {
    errors.push('claims must be a non-empty array');
    return errors;
  }

  trace.claims.forEach((entry, index) => {
    const where = `claims[${index}]`;
    if (!isObject(entry)) {
      errors.push(`${where} is not an object`);
      return;
    }
    if (!hasText(entry.claim)) errors.push(`${where}.claim is required`);
    const kind = entry.claim_kind;
    if (kind !== undefined && !CLAIM_KINDS.has(kind)) errors.push(`${where}.claim_kind is invalid`);
    if (kind === undefined) {
      const hinted = hintedClaimKind(entry.claim || '');
      if (hinted) errors.push(`${where}.claim_kind is required for ${hinted} claims`);
    }
    const evidence = entry.evidence;
    if (!isObject(evidence)) {
      errors.push(`${where}.evidence is required`);
      return;
    }
    if (!TYPES.has(evidence.type)) errors.push(`${where}.evidence.type is invalid`);
    if (['artifact', 'observed-output'].includes(evidence.type) && !hasPersistedRef(evidence.ref)) {
      errors.push(
        `${where}.evidence.ref must be a path-shaped persisted artifact pointer for ${evidence.type} evidence (F34 persisted proofs)`,
      );
    }
    if (!evidencePointer(evidence)) {
      errors.push(
        `${where}.evidence requires persisted ref, command+exit_code, or tool (F34 persisted proofs)`,
      );
    }
    if (!hasText(evidence.observed)) errors.push(`${where}.evidence.observed is required`);
    if (!hasTimestamp(evidence.timestamp)) errors.push(`${where}.evidence.timestamp is invalid`);
    if (CLAIM_KINDS.has(kind)) errors.push(...validateKindEvidence(kind, evidence, where));
  });
  return errors;
}

const valid = {
  claims: [
    {
      claim: 'Validator passes',
      claim_kind: 'validation-passed',
      evidence: {
        type: 'command',
        command: 'node framework/primitives/_lib/validate.mjs --all',
        exit_code: 0,
        observed: 'Exited 0 and printed ALL VALID',
        timestamp: '2026-06-25T18:00:00Z',
      },
    },
  ],
};
const legacyReadable = {
  claims: [
    {
      claim: 'Reviewed the artifact',
      evidence: {
        type: 'artifact',
        ref: 'reports/review.md',
        observed: 'Report exists and is non-empty',
        timestamp: '2026-06-25T18:00:00Z',
      },
    },
  ],
};
const missingEvidence = { claims: [{ claim: 'Done' }] };
const genericDeploy = {
  claims: [
    {
      claim: 'Deployed the service',
      claim_kind: 'deployed',
      evidence: {
        type: 'observed-output',
        ref: 'closeout note',
        observed: 'Looks done',
        timestamp: '2026-06-25T18:00:00Z',
      },
    },
  ],
};
const pushed = {
  claims: [
    {
      claim: 'Pushed main',
      claim_kind: 'pushed',
      evidence: {
        type: 'command',
        command: 'git push',
        exit_code: 0,
        git_ref: 'abc1234',
        remote: 'origin/main',
        observed: 'origin/main updated to abc1234',
        timestamp: '2026-06-25T18:00:00Z',
      },
    },
  ],
};
const badType = {
  claims: [
    {
      claim: 'Done',
      evidence: {
        type: 'guess',
        ref: 'somewhere',
        observed: 'Looked fine',
        timestamp: '2026-06-25T18:00:00Z',
      },
    },
  ],
};
const persistedArtifactRef = {
  claims: [
    {
      claim: 'Created the trace artifact',
      claim_kind: 'artifact-created',
      evidence: {
        type: 'artifact',
        ref: 'reports/trace.md',
        observed: 'Trace artifact is referenced by path',
        timestamp: '2026-06-25T18:00:00Z',
      },
    },
  ],
};
const proseOnlyObservedOutput = {
  claims: [
    {
      claim: 'Observed the runtime output',
      claim_kind: 'runtime-observed',
      evidence: {
        type: 'observed-output',
        observed: 'It looked fine in the terminal',
        timestamp: '2026-06-25T18:00:00Z',
      },
    },
  ],
};
const ruledNonDefectWithProbe = {
  claims: valid.claims,
  found_defects: [
    {
      summary: 'The entry TTL exceeds the session TTL.',
      outcome: 'ruled-non-defect',
      reason: 'Probe demonstrates the branch is safe.',
      probe_path: 'orchestration/verify/probe.md',
    },
  ],
};
const argumentOnlyDismissal = {
  claims: valid.claims,
  found_defects: [
    {
      summary: 'The entry TTL exceeds the session TTL.',
      outcome: 'ruled-non-defect',
      reason: 'Both knobs are declared config and the branch is reachable.',
    },
  ],
};
const sourceCitationDismissal = {
  claims: valid.claims,
  found_defects: [
    {
      summary: 'touch() read-modify-write races under concurrency.',
      outcome: 'ruled-non-defect',
      reason: 'The redis stand-in is stateless by design, so the race cannot manifest.',
      probe_path: 'fixture/lib/clients.js:11',
    },
  ],
};
const probeScriptNotOutput = {
  claims: valid.claims,
  found_defects: [
    {
      summary: 'touch() read-modify-write races under concurrency.',
      outcome: 'ruled-non-defect',
      reason: 'Live-fire script covers it.',
      probe: 'orchestration/verify/live-fire.mjs',
    },
  ],
};

ok('validateTrace: evidence-backed claim passes', validateTrace(valid).length === 0);
ok(
  'validateTrace: legacy claim/evidence shape remains readable',
  validateTrace(legacyReadable).length === 0,
);
ok(
  'validateTrace: claim without evidence fails',
  validateTrace(missingEvidence).some((e) => /evidence/.test(e)),
);
ok(
  'validateTrace: deployed claim with generic evidence fails',
  validateTrace(genericDeploy).some((e) => /service|endpoint|runtime_ref/.test(e)),
);
ok('validateTrace: pushed claim with git evidence passes', validateTrace(pushed).length === 0);
ok(
  'validateTrace: invalid evidence type fails',
  validateTrace(badType).some((e) => /type/.test(e)),
);
ok(
  'validateTrace: F34 persisted artifact ref passes',
  validateTrace(persistedArtifactRef).length === 0,
);
ok(
  'validateTrace: F34 prose-only observed output fails',
  validateTrace(proseOnlyObservedOutput).some((e) => /F34 persisted proofs/.test(e)),
);
ok(
  'validateTrace: F35 ruled-non-defect with probe passes',
  validateTrace(ruledNonDefectWithProbe).length === 0,
);
ok(
  'validateTrace: F35 argument-only dismissal fails',
  validateTrace(argumentOnlyDismissal).some((e) =>
    /F35: dismissal carries the same evidence grade as fixed/.test(e),
  ),
);
ok(
  'validateTrace: F40 source-citation probe fails',
  validateTrace(sourceCitationDismissal).some((e) => /F40: a probe is run output/.test(e)),
);
ok(
  'validateTrace: F40 probe script (not its output) fails',
  validateTrace(probeScriptNotOutput).some((e) => /F40: a probe is run output/.test(e)),
);
ok('file present: validate.mjs', existsSync(join(__dirname, 'validate.mjs')));
ok('file present: README.md', existsSync(join(__dirname, 'README.md')));

const failed = checks.filter((c) => !c.pass);
for (const c of checks)
  if (!c.pass) console.log(`  FAIL ${c.name}${c.detail ? `  [${c.detail}]` : ''}`);
console.log(
  `faithfulness-trace: ${checks.length - failed.length}/${checks.length} selftest checks passed`,
);
process.exit(failed.length ? 1 : 0);
