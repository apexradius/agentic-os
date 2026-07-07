import { promises as fs } from 'node:fs';
import path from 'node:path';

import { parsePromptLibrary } from '../lib.js';
import { parseFrontmatter } from './frontmatter.js';
import { collectSections } from './lint.js';

// ---------------------------------------------------------------------------
// Apex Prompt OS — sidecar build.
//
// Reads every library/prompts/**/*.prompt.md and emits three committed
// artifacts into library/:
//   - index.json           : per-record metadata sidecar
//   - labels.json          : { <slug>: { production: <version> } } for published only
//   - index.generated.md   : concatenation parser-equivalent to the monolith,
//                            reproducing every record byte-identically
//   - capabilities.json    : compact discovery index for prompt capabilities
//
// index.generated.md exists so the router can run in opt-in "structured" mode
// against the per-record library while parsePromptLibrary stays the single
// source of truth for parsing.
// ---------------------------------------------------------------------------

export type IndexRecord = {
  id: string;
  name: string;
  slug: string;
  domain: string;
  status: string;
  version: string;
  file: string; // path relative to library/
  sections: string[];
  eval_refs: string[];
  includes: string[];
  tags: string[];
  trigger_phrases: string[];
  risk_level: string | null;
  allowed_tools: string[];
  proof_required: string[];
  strategy_overlays: string[];
};

export type PromptCapability = {
  slug: string;
  name: string;
  domain: string;
  status: string;
  risk_level: string | null;
  tags: string[];
  trigger_phrases: string[];
  allowed_tools: string[];
  proof_required: string[];
  strategy_overlays: string[];
  sections: string[];
  file: string;
};

export type CapabilityIndex = {
  schema_version: 'prompt-capability-index.v1';
  generated_from: 'index.json';
  summary: {
    records: number;
    published: number;
    by_domain: Record<string, number>;
    by_risk: Record<string, number>;
    tags: Record<string, number>;
    allowed_tools: Record<string, number>;
    proof_required: Record<string, number>;
    strategy_overlays: Record<string, number>;
  };
  capabilities: PromptCapability[];
  lookups: {
    by_domain: Record<string, string[]>;
    by_risk: Record<string, string[]>;
    by_tag: Record<string, string[]>;
    by_tool: Record<string, string[]>;
    by_proof: Record<string, string[]>;
    by_strategy: Record<string, string[]>;
  };
};

export type PromptProofRecord = {
  slug: string;
  name: string;
  domain: string;
  status: string;
  risk_level: string | null;
  proof_required: string[];
  proof_status: 'required' | 'missing';
  file: string;
};

export type PromptProofReport = {
  schema_version: 'prompt-proof-report.v1';
  generated_from: 'capabilities.json';
  summary: {
    records: number;
    proof_required: number;
    proof_missing: number;
    high_risk_missing: number;
    by_proof: Record<string, number>;
  };
  records: PromptProofRecord[];
  missing: PromptProofRecord[];
};

/**
 * Read the committed index.json sidecar. Returns null when it is absent or
 * unreadable so callers can degrade gracefully instead of throwing.
 */
export async function readIndex(libraryDir: string): Promise<IndexRecord[] | null> {
  const indexPath = path.join(libraryDir, 'index.json');
  try {
    const raw = await fs.readFile(indexPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as IndexRecord[];
  } catch {
    return null;
  }
}

export async function readCapabilityIndex(libraryDir: string): Promise<CapabilityIndex | null> {
  const capabilityPath = path.join(libraryDir, 'capabilities.json');
  try {
    const raw = await fs.readFile(capabilityPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.schema_version !== 'prompt-capability-index.v1') return null;
    return parsed as CapabilityIndex;
  } catch {
    return null;
  }
}

async function walkForPrompts(dir: string, found: string[]): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkForPrompts(full, found);
    } else if (entry.isFile() && entry.name.endsWith('.prompt.md')) {
      found.push(full);
    }
  }
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  return [];
}

function incCounter(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] ?? 0) + 1;
}

function addLookup(lookup: Record<string, string[]>, key: string, slug: string): void {
  if (!lookup[key]) lookup[key] = [];
  lookup[key].push(slug);
}

function sortedRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b))) as Record<string, T>;
}

function sortLookup(lookup: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, slugs] of Object.entries(lookup).sort(([a], [b]) => a.localeCompare(b))) {
    out[key] = [...new Set(slugs)].sort();
  }
  return out;
}

