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

/**
 * Read every record, build index.json + labels.json + index.generated.md, and
 * write all three to disk under libraryDir. Throws on any unparseable record.
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

  await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  await fs.writeFile(labelsPath, `${JSON.stringify(labels, null, 2)}\n`, 'utf8');
  await fs.writeFile(generatedPath, generatedMarkdown, 'utf8');

  return {
    count: index.length,
    published: Object.keys(labels).length,
    outFiles: [indexPath, labelsPath, generatedPath],
  };
}
