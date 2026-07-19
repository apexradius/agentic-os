#!/usr/bin/env node
import path from 'node:path';

import { composePromptText, findPrompt, loadLibrary } from '../lib.js';
import {
  buildCapabilityIndex,
  buildProofReport,
  type CapabilityIndex,
  type IndexRecord,
  type PromptCapability,
  type PromptProofRecord,
  readCapabilityIndex,
  readIndex,
} from './build.js';

type ParsedArgs = {
  command: string;
  positionals: string[];
  libraryDir: string;
  json: boolean;
  input: string;
  risk: string;
  proof: string;
  strategy: string;
  tag: string;
  tool: string;
  domain: string;
};

function usage(): string {
  return `Usage:
  apex-prompt list [--library <dir>] [--json]
  apex-prompt search <query> [--library <dir>] [--json]
  apex-prompt capabilities [--risk <level>] [--proof <type>] [--strategy <name>] [--tag <tag>] [--tool <tool>] [--domain <domain>] [--library <dir>] [--json]
  apex-prompt proofs [--risk <level>] [--domain <domain>] [--library <dir>] [--json]
  apex-prompt show <slug> [--library <dir>] [--json]
  apex-prompt dry-run <slug> [--library <dir>] [--input <text>] [--json]

All commands are read-only. dry-run composes the prompt payload and never calls a model. proofs reports metadata coverage and never verifies live proof.`;
}

function defaultLibraryDir(): string {
  const explicitDir = process.env['APEX_PROMPT_LIBRARY_DIR'];
  if (explicitDir) return path.resolve(explicitDir);

  const explicitPath = process.env['APEX_PROMPT_LIBRARY_PATH'];
  if (explicitPath?.endsWith('index.generated.md')) {
    return path.dirname(path.resolve(explicitPath));
  }

  return path.resolve(process.cwd(), 'library');
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = [...argv];
  const command = args.shift() ?? 'help';
  let libraryDir = defaultLibraryDir();
  let json = false;
  let input = '';
  let risk = '';
  let proof = '';
  let strategy = '';
  let tag = '';
  let tool = '';
  let domain = '';
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === '--library') {
      const value = args[++i];
      if (!value) throw new Error('--library requires a directory');
      libraryDir = path.resolve(value);
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '--input') {
      const value = args[++i];
      if (value === undefined) throw new Error('--input requires a value');
      input = value;
    } else if (arg === '--risk') {
      const value = args[++i];
      if (!value) throw new Error('--risk requires a value');
      risk = value;
    } else if (arg === '--proof') {
      const value = args[++i];
      if (!value) throw new Error('--proof requires a value');
      proof = value;
    } else if (arg === '--strategy') {
      const value = args[++i];
      if (!value) throw new Error('--strategy requires a value');
      strategy = value;
    } else if (arg === '--tag') {
      const value = args[++i];
      if (!value) throw new Error('--tag requires a value');
      tag = value;
    } else if (arg === '--tool') {
      const value = args[++i];
      if (!value) throw new Error('--tool requires a value');
      tool = value;
    } else if (arg === '--domain') {
      const value = args[++i];
      if (!value) throw new Error('--domain requires a value');
      domain = value;
    } else {
      positionals.push(arg);
    }
  }

  return {
    command,
    positionals,
    libraryDir,
    json,
    input,
    risk,
    proof,
    strategy,
    tag,
    tool,
    domain,
  };
}

async function loadIndexOrThrow(libraryDir: string): Promise<IndexRecord[]> {
  const index = await readIndex(libraryDir);
  if (!index) {
    throw new Error(`No readable index.json in ${libraryDir}; run prompt-os:build first`);
  }
  return index;
}

async function loadCapabilityIndexOrBuild(libraryDir: string): Promise<CapabilityIndex> {
  const capabilities = await readCapabilityIndex(libraryDir);
  if (capabilities) return capabilities;
  const index = await loadIndexOrThrow(libraryDir);
  return buildCapabilityIndex(index);
}

