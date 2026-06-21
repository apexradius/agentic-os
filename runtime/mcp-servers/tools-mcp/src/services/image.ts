/**
 * Native image processing service — sharp-backed replacement for imagesorcery-mcp.
 *
 * Tool names + schemas match the original imagesorcery tool surface so existing
 * callers keep working. ML-heavy tools (detect, find, ocr, draw_*) are NOT
 * reimplemented — sharp has no drawing primitives, no OCR, no object detection.
 * Those tools are registered as explicit "not_implemented" stubs so callers
 * receive a clear error instead of a silent missing-tool failure.
 *
 * Cleanup context: imagesorcery-mcp carried 1.2GB of PyTorch + OpenCV + YOLO/CLIP
 * weights in a separate Python venv. Removed 2026-04-16 in favor of sharp.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import sharp from 'sharp';
import { log } from '@framework/mcp-shared';

const MCP_NAME = 'apex-tools-mcp';
const SERVICE = 'image';

// ---------------------------------------------------------------------------
// Result helpers (match shape used by other services)
// ---------------------------------------------------------------------------
function textResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(message: string, code: string) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ error: message, code, retryable: false }, null, 2),
      },
    ],
    isError: true,
  };
}

const REMOVED_MESSAGE =
  'Tool not implemented. This operation was previously provided by imagesorcery-mcp ' +
  '(Python/PyTorch/OpenCV) which was removed during the 2026-04-16 cleanup because it ' +
  'required a 1.2GB ML dependency stack. sharp (the current backend) has no equivalent. ' +
  'If you need this, either (a) use an external vision API (e.g. Claude vision for OCR/detection) ' +
  'or (b) re-add a lighter, purpose-built MCP for just this op.';

// ---------------------------------------------------------------------------
// Input resolution — accept absolute paths only (explicit, no surprises)
// ---------------------------------------------------------------------------
function assertAbsolute(p: string, field: string): void {
  if (!p || typeof p !== 'string' || !p.startsWith('/')) {
    throw new Error(`${field} must be an absolute path (received: ${JSON.stringify(p)})`);
  }
}

async function runSharp<T>(
  operation: string,
  fn: () => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: string; code: string }> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error(MCP_NAME, SERVICE, operation, message);
    return { ok: false, error: message, code: 'SHARP_ERROR' };
  }
}

// ---------------------------------------------------------------------------
// Register all image tools
// ---------------------------------------------------------------------------
export function registerImageTools(server: McpServer): number {
  let registered = 0;

  // ---------- blur ----------
  server.tool(
    'blur',
    'Apply a Gaussian blur to an image. Returns the path of the written output.',
    {
      input_path: z.string().describe('Absolute path to the input image'),
      output_path: z.string().describe('Absolute path where the blurred image will be written'),
      sigma: z.number().min(0.3).max(1000).default(5).describe('Gaussian sigma (0.3–1000)'),
    },
    async ({ input_path, output_path, sigma }) => {
      assertAbsolute(input_path, 'input_path');
      assertAbsolute(output_path, 'output_path');
      const result = await runSharp('blur', async () => {
        await sharp(input_path).blur(sigma).toFile(output_path);
        return { input_path, output_path, sigma };
      });
      return result.ok
        ? textResult({ success: true, operation: 'blur', ...result.data })
        : errorResult(result.error, result.code);
    },
  );
  registered++;

  // ---------- crop ----------
  server.tool(
    'crop',
    'Crop a rectangular region from an image.',
    {
      input_path: z.string().describe('Absolute path to the input image'),
      output_path: z.string().describe('Absolute path where the cropped image will be written'),
      left: z.number().int().min(0).describe('Left offset in pixels'),
      top: z.number().int().min(0).describe('Top offset in pixels'),
      width: z.number().int().min(1).describe('Width of the crop region'),
      height: z.number().int().min(1).describe('Height of the crop region'),
    },
    async ({ input_path, output_path, left, top, width, height }) => {
      assertAbsolute(input_path, 'input_path');
      assertAbsolute(output_path, 'output_path');
      const result = await runSharp('crop', async () => {
        await sharp(input_path).extract({ left, top, width, height }).toFile(output_path);
        return { input_path, output_path, left, top, width, height };
      });
      return result.ok
        ? textResult({ success: true, operation: 'crop', ...result.data })
        : errorResult(result.error, result.code);
    },
  );
  registered++;

  // ---------- resize ----------
  server.tool(
    'resize',
    'Resize an image to the given dimensions.',
    {
      input_path: z.string().describe('Absolute path to the input image'),
      output_path: z.string().describe('Absolute path where the resized image will be written'),
      width: z.number().int().min(1).optional().describe('Target width (omit to auto-calc from height)'),
      height: z.number().int().min(1).optional().describe('Target height (omit to auto-calc from width)'),
      fit: z
        .enum(['cover', 'contain', 'fill', 'inside', 'outside'])
        .default('cover')
        .describe('How to fit the image into the target dimensions'),
    },
    async ({ input_path, output_path, width, height, fit }) => {
      assertAbsolute(input_path, 'input_path');
      assertAbsolute(output_path, 'output_path');
      if (width === undefined && height === undefined) {
        return errorResult('At least one of width or height must be provided', 'INVALID_INPUT');
      }
      const result = await runSharp('resize', async () => {
        await sharp(input_path).resize(width, height, { fit }).toFile(output_path);
        return { input_path, output_path, width, height, fit };
      });
      return result.ok
        ? textResult({ success: true, operation: 'resize', ...result.data })
        : errorResult(result.error, result.code);
    },
  );
  registered++;

  // ---------- rotate ----------
  server.tool(
    'rotate',
    'Rotate an image by the given angle (degrees). Uses a transparent background for non-cardinal angles.',
    {
      input_path: z.string().describe('Absolute path to the input image'),
      output_path: z.string().describe('Absolute path where the rotated image will be written'),
      angle: z.number().describe('Rotation angle in degrees (clockwise)'),
      background: z
        .string()
        .default('#00000000')
        .describe('Background color for uncovered areas (CSS color string)'),
    },
    async ({ input_path, output_path, angle, background }) => {
      assertAbsolute(input_path, 'input_path');
      assertAbsolute(output_path, 'output_path');
      const result = await runSharp('rotate', async () => {
        await sharp(input_path).rotate(angle, { background }).toFile(output_path);
        return { input_path, output_path, angle, background };
      });
      return result.ok
        ? textResult({ success: true, operation: 'rotate', ...result.data })
        : errorResult(result.error, result.code);
    },
  );
  registered++;

  // ---------- change_color ----------
  server.tool(
    'change_color',
    'Recolor an image. Either tints it with a color (multiplies RGB) or converts to grayscale.',
    {
      input_path: z.string().describe('Absolute path to the input image'),
      output_path: z.string().describe('Absolute path where the recolored image will be written'),
      mode: z
        .enum(['tint', 'grayscale'])
        .default('tint')
        .describe('"tint" multiplies by the color; "grayscale" desaturates'),
      color: z
        .string()
        .default('#ffffff')
        .describe('Tint color (ignored when mode=grayscale)'),
    },
    async ({ input_path, output_path, mode, color }) => {
      assertAbsolute(input_path, 'input_path');
      assertAbsolute(output_path, 'output_path');
      const result = await runSharp('change_color', async () => {
        const pipeline = sharp(input_path);
        if (mode === 'grayscale') {
          await pipeline.grayscale().toFile(output_path);
        } else {
          await pipeline.tint(color).toFile(output_path);
        }
        return { input_path, output_path, mode, color };
      });
      return result.ok
        ? textResult({ success: true, operation: 'change_color', ...result.data })
        : errorResult(result.error, result.code);
    },
  );
  registered++;

  // ---------- fill ----------
  server.tool(
    'fill',
    'Fill a rectangular region of an image with a solid color by compositing.',
    {
      input_path: z.string().describe('Absolute path to the input image'),
      output_path: z.string().describe('Absolute path where the filled image will be written'),
      left: z.number().int().min(0).describe('Left offset of the fill region'),
      top: z.number().int().min(0).describe('Top offset of the fill region'),
      width: z.number().int().min(1).describe('Width of the fill region'),
      height: z.number().int().min(1).describe('Height of the fill region'),
      color: z
        .string()
        .default('#000000')
        .describe('Fill color (CSS color string, may include alpha e.g. #00000080)'),
    },
    async ({ input_path, output_path, left, top, width, height, color }) => {
      assertAbsolute(input_path, 'input_path');
      assertAbsolute(output_path, 'output_path');
      const result = await runSharp('fill', async () => {
        const overlay = await sharp({
          create: {
            width,
            height,
            channels: 4,
            background: color,
          },
        })
          .png()
          .toBuffer();
        await sharp(input_path)
          .composite([{ input: overlay, left, top }])
          .toFile(output_path);
        return { input_path, output_path, left, top, width, height, color };
      });
      return result.ok
        ? textResult({ success: true, operation: 'fill', ...result.data })
        : errorResult(result.error, result.code);
    },
  );
  registered++;

  // ---------- overlay ----------
  server.tool(
    'overlay',
    'Composite one image on top of another at the given position.',
    {
      input_path: z.string().describe('Absolute path to the base image'),
      overlay_path: z.string().describe('Absolute path to the overlay image'),
      output_path: z.string().describe('Absolute path where the composited image will be written'),
      left: z.number().int().default(0).describe('Left offset of the overlay'),
      top: z.number().int().default(0).describe('Top offset of the overlay'),
      blend: z
        .enum([
          'over',
          'multiply',
          'screen',
          'overlay',
          'darken',
          'lighten',
          'color-dodge',
          'color-burn',
          'hard-light',
          'soft-light',
          'difference',
          'exclusion',
        ])
        .default('over')
        .describe('Blend mode for compositing'),
    },
    async ({ input_path, overlay_path, output_path, left, top, blend }) => {
      assertAbsolute(input_path, 'input_path');
      assertAbsolute(overlay_path, 'overlay_path');
      assertAbsolute(output_path, 'output_path');
      const result = await runSharp('overlay', async () => {
        await sharp(input_path)
          .composite([{ input: overlay_path, left, top, blend }])
          .toFile(output_path);
        return { input_path, overlay_path, output_path, left, top, blend };
      });
      return result.ok
        ? textResult({ success: true, operation: 'overlay', ...result.data })
        : errorResult(result.error, result.code);
    },
  );
  registered++;

  // ---------- get_metainfo ----------
  server.tool(
    'get_metainfo',
    'Read image metadata (format, width, height, channels, color space, EXIF).',
    {
      input_path: z.string().describe('Absolute path to the input image'),
    },
    async ({ input_path }) => {
      assertAbsolute(input_path, 'input_path');
      const result = await runSharp('get_metainfo', async () => {
        const metadata = await sharp(input_path).metadata();
        return { input_path, metadata };
      });
      return result.ok
        ? textResult({ success: true, operation: 'get_metainfo', ...result.data })
        : errorResult(result.error, result.code);
    },
  );
  registered++;

  // ---------- Removed ML-heavy tools: explicit not_implemented stubs ----------
  const removedTools: Array<[string, string]> = [
    ['detect', 'YOLO object detection (removed with imagesorcery-mcp cleanup)'],
    ['find', 'CLIP text-to-region search (removed with imagesorcery-mcp cleanup)'],
    ['ocr', 'EasyOCR text extraction (removed with imagesorcery-mcp cleanup)'],
    ['draw_arrows', 'OpenCV arrow drawing (removed with imagesorcery-mcp cleanup)'],
    ['draw_circles', 'OpenCV circle drawing (removed with imagesorcery-mcp cleanup)'],
    ['draw_lines', 'OpenCV line drawing (removed with imagesorcery-mcp cleanup)'],
    ['draw_rectangles', 'OpenCV rectangle drawing (removed with imagesorcery-mcp cleanup)'],
    ['draw_texts', 'OpenCV text drawing (removed with imagesorcery-mcp cleanup)'],
  ];

  for (const [toolName, shortDesc] of removedTools) {
    server.tool(
      toolName,
      `[REMOVED] ${shortDesc}. Returns an explanatory error.`,
      {
        _removed: z.unknown().optional().describe('Any args are ignored; this tool always errors.'),
      },
      async () => errorResult(`${REMOVED_MESSAGE} (tool: ${toolName})`, 'NOT_IMPLEMENTED'),
    );
    registered++;
  }

  log.info(
    MCP_NAME,
    SERVICE,
    'startup',
    `Registered ${registered} image tools (8 native via sharp, ${removedTools.length} removed stubs)`,
  );
  return registered;
}
