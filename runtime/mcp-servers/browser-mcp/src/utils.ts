import { z } from "zod";
import { statSync } from "node:fs";

export const DEFAULT_TAB_ID = "default";
export const DEFAULT_USER_DATA_DIR = "~/.apex-browser-data";
export const DEFAULT_VIEWPORT = { width: 1280, height: 720 };
export const DEFAULT_TIMEOUT = 15_000;
export const DEFAULT_NAV_TIMEOUT = 120_000;

export type StealthProfile = "camoufox";

export interface ViewportSize {
  width: number;
  height: number;
}

export interface CliOptions {
  userDataDir: string;
  headless: boolean;
  viewport: ViewportSize;
  timeout: number;
  navTimeout: number;
  attach?: string;
  ytdlpPath: string;
  downloadDir: string;
  proxyUrl?: string;
  captchaKey?: string;
}

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

export interface ToolResult {
  [key: string]: unknown;
  content: Array<TextContent | ImageContent>;
  isError?: boolean;
}

export const tabIdSchema = z.string().trim().min(1).optional().default(DEFAULT_TAB_ID);

export function expandHomeDir(input: string): string {
  if (!input.startsWith("~")) {
    return input;
  }

  const home = process.env.HOME;
  if (!home) {
    return input;
  }

  if (input === "~") {
    return home;
  }

  if (input.startsWith("~/")) {
    return `${home}/${input.slice(2)}`;
  }

  return input;
}

export function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

export function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseViewport(value: string | undefined, fallback: ViewportSize): ViewportSize {
  if (!value) {
    return fallback;
  }

  const match = value.trim().match(/^(\d+)x(\d+)$/i);
  if (!match) {
    return fallback;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return fallback;
  }

  return { width, height };
}

export function parseCliArgs(argv: string[]): CliOptions {
  let userDataDir = expandHomeDir(process.env.APEX_BROWSER_USER_DATA_DIR ?? DEFAULT_USER_DATA_DIR);
  let headless = parseBoolean(process.env.APEX_BROWSER_HEADLESS, false);
  let viewport = parseViewport(process.env.APEX_BROWSER_VIEWPORT, DEFAULT_VIEWPORT);
  let timeout = parseNumber(process.env.APEX_BROWSER_TIMEOUT, DEFAULT_TIMEOUT);
  let navTimeout = parseNumber(process.env.APEX_BROWSER_NAV_TIMEOUT, DEFAULT_NAV_TIMEOUT);
  let attach = process.env.APEX_BROWSER_ATTACH;
  let ytdlpPath = process.env.APEX_YTDLP_PATH ?? "yt-dlp";
  let downloadDir = expandHomeDir(process.env.APEX_DOWNLOAD_DIR ?? "~/Downloads/apex-media");
  let proxyUrl = process.env.APEX_PROXY_URL;
  let captchaKey = process.env.APEX_2CAPTCHA_KEY;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    switch (token) {
      case "--proxy":
        if (next) {
          proxyUrl = next;
          index += 1;
        }
        break;
      case "--captcha-key":
        if (next) {
          captchaKey = next;
          index += 1;
        }
        break;
      case "--user-data-dir":
        if (next) {
          userDataDir = expandHomeDir(next);
          index += 1;
        }
        break;
      case "--headless":
        headless = true;
        break;
      case "--viewport":
        if (next) {
          viewport = parseViewport(next, viewport);
          index += 1;
        }
        break;
      case "--timeout":
        if (next) {
          timeout = parseNumber(next, timeout);
          index += 1;
        }
        break;
      case "--nav-timeout":
        if (next) {
          navTimeout = parseNumber(next, navTimeout);
          index += 1;
        }
        break;
      case "--attach":
        if (next) {
          attach = next;
          index += 1;
        }
        break;
      case "--ytdlp-path":
        if (next) {
          ytdlpPath = next;
          index += 1;
        }
        break;
      case "--download-dir":
        if (next) {
          downloadDir = expandHomeDir(next);
          index += 1;
        }
        break;
      default:
        break;
    }
  }

  return {
    userDataDir,
    headless,
    viewport,
    timeout,
    navTimeout,
    attach,
    ytdlpPath,
    downloadDir,
    proxyUrl,
    captchaKey,
  };
}

export function normalizeAttachEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim();
  if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (/^localhost:\d+$/.test(trimmed) || /^\d+\.\d+\.\d+\.\d+:\d+$/.test(trimmed)) {
    return `http://${trimmed}`;
  }

  throw new Error(`Unsupported attach endpoint: ${endpoint}`);
}

export function textResult(text: string): ToolResult {
  return {
    content: [{ type: "text", text }]
  };
}

export function multiContentResult(content: Array<TextContent | ImageContent>): ToolResult {
  return {
    content
  };
}

export function errorResult(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: message }],
    isError: true
  };
}

export function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function formatUrl(url: string | undefined): string {
  return url && url.length > 0 ? url : "about:blank";
}

export function compilePatterns(patterns: string[]): RegExp[] {
  return patterns.map(pattern => {
    try {
      return new RegExp(pattern);
    } catch {
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*");
      return new RegExp(escaped);
    }
  });
}

export function requireValue<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }

  return value;
}

export function summarizeList(values: string[]): string {
  if (values.length === 0) {
    return "[]";
  }

  return values.join(", ");
}

/** Gemini-optimized multimodal result */
export function multimodalResult(text: string, base64Image: string, metadata: unknown): ToolResult {
  return {
    content: [
      { type: "text", text },
      { type: "image", data: base64Image, mimeType: "image/png" },
      { type: "text", text: "\n<metadata>\n" + JSON.stringify(metadata, null, 2) + "\n</metadata>" }
    ]
  };
}

export function sleep(min: number, max: number): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1) + min);
  return new Promise(resolve => setTimeout(resolve, ms));
}
