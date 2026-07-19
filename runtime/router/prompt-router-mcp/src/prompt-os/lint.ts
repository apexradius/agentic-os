import { promises as fs } from 'node:fs';
import path from 'node:path';

import { parsePromptLibrary, slugify } from '../lib.js';
import {
  ALLOWED_INCLUDES,
  DOMAINS,
  FrontmatterSchema,
  REQUIRED_ALL,
  REQUIRED_WORKFLOW,
} from './contract.js';
import { parseFrontmatter } from './frontmatter.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LintIssue = {
  code: string;
  message: string;
};

export type LintResult = {
  file: string;
  ok: boolean;
  errors: LintIssue[];
  warnings: LintIssue[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Collect all XML-style section tag names present in the body text.
 * Matches <tag_name>...</tag_name> patterns (non-greedy).
 */
export function collectSections(text: string): Set<string> {
  const found = new Set<string>();
  const re = /<([a-z_]+)>[\s\S]*?<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    found.add(m[1]);
  }
  return found;
}

/**
 * Determine if a record is a WORKFLOW prompt:
 * - domain is 'operations' or 'lifecycle', OR
 * - any includes entry starts with 'loops/'
 */
function isWorkflow(domain: string, includes: string[]): boolean {
  if (domain === 'operations' || domain === 'lifecycle') return true;
  return includes.some((inc) => inc.startsWith('loops/'));
}

// ---------------------------------------------------------------------------
// Core linter
// ---------------------------------------------------------------------------

export function lintRecord(fileText: string, opts: { filePath: string }): LintResult {
  const errors: LintIssue[] = [];
  const warnings: LintIssue[] = [];

  const addError = (code: string, message: string) => errors.push({ code, message });
  const addWarning = (code: string, message: string) => warnings.push({ code, message });

  // --- R1: Parse front-matter ---
  const fmResult = parseFrontmatter(fileText);
  if (fmResult.error !== null || fmResult.data === null) {
    addError('R1', `Front-matter parse error: ${fmResult.error ?? 'unknown'}`);
    // Cannot continue without valid front-matter
    return { file: opts.filePath, ok: false, errors, warnings };
  }

  // Validate against zod schema
  const parseResult = FrontmatterSchema.safeParse(fmResult.data);
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      const fieldPath = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      const msg = issue.message;

      // Surface R8/R9 codes explicitly from superRefine messages
      if (msg.startsWith('R8:')) {
        addError('R8', `${fieldPath}: ${msg}`);
      } else if (msg.startsWith('R9a:')) {
        addError('R9a', `${fieldPath}: ${msg}`);
      } else if (msg.startsWith('R9b:')) {
        addError('R9b', `${fieldPath}: ${msg}`);
      } else if (fieldPath === 'created' || fieldPath === 'updated' || fieldPath === 'deprecated') {
        // Date format issues surfaced as R10
        addError('R10', `${fieldPath}: ${msg}`);
      } else {
        addError('R1', `${fieldPath}: ${msg}`);
      }
    }
    // Even with schema errors, continue with what we have for R2/R3/R11 checks
    // using the raw parsed data
  }

  const fm = fmResult.data;
  const fmId = typeof fm['id'] === 'string' ? fm['id'] : null;
  const fmDomain = typeof fm['domain'] === 'string' ? fm['domain'] : '';
  const fmIncludes = Array.isArray(fm['includes']) ? (fm['includes'] as string[]) : [];
  const fmStatus = typeof fm['status'] === 'string' ? fm['status'] : '';

  // R4/R6 are status-gated: required-section findings are ERRORS only when the
  // record claims it is review-ready or shipped (in_review/published). A `draft`
  // record (e.g. a freshly-migrated legacy prompt) downgrades the SAME R4/R6
  // findings to WARNINGS so it does not break CI before it has been hardened.
  const sectionFindingIsError = fmStatus === 'in_review' || fmStatus === 'published';
  const addSectionFinding = (code: string, message: string) =>
    (sectionFindingIsError ? addError : addWarning)(code, message);

  // --- R11: parsePromptLibrary on the full file text ---
  // The parser ignores front-matter (no ## heading there) and reads from the body.
  // We pass the full fileText so the parser sees the ## heading in the body.
  const parsed = parsePromptLibrary(fileText);
  if (parsed.prompts.length === 0) {
    addError(
      'R11',
      'parsePromptLibrary returned 0 prompts — missing or malformed ## heading or ```text fence',
    );
  }
  if (parsed.warnings.length > 0) {
    for (const w of parsed.warnings) {
      addError('R11', `parsePromptLibrary warning: ${w}`);
    }
  }

  // Use the first prompt's name/slug for R2 (if we got one)
  const promptEntry = parsed.prompts[0] ?? null;

  // --- R2: id must equal slugify(headingName) ---
  if (fmId !== null && promptEntry !== null) {
    const expectedSlug = promptEntry.slug; // already slugified
    if (fmId !== expectedSlug) {
      addError('R2', `id "${fmId}" does not match slugify(heading) "${expectedSlug}"`);
    }
  }

  // --- R3: id must equal basename(filePath).replace(/\.prompt\.md$/, '') ---
  if (fmId !== null) {
    const base = path.basename(opts.filePath).replace(/\.prompt\.md$/, '');
    if (fmId !== base) {
      addError('R3', `id "${fmId}" does not match file basename "${base}"`);
    }
  }

  // --- Section checks (R4, R6, R-INV) use the body text ---
  const bodyText = fmResult.body;
  const sections = collectSections(bodyText);

  // --- R4: Required sections for ALL prompts (status-gated severity) ---
  for (const section of REQUIRED_ALL) {
    if (!sections.has(section)) {
      addSectionFinding('R4', `Missing required section <${section}> in body`);
    }
  }

  // --- R6 + R-INV: Workflow prompts ---
  if (fmDomain && DOMAINS.includes(fmDomain as (typeof DOMAINS)[number])) {
    if (isWorkflow(fmDomain, fmIncludes)) {
      // R6: workflow sections (status-gated severity)
      for (const section of REQUIRED_WORKFLOW) {
        if (!sections.has(section)) {
          addSectionFinding('R6', `Workflow prompt missing required section <${section}>`);
        }
      }

      // R-INV: grounding gate
      const hasInvestigate = bodyText.includes('<investigate_before_answering>');
      const hasIntakeGate = sections.has('intake_gate');
      if (!hasInvestigate && !hasIntakeGate) {
        addWarning(
          'R-INV',
          'Workflow prompt has neither <investigate_before_answering> nor <intake_gate> — grounding gate missing',
        );
      }
    }
  }

  // --- R7: Blanket-negative heuristic (WARN) ---
  // Case-SENSITIVE: flags only ALL-CAPS NEVER/ALWAYS constraint directives (the Apex
  // convention) at line start — never lowercase prose (e.g. '...never by "it looks
  // done"'). A matching line <=6 words with no qualifier is a candidate blanket rule.
  const QUALIFIERS = /\b(when|if|unless|until|before|after|per|that|which|where|without|only)\b/i;
  const bodyLines = bodyText.split('\n');
  for (const line of bodyLines) {
    if (/^\s*-?\s*(NEVER|ALWAYS)\b/.test(line)) {
      const wordCount = line.trim().split(/\s+/).length;
      if (wordCount <= 6 && !QUALIFIERS.test(line)) {
        addWarning(
          'R7',
          `Potential blanket negative (${wordCount} words, no qualifier): ${line.trim()}`,
        );
      }
    }
  }

  // --- R12: Unknown includes (WARN) ---
  for (const inc of fmIncludes) {
    if (!ALLOWED_INCLUDES.has(inc)) {
      addWarning('R12', `includes value "${inc}" is not in ALLOWED_INCLUDES`);
    }
  }

  return {
    file: opts.filePath,
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

export async function lintFile(absPath: string): Promise<LintResult> {
  let fileText: string;
  try {
    fileText = await fs.readFile(absPath, 'utf8');
  } catch (err) {
    return {
      file: absPath,
      ok: false,
      errors: [
        {
          code: 'R1',
          message: `Cannot read file: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      warnings: [],
    };
  }
  return lintRecord(fileText, { filePath: absPath });
}