export function buildCapabilityIndex(index: IndexRecord[]): CapabilityIndex {
  const capabilities: PromptCapability[] = index.map((record) => ({
    slug: record.slug,
    name: record.name,
    domain: record.domain,
    status: record.status,
    risk_level: record.risk_level,
    tags: asStringArray(record.tags),
    trigger_phrases: asStringArray(record.trigger_phrases),
    allowed_tools: asStringArray(record.allowed_tools),
    proof_required: asStringArray(record.proof_required),
    strategy_overlays: asStringArray(record.strategy_overlays),
    sections: asStringArray(record.sections),
    file: record.file,
  })).sort((a, b) => a.slug.localeCompare(b.slug));

  const summary: CapabilityIndex['summary'] = {
    records: capabilities.length,
    published: capabilities.filter((cap) => cap.status === 'published').length,
    by_domain: {},
    by_risk: {},
    tags: {},
    allowed_tools: {},
    proof_required: {},
    strategy_overlays: {},
  };
  const lookups: CapabilityIndex['lookups'] = {
    by_domain: {},
    by_risk: {},
    by_tag: {},
    by_tool: {},
    by_proof: {},
    by_strategy: {},
  };

  for (const cap of capabilities) {
    const risk = cap.risk_level ?? 'unrated';
    incCounter(summary.by_domain, cap.domain || 'unknown');
    incCounter(summary.by_risk, risk);
    addLookup(lookups.by_domain, cap.domain || 'unknown', cap.slug);
    addLookup(lookups.by_risk, risk, cap.slug);
    for (const tag of cap.tags) {
      incCounter(summary.tags, tag);
      addLookup(lookups.by_tag, tag, cap.slug);
    }
    for (const tool of cap.allowed_tools) {
      incCounter(summary.allowed_tools, tool);
      addLookup(lookups.by_tool, tool, cap.slug);
    }
    for (const proof of cap.proof_required) {
      incCounter(summary.proof_required, proof);
      addLookup(lookups.by_proof, proof, cap.slug);
    }
    for (const strategy of cap.strategy_overlays) {
      incCounter(summary.strategy_overlays, strategy);
      addLookup(lookups.by_strategy, strategy, cap.slug);
    }
  }

  return {
    schema_version: 'prompt-capability-index.v1',
    generated_from: 'index.json',
    summary: {
      records: summary.records,
      published: summary.published,
      by_domain: sortedRecord(summary.by_domain),
      by_risk: sortedRecord(summary.by_risk),
      tags: sortedRecord(summary.tags),
      allowed_tools: sortedRecord(summary.allowed_tools),
      proof_required: sortedRecord(summary.proof_required),
      strategy_overlays: sortedRecord(summary.strategy_overlays),
    },
    capabilities,
    lookups: {
      by_domain: sortLookup(lookups.by_domain),
      by_risk: sortLookup(lookups.by_risk),
      by_tag: sortLookup(lookups.by_tag),
      by_tool: sortLookup(lookups.by_tool),
      by_proof: sortLookup(lookups.by_proof),
      by_strategy: sortLookup(lookups.by_strategy),
    },
  };
}

export function buildProofReport(capabilityIndex: CapabilityIndex): PromptProofReport {
  const records: PromptProofRecord[] = capabilityIndex.capabilities.map((capability) => {
    const proofRequired = asStringArray(capability.proof_required);
    return {
      slug: capability.slug,
      name: capability.name,
      domain: capability.domain,
      status: capability.status,
      risk_level: capability.risk_level,
      proof_required: proofRequired,
      proof_status: proofRequired.length > 0 ? 'required' as const : 'missing' as const,
      file: capability.file,
    };
  }).sort((a, b) => a.slug.localeCompare(b.slug));

  const missing = records.filter((record) => record.proof_status === 'missing');
  const highRiskMissing = missing.filter((record) => record.risk_level === 'critical' || record.risk_level === 'high');
  const byProof: Record<string, number> = {};
  for (const record of records) {
    for (const proof of record.proof_required) {
      incCounter(byProof, proof);
    }
  }

  return {
    schema_version: 'prompt-proof-report.v1',
    generated_from: 'capabilities.json',
    summary: {
      records: records.length,
      proof_required: records.length - missing.length,
      proof_missing: missing.length,
      high_risk_missing: highRiskMissing.length,
      by_proof: sortedRecord(byProof),
    },
    records,
    missing,
  };
}

