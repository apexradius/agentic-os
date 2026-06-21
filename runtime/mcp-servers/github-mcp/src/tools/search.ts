/**
 * Search operations — code, issues/PRs, users.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { githubRequest, buildUrl } from '../github-client.js';

// ---------------------------------------------------------------------------
// Tool input schemas
// ---------------------------------------------------------------------------

const SearchCodeInput = {
  q: z.string().describe('Search query'),
  order: z.enum(['asc', 'desc']).optional().describe('Sort order'),
  page: z.number().min(1).optional().describe('Page number'),
  per_page: z.number().min(1).max(100).optional().describe('Results per page (max 100)'),
};

const SearchIssuesInput = {
  q: z.string().describe('Search query'),
  order: z.enum(['asc', 'desc']).optional().describe('Sort order'),
  page: z.number().min(1).optional().describe('Page number'),
  per_page: z.number().min(1).max(100).optional().describe('Results per page (max 100)'),
  sort: z
    .enum([
      'comments',
      'reactions',
      'reactions-+1',
      'reactions--1',
      'reactions-smile',
      'reactions-thinking_face',
      'reactions-heart',
      'reactions-tada',
      'interactions',
      'created',
      'updated',
    ])
    .optional()
    .describe('Sort field'),
};

const SearchUsersInput = {
  q: z.string().describe('Search query'),
  order: z.enum(['asc', 'desc']).optional().describe('Sort order'),
  page: z.number().min(1).optional().describe('Page number'),
  per_page: z.number().min(1).max(100).optional().describe('Results per page (max 100)'),
  sort: z.enum(['followers', 'repositories', 'joined']).optional().describe('Sort field'),
};

// ---------------------------------------------------------------------------
// Register tools
// ---------------------------------------------------------------------------

export function registerSearchTools(server: McpServer): void {
  server.tool(
    'search_code',
    'Search for code across GitHub repositories',
    SearchCodeInput,
    async (params) => {
      const queryParams: Record<string, string | undefined> = {
        q: params.q,
        order: params.order,
        page: params.page?.toString(),
        per_page: params.per_page?.toString(),
      };
      const result = await githubRequest(buildUrl('https://api.github.com/search/code', queryParams));
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'search_issues',
    'Search for issues and pull requests across GitHub repositories',
    SearchIssuesInput,
    async (params) => {
      const queryParams: Record<string, string | undefined> = {
        q: params.q,
        order: params.order,
        page: params.page?.toString(),
        per_page: params.per_page?.toString(),
        sort: params.sort,
      };
      const result = await githubRequest(buildUrl('https://api.github.com/search/issues', queryParams));
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'search_users',
    'Search for users on GitHub',
    SearchUsersInput,
    async (params) => {
      const queryParams: Record<string, string | undefined> = {
        q: params.q,
        order: params.order,
        page: params.page?.toString(),
        per_page: params.per_page?.toString(),
        sort: params.sort,
      };
      const result = await githubRequest(buildUrl('https://api.github.com/search/users', queryParams));
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