function searchableText(record: IndexRecord): string {
  const tags = arrayField(record.tags);
  const triggerPhrases = arrayField(record.trigger_phrases);
  const allowedTools = arrayField(record.allowed_tools);
  const proofRequired = arrayField(record.proof_required);
  const strategyOverlays = arrayField(record.strategy_overlays);
  return [
    record.id,
    record.name,
    record.slug,
    record.domain,
    record.status,
    record.risk_level ?? '',
    ...record.sections,
    ...record.eval_refs,
    ...record.includes,
    ...tags,
    ...triggerPhrases,
    ...allowedTools,
    ...proofRequired,
    ...strategyOverlays,
  ]
    .join(' ')
    .toLowerCase();
}

function compactCapability(capability: PromptCapability): Record<string, unknown> {
  return {
    slug: capability.slug,
    name: capability.name,
    domain: capability.domain,
    status: capability.status,
    risk_level: capability.risk_level,
    tags: capability.tags,
    allowed_tools: capability.allowed_tools,
    proof_required: capability.proof_required,
    strategy_overlays: capability.strategy_overlays,
    file: capability.file,
  };
}

function compactRecord(record: IndexRecord): Record<string, unknown> {
  return {
    slug: record.slug,
    name: record.name,
    domain: record.domain,
    status: record.status,
    version: record.version,
    risk_level: record.risk_level,
    tags: arrayField(record.tags),
    trigger_phrases: arrayField(record.trigger_phrases),
    proof_required: arrayField(record.proof_required),
    strategy_overlays: arrayField(record.strategy_overlays),
    file: record.file,
  };
}

function filterCapabilities(
  capabilities: PromptCapability[],
  args: ParsedArgs,
): PromptCapability[] {
  return capabilities.filter((capability) => {
    if (args.domain && capability.domain !== args.domain) return false;
    if (args.risk && (capability.risk_level ?? 'unrated') !== args.risk) return false;
    if (args.proof && !capability.proof_required.includes(args.proof)) return false;
    if (args.strategy && !capability.strategy_overlays.includes(args.strategy)) return false;
    if (args.tag && !capability.tags.includes(args.tag)) return false;
    if (args.tool && !capability.allowed_tools.includes(args.tool)) return false;
    return true;
  });
}

function printTable(records: IndexRecord[]): void {
  for (const record of records) {
    const risk = record.risk_level ?? 'unrated';
    const tagsValue = arrayField(record.tags);
    const tags = tagsValue.length > 0 ? ` tags=${tagsValue.join(',')}` : '';
    console.log(`${record.slug}\t${record.status}\t${record.domain}\t${risk}${tags}`);
  }
}

function printCapabilityTable(records: PromptCapability[]): void {
  for (const record of records) {
    const risk = record.risk_level ?? 'unrated';
    const proof = record.proof_required.length ? ` proof=${record.proof_required.join(',')}` : '';
    const strategies = record.strategy_overlays.length
      ? ` strategies=${record.strategy_overlays.join(',')}`
      : '';
    const tags = record.tags.length ? ` tags=${record.tags.join(',')}` : '';
    console.log(
      `${record.slug}\t${record.status}\t${record.domain}\t${risk}${proof}${strategies}${tags}`,
    );
  }
}

function printProofTable(records: PromptProofRecord[]): void {
  for (const record of records) {
    const risk = record.risk_level ?? 'unrated';
    const proof = record.proof_required.length ? record.proof_required.join(',') : 'missing';
    console.log(`${record.slug}\t${record.status}\t${record.domain}\t${risk}\tproof=${proof}`);
  }
}

