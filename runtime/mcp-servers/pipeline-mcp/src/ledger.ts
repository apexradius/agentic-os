import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** A recorded pipeline-stage completion. `proof` is the attested evidence triple. */
export interface CompletionRecord {
  item_id: string;
  stage_id: string;
  proof: unknown;
  recorded_at: string;
}

/**
 * Append-only JSONL ledger of stage completions. The real side effect the
 * proof gate protects: a refused call must leave this file untouched.
 */
export class Ledger {
  constructor(private readonly path: string) {}

  async append(record: CompletionRecord): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await appendFile(this.path, `${JSON.stringify(record)}\n`, 'utf8');
  }

  async readAll(): Promise<CompletionRecord[]> {
    try {
      const text = await readFile(this.path, 'utf8');
      return text
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as CompletionRecord);
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
      throw e;
    }
  }
}
