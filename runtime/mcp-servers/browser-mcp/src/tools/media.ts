import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { YtdlpClient } from "@framework/mcp-shared";
import { errorResult, textResult } from "../utils.js";

export function registerMediaTools(server: McpServer, ytdlp: YtdlpClient): void {
  server.tool(
    "media_info",
    "Get metadata for a YouTube, Instagram, TikTok, or Facebook video without downloading.",
    { url: z.string().min(1).describe("Video or post URL") },
    async ({ url }) => {
      try { return textResult(await ytdlp.getInfo(url)); }
      catch (e) { return errorResult(e); }
    }
  );

  server.tool(
    "media_formats",
    "List all available video/audio quality options for a URL before downloading.",
    { url: z.string().min(1).describe("Video URL") },
    async ({ url }) => {
      try { return textResult(await ytdlp.listFormats(url)); }
      catch (e) { return errorResult(e); }
    }
  );

  server.tool(
    "media_download",
    "Download a video or audio from YouTube, Instagram, TikTok, Facebook, or Twitter/X.",
    {
      url: z.string().min(1).describe("Video or reel URL"),
      format: z.string().optional().describe("yt-dlp format string e.g. 'bestvideo+bestaudio/best', '720p'. Default: best quality MP4."),
      audio_only: z.boolean().optional().describe("Extract audio only as MP3 (default false)"),
    },
    async ({ url, format, audio_only = false }) => {
      try { return textResult(await ytdlp.download(url, format ?? "bestvideo+bestaudio/best", audio_only)); }
      catch (e) { return errorResult(e); }
    }
  );

  server.tool(
    "media_search",
    "Search YouTube or TikTok for videos. Returns titles, uploaders, durations, and URLs.",
    {
      query: z.string().min(1).describe("Search query"),
      platform: z.enum(["youtube", "tiktok"]).optional().describe("Platform to search (default: youtube)"),
      limit: z.number().int().min(1).max(20).optional().describe("Number of results (default 5)"),
    },
    async ({ query, platform = "youtube", limit = 5 }) => {
      try { return textResult(await ytdlp.search(query, platform, limit)); }
      catch (e) { return errorResult(e); }
    }
  );

  server.tool(
    "media_transcript",
    "Get the auto-generated captions/transcript from a YouTube video.",
    {
      url: z.string().min(1).describe("YouTube video URL"),
      lang: z.string().optional().describe("Subtitle language code (default: en)"),
    },
    async ({ url, lang = "en" }) => {
      try { return textResult(await ytdlp.getTranscript(url, lang)); }
      catch (e) { return errorResult(e); }
    }
  );
}
