/**
 * Repository operations — create, search, fork.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { githubRequest } from '../github-client.js';

// ---------------------------------------------------------------------------
// Response schemas (for runtime validation of GitHub responses)
// ---------------------------------------------------------------------------

const OwnerSchema = z.object({
  login: z.string(),
  id: z.number(),
  node_id: z.string(),
  avatar_url: z.string(),
  url: z.string(),
  html_url: z.string(),
  type: z.string(),
});

const RepositorySchema = z.object({
  id: z.number(),
  node_id: z.string(),
  name: z.string(),
  full_name: z.string(),
  private: z.boolean(),
  owner: OwnerSchema,
  html_url: z.string(),
  description: z.string().nullable(),
  fork: z.boolean(),
  url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  pushed_at: z.string(),
  git_url: z.string(),
  ssh_url: z.string(),
  clone_url: z.string(),
  default_branch: z.string(),
});

const SearchResponseSchema = z.object({
  total_count: z.number(),
  incomplete_results: z.boolean(),
  items: z.array(RepositorySchema),
});

// ---------------------------------------------------------------------------
// Tool input schemas
// ---------------------------------------------------------------------------

const CreateRepoInput = {
  name: z.string().describe('Repository name'),
  description: z.string().optional().describe('Repository description'),
  private: z.boolean().optional().describe('Whether the repository should be private'),
  autoInit: z.boolean().optional().describe('Initialize with README.md'),
};

const SearchReposInput = {
  query: z.string().describe('Search query (see GitHub search syntax)'),
  page: z.number().optional().describe('Page number for pagination (default: 1)'),
  perPage: z.number().optional().describe('Number of results per page (default: 30, max: 100)'),
};

const ForkRepoInput = {
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  organization: z.string().optional().describe('Optional: organization to fork to (defaults to your personal account)'),
};

// ---------------------------------------------------------------------------
// Register tools
// ---------------------------------------------------------------------------

export function registerRepoTools(server: McpServer): void {
  server.tool(
    'create_repository',
    'Create a new GitHub repository in your account',
    CreateRepoInput,
    async ({ name, description, private: isPrivate, autoInit }) => {
      const body: Record<string, unknown> = { name };
      if (description !== undefined) body.description = description;
      if (isPrivate !== undefined) body.private = isPrivate;
      if (autoInit !== undefined) body.auto_init = autoInit;
      const result = await githubRequest('https://api.github.com/user/repos', {
        method: 'POST',
        body,
      });
      const parsed = RepositorySchema.parse(result);
      return { content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }] };
    },
  );

  server.tool(
    'search_repositories',
    'Search for GitHub repositories',
    SearchReposInput,
    async ({ query, page = 1, perPage = 30 }) => {
      const url = new URL('https://api.github.com/search/repositories');
      url.searchParams.append('q', query);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('per_page', perPage.toString());
      const result = await githubRequest(url.toString());
      const parsed = SearchResponseSchema.parse(result);
      return { content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }] };
    },
  );

  server.tool(
    'fork_repository',
    'Fork a GitHub repository to your account or specified organization',
    ForkRepoInput,
    async ({ owner, repo, organization }) => {
      const url = organization
        ? `https://api.github.com/repos/${owner}/${repo}/forks?organization=${organization}`
        : `https://api.github.com/repos/${owner}/${repo}/forks`;
      const result = await githubRequest(url, { method: 'POST' });
      const parsed = RepositorySchema.extend({
        parent: RepositorySchema,
        source: RepositorySchema,
      }).parse(result);
      return { content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }] };
    },
  );
}
