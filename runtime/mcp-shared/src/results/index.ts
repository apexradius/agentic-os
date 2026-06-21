/**
 * Standardized MCP tool result builders.
 *
 * These replace the duplicated toolResult/toolError/formatError functions
 * across apex-data-mcp, apex-automation-mcp, apex-social-mcp, etc.
 */

export interface ToolTextResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export interface ToolImageResult {
  [key: string]: unknown;
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; data: string; mimeType: 'image/png' | 'image/jpeg' }
  >;
}

export type ToolResult = ToolTextResult | ToolImageResult;

/** Format an unknown error into a readable string. Includes PG error codes when present. */
export function formatError(e: unknown): string {
  if (e instanceof Error) {
    const pgErr = e as Error & { code?: string; detail?: string };
    let msg = e.message;
    if (pgErr.code) msg += ` (code: ${pgErr.code})`;
    if (pgErr.detail) msg += ` — ${pgErr.detail}`;
    return msg;
  }
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e, null, 2);
  } catch {
    return String(e);
  }
}

/** Successful text result */
export function toolResult(text: string): ToolTextResult {
  return { content: [{ type: 'text', text: text.trim() || 'Done.' }] };
}

/** Gemini-optimized text result (supports markdown blocks for easier parsing) */
export function geminiTextResult(text: string, title?: string): ToolTextResult {
  const content = title ? `### ${title}\n\n${text}` : text;
  return { content: [{ type: 'text', text: content }] };
}

/** Error result — displays to user as an error */
export function toolError(e: unknown): ToolTextResult {
  return { content: [{ type: 'text', text: formatError(e) }], isError: true };
}

/** Image result with text caption */
export function imageResult(caption: string, base64Data: string, mimeType: 'image/png' | 'image/jpeg' = 'image/png'): ToolImageResult {
  return {
    content: [
      { type: 'text', text: caption },
      { type: 'image', data: base64Data, mimeType },
    ],
  };
}

/** 
 * Multimodal result (Gemini-optimized)
 * Combines high-res image + structured JSON metadata for cross-referencing.
 */
export function multimodalResult(
  text: string,
  base64Image: string,
  metadata: any,
  mimeType: 'image/png' | 'image/jpeg' = 'image/png'
): ToolImageResult {
  return {
    content: [
      { type: 'text', text },
      { type: 'image', data: base64Image, mimeType },
      { type: 'text', text: `\n<metadata>\n${JSON.stringify(metadata, null, 2)}\n</metadata>` }
    ],
  };
}

/** Multi-content result (text + images mixed) */
export function multiContentResult(
  parts: Array<{ text: string } | { image: string; mimeType?: 'image/png' | 'image/jpeg'; caption?: string }>,
): ToolImageResult {
  const content: ToolImageResult['content'] = [];
  for (const part of parts) {
    if ('text' in part) {
      content.push({ type: 'text', text: part.text });
    } else {
      if (part.caption) content.push({ type: 'text', text: part.caption });
      content.push({ type: 'image', data: part.image, mimeType: part.mimeType ?? 'image/png' });
    }
  }
  return { content };
}