/**
 * Read every record, build index.json + labels.json + index.generated.md, and
 * write the sidecars to disk under libraryDir. Throws on any unparseable record.
 */
export async function writeArtifacts(libraryDir: string): Promise<{ count: number; published: number; outFiles: string[] }> {
  const promptsDir = path.join(libraryDir, 'prompts');
  const files: string[] = [];
  await walkForPrompts(promptsDir, files);
  files.sort();

  const index: IndexRecord[] = [];
  const labels: Record<string, { production: string }> = {};
  const blocks: Array<{ slug: string; markdown: string }> = [];

  for (const absPath of files) {
    const fileText = await fs.readFile(absPath, 'utf8');
    const fm = parseFrontmatter(fileText);
    if (fm.error !== null || fm.data === null) {
      throw new Error(`build: front-matter parse failed for ${absPath}: ${fm.error ?? 'unknown'}`);
    }
    const parsed = parsePromptLibrary(fileText);
    if (parsed.prompts.length === 0) {
      throw new Error(`build: no prompt parsed from ${absPath} (missing ## heading or \`\`\`text fence)`);
    }
    if (parsed.warnings.length > 0) {
      throw new Error(`build: parser warning for ${absPath}: ${parsed.warnings.join('; ')}`);
    }
    const entry = parsed.prompts[0]!;

    const id = typeof fm.data['id'] === 'string' ? fm.data['id'] : entry.slug;
    const domain = typeof fm.data['domain'] === 'string' ? fm.data['domain'] : '';
    const status = typeof fm.data['status'] === 'string' ? fm.data['status'] : '';
    const version = typeof fm.data['version'] === 'string' ? fm.data['version'] : '';
    const evalRefs = asStringArray(fm.data['eval_refs']);
    const includes = asStringArray(fm.data['includes']);
    const tags = asStringArray(fm.data['tags']);
    const triggerPhrases = asStringArray(fm.data['trigger_phrases']);
    const riskLevel = typeof fm.data['risk_level'] === 'string' ? fm.data['risk_level'] : null;
    const allowedTools = asStringArray(fm.data['allowed_tools']);
    const proofRequired = asStringArray(fm.data['proof_required']);
    const strategyOverlays = asStringArray(fm.data['strategy_overlays']);
    const sections = [...collectSections(fm.body)].sort();
    const relFile = path.relative(libraryDir, absPath).split(path.sep).join('/');

    index.push({
      id,
      name: entry.name,
      slug: entry.slug,
      domain,
      status,
      version,
      file: relFile,
      sections,
      eval_refs: evalRefs,
      includes,
      tags,
      trigger_phrases: triggerPhrases,
      risk_level: riskLevel,
      allowed_tools: allowedTools,
      proof_required: proofRequired,
      strategy_overlays: strategyOverlays,
    });

    if (status === 'published') {
      labels[entry.slug] = { production: version };
    }

    // Byte-identical block: parser trims fence content, and entry.text is the
    // already-trimmed parse output, so this round-trips exactly.
    blocks.push({
      slug: entry.slug,
      markdown: `## ${entry.name}\n\n\`\`\`text\n${entry.text}\n\`\`\`\n\n`,
    });
  }

  index.sort((a, b) => a.slug.localeCompare(b.slug));
  blocks.sort((a, b) => a.slug.localeCompare(b.slug));

  const generatedMarkdown = blocks.map((b) => b.markdown).join('');

  const indexPath = path.join(libraryDir, 'index.json');
  const labelsPath = path.join(libraryDir, 'labels.json');
  const generatedPath = path.join(libraryDir, 'index.generated.md');
  const capabilitiesPath = path.join(libraryDir, 'capabilities.json');
  const capabilityIndex = buildCapabilityIndex(index);

  await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  await fs.writeFile(labelsPath, `${JSON.stringify(labels, null, 2)}\n`, 'utf8');
  await fs.writeFile(generatedPath, generatedMarkdown, 'utf8');
  await fs.writeFile(capabilitiesPath, `${JSON.stringify(capabilityIndex, null, 2)}\n`, 'utf8');

  return {
    count: index.length,
    published: Object.keys(labels).length,
    outFiles: [indexPath, labelsPath, generatedPath, capabilitiesPath],
  };
}