function arrayField(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

async function loadComposedPrompt(
  libraryDir: string,
  slug: string,
): Promise<{
  record: IndexRecord | null;
  composition: string[];
  text: string;
  source_path: string;
}> {
  const generatedPath = path.join(libraryDir, 'index.generated.md');
  process.env['APEX_PROMPT_LIBRARY_MODE'] = 'structured';
  process.env['APEX_PROMPT_LIBRARY_PATH'] = generatedPath;

  const index = await loadIndexOrThrow(libraryDir);
  const record = index.find((entry) => entry.slug === slug || entry.id === slug) ?? null;
  const library = await loadLibrary(generatedPath, generatedPath);
  const prompt = findPrompt(library.prompts, slug);
  if (!prompt) throw new Error(`Prompt not found: ${slug}`);
  const composed = composePromptText(prompt, library.prompts);
  return {
    record,
    composition: composed.composition,
    text: composed.text,
    source_path: library.source_path,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === 'help' || args.command === '--help' || args.command === '-h') {
    console.log(usage());
    return;
  }

  if (args.command === 'list') {
    const index = await loadIndexOrThrow(args.libraryDir);
    if (args.json) {
      console.log(JSON.stringify(index.map(compactRecord), null, 2));
    } else {
      printTable(index);
    }
    return;
  }

  if (args.command === 'search') {
    const query = args.positionals.join(' ').trim().toLowerCase();
    if (!query) throw new Error('search requires a query');
    const index = await loadIndexOrThrow(args.libraryDir);
    const matches = index.filter((record) => searchableText(record).includes(query));
    if (args.json) {
      console.log(JSON.stringify(matches.map(compactRecord), null, 2));
    } else {
      printTable(matches);
    }
    return;
  }

  if (args.command === 'capabilities') {
    const capabilityIndex = await loadCapabilityIndexOrBuild(args.libraryDir);
    const matches = filterCapabilities(capabilityIndex.capabilities, args);
    if (args.json) {
      console.log(
        JSON.stringify(
          {
            schema_version: capabilityIndex.schema_version,
            summary: capabilityIndex.summary,
            filters: {
              domain: args.domain || null,
              risk: args.risk || null,
              proof: args.proof || null,
              strategy: args.strategy || null,
              tag: args.tag || null,
              tool: args.tool || null,
            },
            count: matches.length,
            capabilities: matches.map(compactCapability),
          },
          null,
          2,
        ),
      );
    } else {
      console.log(
        `records=${capabilityIndex.summary.records} published=${capabilityIndex.summary.published} matches=${matches.length}`,
      );
      printCapabilityTable(matches);
    }
    return;
  }

  if (args.command === 'proofs') {
    const capabilityIndex = await loadCapabilityIndexOrBuild(args.libraryDir);
    const matches = filterCapabilities(capabilityIndex.capabilities, args);
    const report = buildProofReport({
      ...capabilityIndex,
      capabilities: matches,
    });
    const output = {
      mode: 'proof-report',
      executes_model: false,
      executes_tools: false,
      library_dir: args.libraryDir,
      filters: {
        domain: args.domain || null,
        risk: args.risk || null,
        proof: args.proof || null,
        strategy: args.strategy || null,
        tag: args.tag || null,
        tool: args.tool || null,
      },
      ...report,
    };
    if (args.json) {
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log(
        `records=${report.summary.records} proof_required=${report.summary.proof_required} proof_missing=${report.summary.proof_missing} high_risk_missing=${report.summary.high_risk_missing}`,
      );
      printProofTable(report.records);
    }
    return;
  }

  if (args.command === 'show') {
    const slug = args.positionals[0];
    if (!slug) throw new Error('show requires a prompt slug');
    const index = await loadIndexOrThrow(args.libraryDir);
    const record = index.find((entry) => entry.slug === slug || entry.id === slug);
    if (!record) throw new Error(`Prompt not found: ${slug}`);
    if (args.json) {
      console.log(JSON.stringify(record, null, 2));
    } else {
      console.log(`${record.name} (${record.slug})`);
      console.log(`status=${record.status} domain=${record.domain} version=${record.version}`);
      console.log(
        `risk=${record.risk_level ?? 'unrated'} proof=${arrayField(record.proof_required).join(',') || 'unspecified'}`,
      );
      console.log(`includes=${record.includes.join(',') || 'none'}`);
      console.log(`strategies=${arrayField(record.strategy_overlays).join(',') || 'none'}`);
      console.log(`file=${record.file}`);
    }
    return;
  }

  if (args.command === 'dry-run') {
    const slug = args.positionals[0];
    if (!slug) throw new Error('dry-run requires a prompt slug');
    const payload = await loadComposedPrompt(args.libraryDir, slug);
    const output = {
      mode: 'dry-run',
      executes_model: false,
      executes_tools: false,
      library_dir: args.libraryDir,
      source_path: payload.source_path,
      prompt: payload.record ? compactRecord(payload.record) : { slug },
      composition: payload.composition,
      input: args.input,
      text: payload.text,
    };
    if (args.json) {
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log(JSON.stringify(output, null, 2));
    }
    return;
  }

  throw new Error(`Unknown command: ${args.command}\n\n${usage()}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
