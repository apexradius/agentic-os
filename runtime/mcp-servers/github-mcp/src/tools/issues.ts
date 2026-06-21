/**
 * Issue operations — create, get, list, update, comment.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { githubRequest, buildUrl, NotFoundError } from '../github-client.js';

// ---------------------------------------------------------------------------
// Tool input schemas
// ---------------------------------------------------------------------------

const CreateIssueInput = {
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  title: z.string().describe('Issue title'),
  body: z.string().optional().describe('Issue body'),
  assignees: z.array(z.string()).optional().describe('Usernames to assign'),
  milestone: z.number().optional().describe('Milestone number'),
  labels: z.array(z.string()).optional().describe('Labels to add'),
};

const GetIssueInput = {
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  issue_number: z.number().describe('Issue number'),
};

const ListIssuesInput = {
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  direction: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
  labels: z.array(z.string()).optional().describe('Filter by labels'),
  page: z.number().optional().describe('Page number'),
  per_page: z.number().optional().describe('Results per page'),
  since: z.string().optional().describe('Only issues updated at or after this time (ISO 8601)'),
  sort: z.enum(['created', 'updated', 'comments']).optional().describe('What to sort by'),
  state: z.enum(['open', 'closed', 'all']).optional().describe('State filter'),
};

const UpdateIssueInput = {
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  issue_number: z.number().describe('Issue number'),
  title: z.string().optional().describe('Updated title'),
  body: z.string().optional().describe('Updated body'),
  assignees: z.array(z.string()).optional().describe('Updated assignees'),
  milestone: z.number().optional().describe('Updated milestone number'),
  labels: z.array(z.string()).optional().describe('Updated labels'),
  state: z.enum(['open', 'closed']).optional().describe('State to set'),
};

const AddCommentInput = {
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  issue_number: z.number().describe('Issue number'),
  body: z.string().describe('Comment text'),
};

// ---------------------------------------------------------------------------
// Register tools
// ---------------------------------------------------------------------------

export function registerIssueTools(server: McpServer): void {
  server.tool(
    'create_issue',
    'Create a new issue in a GitHub repository',
    CreateIssueInput,
    async ({ owner, repo, ...options }) => {
      try {
        const result = await githubRequest(
          `https://api.github.com/repos/${owner}/${repo}/issues`,
          { method: 'POST', body: options },
        );
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        if (err instanceof NotFoundError) {
          throw new Error(
            `Repository '${owner}/${repo}' not found. Please verify:\n` +
            `1. The repository exists\n` +
            `2. You have correct access permissions\n` +
            `3. The owner and repository names are spelled correctly`,
          );
        }
        throw err;
      }
    },
  );

  server.tool(
    'get_issue',
    'Get details of a specific issue in a GitHub repository.',
    GetIssueInput,
    async ({ owner, repo, issue_number }) => {
      const result = await githubRequest(
        `https://api.github.com/repos/${owner}/${repo}/issues/${issue_number}`,
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'list_issues',
    'List issues in a GitHub repository with filtering options',
    ListIssuesInput,
    async ({ owner, repo, direction, labels, page, per_page, since, sort, state }) => {
      const params: Record<string, string | undefined> = {
        direction,
        labels: labels?.join(','),
        page: page?.toString(),
        per_page: per_page?.toString(),
        since,
        sort,
        state,
      };
      const result = await githubRequest(
        buildUrl(`https://api.github.com/repos/${owner}/${repo}/issues`, params),
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'update_issue',
    'Update an existing issue in a GitHub repository',
    UpdateIssueInput,
    async ({ owner, repo, issue_number, ...options }) => {
      const result = await githubRequest(
        `https://api.github.com/repos/${owner}/${repo}/issues/${issue_number}`,
        { method: 'PATCH', body: options },
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'add_issue_comment',
    'Add a comment to an existing issue',
    AddCommentInput,
    async ({ owner, repo, issue_number, body }) => {
      const result = await githubRequest(
        `https://api.github.com/repos/${owner}/${repo}/issues/${issue_number}/comments`,
        { method: 'POST', body: { body } },
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
