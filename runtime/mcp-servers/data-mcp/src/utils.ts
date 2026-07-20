/**
 * Returns true if the SQL's first meaningful keyword is SELECT, EXPLAIN, SHOW, WITH, or VALUES.
 * Strips leading whitespace and block comments before checking.
 */
export function isReadOnlyQuery(sql: string): boolean {
  // Strip leading block comments /* ... */
  let s = sql.trim();
  while (s.startsWith('/*')) {
    const end = s.indexOf('*/');
    if (end === -1) break;
    s = s.slice(end + 2).trim();
  }
  // Strip leading line comments --
  while (s.startsWith('--')) {
    const nl = s.indexOf('\n');
    if (nl === -1) break;
    s = s.slice(nl + 1).trim();
  }
  const first = s.split(/[\s(;]+/)[0]?.toUpperCase() ?? '';
  return ['SELECT', 'EXPLAIN', 'SHOW', 'WITH', 'VALUES', 'TABLE'].includes(first);
}

/**
 * Format query rows as an ASCII table.
 */
export function formatTable(
  columns: string[],
  rows: Record<string, unknown>[],
  maxRows: number,
): string {
  if (rows.length === 0) return 'Query returned 0 rows.';

  const displayRows = rows.slice(0, maxRows);
  const truncated = rows.length > maxRows;

  // Compute column widths
  const widths: number[] = columns.map((col) => col.length);
  for (const row of displayRows) {
    columns.forEach((col, i) => {
      const val = cellStr(row[col]);
      widths[i] = Math.max(widths[i], Math.min(val.length, 80));
    });
  }

  const sep = '+-' + widths.map((w) => '-'.repeat(w)).join('-+-') + '-+';
  const header = '| ' + columns.map((col, i) => col.padEnd(widths[i])).join(' | ') + ' |';

  const dataLines = displayRows.map((row) => {
    const cells = columns.map((col, i) => {
      const v = cellStr(row[col]);
      const clipped = v.length > 80 ? v.slice(0, 79) + '…' : v;
      return clipped.padEnd(widths[i]);
    });
    return '| ' + cells.join(' | ') + ' |';
  });

  const lines = [sep, header, sep, ...dataLines, sep];
  if (truncated)
    lines.push(`(showing ${displayRows.length} of ${rows.length} rows — use LIMIT to see more)`);
  else lines.push(`(${rows.length} row${rows.length === 1 ? '' : 's'})`);

  return lines.join('\n');
}

function cellStr(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}
