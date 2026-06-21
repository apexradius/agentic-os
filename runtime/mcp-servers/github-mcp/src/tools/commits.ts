/**
 * Commit operations — list commits for a branch.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { githubRequest, buildUrl } from '../github-client.js';

// ---------------------------------------------------------------------------
// Tool input schema
// ---------------------------------------------------------------------------

const ListCommitsInput = {
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  sha: z.string().optional().describe('SHA or branch to list commits from'),
  page: z.number().optional().describe('Page number'),
  perPage: z.number().optional().describe('Results per page'),
};

// ---------------------------------------------------------------------------
// Register tools
// ---------------------------------------------------------------------------

export function registerCommitTools(server: McpServer): void {
  server.tool(
    'list_commits',
    'Get list of commits of a branch in a GitHub repository',
    ListCommitsInput,
    async ({ owner, repo, sha, page, perPage }) => {
      const params: Record<string, string | undefined> = {
        sha,
        page: page?.toString(),
        per_page: perPage?.toString(),
      };
      const result = await githubRequest(
        buildUrl(`https://api.github.com/repos/${owner}/${repo}/commits`, params),
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
