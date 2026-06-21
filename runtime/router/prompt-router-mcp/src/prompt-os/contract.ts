import { z } from 'zod';

// ---------------------------------------------------------------------------
// Contract constants
// ---------------------------------------------------------------------------

export const CONTRACT_VERSION = '1.0';

export const DOMAINS = ['services', 'operations', 'platforms', 'lifecycle', 'templates', 'loops'] as const;

export const ALLOWED_INCLUDES = new Set([
  'universal-intake-contract',
  'loops/loop-contract',
  'loops/plan-implement-verify',
  'loops/planner-generator-evaluator',
  'loops/reflexion',
  'loops/ralph-pattern',
]);

// Required sections for ALL prompt records (XML-style tags in body)
export const REQUIRED_ALL = ['role', 'output_contract', 'constraints', 'exit_criteria'] as const;

// Additional required sections for WORKFLOW prompts
export const REQUIRED_WORKFLOW = ['intake_gate', 'plan', 'implement', 'verify'] as const;

// ---------------------------------------------------------------------------
// Rule codes + human messages
// ---------------------------------------------------------------------------

export type RuleCode =
  | 'R1'
  | 'R2'
  | 'R3'
  | 'R4'
  | 'R6'
  | 'R7'
  | 'R8'
  | 'R9a'
  | 'R9b'
  | 'R10'
  | 'R11'
  | 'R12'
  | 'R-INV';

export const RULE_MESSAGES: Record<RuleCode, string> = {
  R1: 'Front-matter missing, unparseable, or fails schema validation',
  R2: 'id does not match slugify(heading name)',
  R3: 'id does not match file basename (without .prompt.md)',
  R4: 'Required section missing from body',
  R6: 'Workflow prompt is missing a required workflow section',
  R7: 'Potential blanket negative (NEVER/ALWAYS without qualifier) — review for precision',
  R8: 'status is "published" but eval_refs is empty (at least 1 required)',
  R9a: 'status is "deprecated" but deprecated date field is missing',
  R9b: 'status is not "deprecated" but deprecated date field is present',
  R10: 'created/updated/deprecated date does not match YYYY-MM-DD format',
  R11: 'parsePromptLibrary returned 0 prompts or produced warnings (unbalanced/missing ## heading or ```text fence)',
  R12: 'includes value is not in ALLOWED_INCLUDES set (unknown block)',
  'R-INV': 'Workflow prompt is missing grounding gate (<investigate_before_answering> or <intake_gate>)',
};

// ---------------------------------------------------------------------------
// Zod schema for front-matter (mirrors prompt-os.schema.json exactly)
// ---------------------------------------------------------------------------

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const idPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const versionPattern = /^\d+\.\d+\.\d+$/;
const contractVersionPattern = /^\d+\.\d+$/;

export const FrontmatterSchema = z
  .object({
    id: z.string().regex(idPattern, 'id must match ^[a-z0-9]+(-[a-z0-9]+)*$'),
    version: z.string().regex(versionPattern, 'version must match semver \\d+.\\d+.\\d+'),
    domain: z.enum(DOMAINS),
    owner: z.string().min(1, 'owner must be non-empty'),
    model_targets: z.array(z.string().min(1)).min(1, 'model_targets must have at least 1 entry'),
    status: z.enum(['draft', 'in_review', 'published', 'deprecated']),
    contract_version: z
      .string()
      .regex(contractVersionPattern, 'contract_version must match \\d+.\\d+'),
    eval_refs: z.array(z.string().min(1)),
    includes: z.array(z.string().min(1)),
    created: z.string().regex(datePattern, 'created must match YYYY-MM-DD'),
    updated: z.string().regex(datePattern, 'updated must match YYYY-MM-DD'),
    deprecated: z.string().regex(datePattern, 'deprecated must match YYYY-MM-DD').optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    // R8: published requires at least 1 eval_ref
    if (data.status === 'published' && data.eval_refs.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['eval_refs'],
        message: 'R8: status "published" requires at least 1 eval_refs entry',
      });
    }
    // R9a: deprecated status requires deprecated date
    if (data.status === 'deprecated' && !data.deprecated) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deprecated'],
        message: 'R9a: status "deprecated" requires a deprecated date field',
      });
    }
    // R9b: non-deprecated status must NOT have deprecated date
    if (data.status !== 'deprecated' && data.deprecated !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deprecated'],
        message: 'R9b: deprecated date is present but status is not "deprecated"',
      });
    }
  });

export type FrontmatterData = z.infer<typeof FrontmatterSchema>;
