// Strict minimal front-matter parser. Zero external dependencies.
// Supports: unquoted scalars, single/double quoted scalars, inline flow arrays.
// Rejects: block scalars, multiline values, nested maps.

export type FrontmatterResult = {
  data: Record<string, unknown> | null;
  body: string;
  error: string | null;
};

/**
 * Parse a YAML-style flow scalar value from a string.
 * Returns the parsed JS value (string or string[]).
 */
function parseValue(raw: string): string | string[] | null {
  const s = raw.trim();

  // Inline flow array: [a, b, c] or ["a", 'b', c]
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1);
    const items: string[] = [];
    // Split by comma, respecting quoted strings
    let current = '';
    let inQuote: '"' | "'" | null = null;
    for (let i = 0; i < inner.length; i++) {
      const ch = inner[i];
      if (inQuote) {
        if (ch === inQuote) {
          inQuote = null;
        } else {
          current += ch;
        }
      } else if (ch === '"' || ch === "'") {
        inQuote = ch;
      } else if (ch === ',') {
        items.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    // Push last item
    const last = current.trim();
    if (last.length > 0) items.push(last);
    return items;
  }

  // Double-quoted scalar
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    return s.slice(1, -1);
  }

  // Single-quoted scalar
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) {
    return s.slice(1, -1);
  }

  // Unquoted scalar — strip trailing comment (only outside quotes, already handled above)
  const commentIdx = s.indexOf(' #');
  const unquoted = commentIdx >= 0 ? s.slice(0, commentIdx).trim() : s;

  // Reject block scalar indicators
  if (unquoted === '|' || unquoted === '>') {
    return null; // block scalar — caller will error
  }

  return unquoted;
}

/**
 * Parse front-matter from file text.
 * If the file does not begin with exactly `---`, returns missing front-matter error.
 * Body is everything after the closing `---` line.
 */
export function parseFrontmatter(fileText: string): FrontmatterResult {
  const text = fileText.replace(/\r\n/g, '\n');
  const lines = text.split('\n');

  // Must start with exactly '---'
  if (lines[0] !== '---') {
    return { data: null, body: fileText, error: 'missing front-matter' };
  }

  // Find closing '---'
  let closingIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      closingIdx = i;
      break;
    }
  }

  if (closingIdx === -1) {
    return { data: null, body: fileText, error: 'front-matter not closed (missing closing ---)' };
  }

  const fmLines = lines.slice(1, closingIdx);
  const body = lines.slice(closingIdx + 1).join('\n');
  const data: Record<string, unknown> = {};

  for (const line of fmLines) {
    // Skip empty lines and comment lines
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    // Detect block scalar / nested map: key: with nothing or only a comment after
    // Also detect indented lines (continuation) — these are block/multiline
    if (/^\s+/.test(line)) {
      return {
        data: null,
        body,
        error: `front-matter contains block/multiline/nested value (indented line: ${JSON.stringify(line)})`,
      };
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx < 0) {
      return {
        data: null,
        body,
        error: `front-matter line is not a key: value pair: ${JSON.stringify(line)}`,
      };
    }

    const key = line.slice(0, colonIdx).trim();
    const rawValue = line.slice(colonIdx + 1);

    // Check if value is empty or only a comment (block scalar / nested map indicator)
    const trimmedValue = rawValue.trim();
    const isEmptyOrComment = trimmedValue === '' || trimmedValue.startsWith('#');
    if (isEmptyOrComment) {
      // This means the key has a nested map or block scalar below it
      return {
        data: null,
        body,
        error: `front-matter key "${key}" has no inline value (block/nested map not supported)`,
      };
    }

    if (!key) {
      return {
        data: null,
        body,
        error: `front-matter line has empty key: ${JSON.stringify(line)}`,
      };
    }

    const parsed = parseValue(rawValue);
    if (parsed === null) {
      return {
        data: null,
        body,
        error: `front-matter key "${key}" uses a block scalar or unsupported value`,
      };
    }

    data[key] = parsed;
  }

  return { data, body, error: null };
}
