/**
 * Pull request operations — create, get, list, review, merge, files, status, comments.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { githubRequest } from '../github-client.js';

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

const AssigneeSchema = z.object({
  login: z.string(),
  id: z.number(),
  avatar_url: z.string(),
  url: z.string(),
  html_url: z.string(),
});

const LabelSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  url: z.string(),
  name: z.string(),
  color: z.string(),
  default: z.boolean(),
  description: z.string().nullable().optional(),
});

const OwnerSchema = z.object({
  login: z.string(),
  id: z.number(),
  node_id: z.string(),
  avatar_url: z.string(),
  url: z.string(),
  html_url: z.string(),
  type: z.string(),
});

const RepoSchema = z.object({
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

const PullRequestRefSchema = z.object({
  label: z.string(),
  ref: z.string(),
  sha: z.string(),
  user: AssigneeSchema,
  repo: RepoSchema,
});

const PullRequestSchema = z.object({
  url: z.string(),
  id: z.number(),
  node_id: z.string(),
  html_url: z.string(),
  diff_url: z.string(),
  patch_url: z.string(),
  issue_url: z.string(),
  number: z.number(),
  state: z.string(),
  locked: z.boolean(),
  title: z.string(),
  user: AssigneeSchema,
  body: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  merged_at: z.string().nullable(),
  merge_commit_sha: z.string().nullable(),
  assignee: AssigneeSchema.nullable(),
  assignees: z.array(AssigneeSchema),
  requested_reviewers: z.array(AssigneeSchema),
  labels: z.array(LabelSchema),
  head: PullRequestRefSchema,
  base: PullRequestRefSchema,
});

const PullRequestFileSchema = z.object({
  sha: z.string(),
  filename: z.string(),
  status: z.enum(['added', 'removed', 'modified', 'renamed', 'copied', 'changed', 'unchanged']),
  additions: z.number(),
  deletions: z.number(),
  changes: z.number(),
  blob_url: z.string(),
  raw_url: z.string(),
  contents_url: z.string(),
  patch: z.string().optional(),
});

const StatusCheckSchema = z.object({
  url: z.string(),
  state: z.enum(['error', 'failure', 'pending', 'success']),
  description: z.string().nullable(),
  target_url: z.string().nullable(),
  context: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const CombinedStatusSchema = z.object({
  state: z.enum(['error', 'failure', 'pending', 'success']),
  statuses: z.array(StatusCheckSchema),
  sha: z.string(),
  total_count: z.number(),
});

const ReviewCommentSchema = z.object({
  url: z.string(),
  id: z.number(),
  node_id: z.string(),
  pull_request_review_id: z.number().nullable(),
  diff_hunk: z.string(),
  path: z.string().nullable(),
  position: z.number().nullable(),
  original_position: z.number().nullable(),
  commit_id: z.string(),
  original_commit_id: z.string(),
  user: AssigneeSchema,
  body: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  html_url: z.string(),
  pull_request_url: z.string(),
  author_association: z.string(),
  _links: z.object({
    self: z.object({ href: z.string() }),
    html: z.object({ href: z.string() }),
    pull_request: z.object({ href: z.string() }),
  }),
});

const ReviewSchema = z.object({
  id: z.number(),
  node_id: z.string(),
  user: AssigneeSchema,
  body: z.string().nullable(),
  state: z.enum(['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED', 'PENDING']),
  html_url: z.string(),
  pull_request_url: z.string(),
  commit_id: z.string(),
  submitted_at: z.string().nullable(),
  author_association: z.string(),
});

// ---------------------------------------------------------------------------
// Tool input schemas
// ---------------------------------------------------------------------------

const CreatePRInput = {
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  title: z.string().describe('Pull request title'),
  body: z.string().optional().describe('Pull request body/description'),
  head: z.string().describe('The name of the branch where your changes are implemented'),
  base: z.string().describe('The name of the branch you want the changes pulled into'),
  draft: z.boolean().optional().describe('Whether to create the pull request as a draft'),
  maintainer_can_modify: z.boolean().optional().describe('Whether maintainers can modify the pull request'),
};

const GetPRInput = {
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  pull_number: z.number().describe('Pull request number'),
};

const ListPRsInput = {
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  state: z.enum(['open', 'closed', 'all']).optional().describe('State of the pull requests to return'),
  head: z.string().optional().describe('Filter by head user or head organization and branch name'),
  base: z.string().optional().describe('Filter by base branch name'),
  sort: z.enum(['created', 'updated', 'popularity', 'long-running']).optional().describe('What to sort results by'),
  direction: z.enum(['asc', 'desc']).optional().describe('The direction of the sort'),
  per_page: z.number().optional().describe('Results per page (max 100)'),
  page: z.number().optional().describe('Page number of the results'),
};

const CreateReviewInput = {
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  pull_number: z.number().describe('Pull request number'),
  commit_id: z.string().optional().describe('The SHA of the commit that needs a review'),
  body: z.string().describe('The body text of the review'),
  event: z.enum(['APPROVE', 'REQUEST_CHANGES', 'COMMENT']).describe('The review action to perform'),
  comments: z
    .array(
      z.union([
        z.object({
          path: z.string().describe('The relative path to the file being commented on'),
          position: z.number().describe('The position in the diff where you want to add a review comment'),
          body: z.string().describe('Text of the review comment'),
        }),
        z.object({
          path: z.string().describe('The relative path to the file being commented on'),
          line: z.number().describe('The line number in the file where you want to add a review comment'),
          body: z.string().describe('Text of the review comment'),
        }),
      ]),
    )
    .optional()
    .describe('Comments to post as part of the review (specify either position or line, not both)'),
};

const MergePRInput = {
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  pull_number: z.number().describe('Pull request number'),
  commit_title: z.string().optional().describe('Title for the automatic commit message'),
  commit_message: z.string().optional().describe('Extra detail to append to automatic commit message'),
  merge_method: z.enum(['merge', 'squash', 'rebase']).optional().describe('Merge method to use'),
};

const PRFilesInput = {
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  pull_number: z.number().describe('Pull request number'),
  per_page: z.number().min(1).max(100).optional().describe('Results per page (max 100, default 100)'),
  page: z.number().min(1).optional().describe('Page number of the results'),
};

const PRStatusInput = {
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  pull_number: z.number().describe('Pull request number'),
};

const UpdateBranchInput = {
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  pull_number: z.number().describe('Pull request number'),
  expected_head_sha: z.string().optional().describe("The expected SHA of the pull request's HEAD ref"),
};

const PRCommentsInput = {
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  pull_number: z.number().describe('Pull request number'),
  per_page: z.number().min(1).max(100).optional().describe('Results per page (max 100, default 100)'),
  page: z.number().min(1).optional().describe('Page number of the results'),
};

const PRReviewsInput = {
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  pull_number: z.number().describe('Pull request number'),
  per_page: z.number().min(1).max(100).optional().describe('Results per page (max 100, default 100)'),
  page: z.number().min(1).optional().describe('Page number of the results'),
};

// ---------------------------------------------------------------------------
// Register tools
// ---------------------------------------------------------------------------

export function registerPullTools(server: McpServer): void {
  server.tool(
    'create_pull_request',
    'Create a new pull request in a GitHub repository',
    CreatePRInput,
    async ({ owner, repo, ...options }) => {
      const result = await githubRequest(
        `https://api.github.com/repos/${owner}/${repo}/pulls`,
        { method: 'POST', body: options },
      );
      const parsed = PullRequestSchema.parse(result);
      return { content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }] };
    },
  );

  server.tool(
    'get_pull_request',
    'Get details of a specific pull request',
    GetPRInput,
    async ({ owner, repo, pull_number }) => {
      const result = await githubRequest(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}`,
      );
      const parsed = PullRequestSchema.parse(result);
      return { content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }] };
    },
  );

  server.tool(
    'list_pull_requests',
    'List and filter repository pull requests',
    ListPRsInput,
    async ({ owner, repo, state, head, base, sort, direction, per_page, page }) => {
      const url = new URL(`https://api.github.com/repos/${owner}/${repo}/pulls`);
      if (state) url.searchParams.append('state', state);
      if (head) url.searchParams.append('head', head);
      if (base) url.searchParams.append('base', base);
      if (sort) url.searchParams.append('sort', sort);
      if (direction) url.searchParams.append('direction', direction);
      if (per_page) url.searchParams.append('per_page', per_page.toString());
      if (page) url.searchParams.append('page', page.toString());
      const result = await githubRequest(url.toString());
      const parsed = z.array(PullRequestSchema).parse(result);
      return { content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }] };
    },
  );

  server.tool(
    'create_pull_request_review',
    'Create a review on a pull request',
    CreateReviewInput,
    async ({ owner, repo, pull_number, ...options }) => {
      const result = await githubRequest(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}/reviews`,
        { method: 'POST', body: options },
      );
      const parsed = ReviewSchema.parse(result);
      return { content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }] };
    },
  );

  server.tool(
    'merge_pull_request',
    'Merge a pull request',
    MergePRInput,
    async ({ owner, repo, pull_number, ...options }) => {
      const result = await githubRequest(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}/merge`,
        { method: 'PUT', body: options },
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'get_pull_request_files',
    'Get the list of files changed in a pull request',
    PRFilesInput,
    async ({ owner, repo, pull_number, per_page, page }) => {
      const url = new URL(`https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}/files`);
      url.searchParams.append('per_page', String(per_page ?? 100));
      if (page) url.searchParams.append('page', String(page));
      const result = await githubRequest(url.toString());
      const parsed = z.array(PullRequestFileSchema).parse(result);
      return { content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }] };
    },
  );

  server.tool(
    'get_pull_request_status',
    'Get the combined status of all status checks for a pull request',
    PRStatusInput,
    async ({ owner, repo, pull_number }) => {
      // Get the PR to find the head SHA, then fetch combined status for that SHA
      const pr = await githubRequest<{ head: { sha: string } }>(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}`,
      );
      const result = await githubRequest(
        `https://api.github.com/repos/${owner}/${repo}/commits/${pr.head.sha}/status`,
      );
      const parsed = CombinedStatusSchema.parse(result);
      return { content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }] };
    },
  );

  server.tool(
    'update_pull_request_branch',
    'Update a pull request branch with the latest changes from the base branch',
    UpdateBranchInput,
    async ({ owner, repo, pull_number, expected_head_sha }) => {
      await githubRequest(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}/update-branch`,
        {
          method: 'PUT',
          body: expected_head_sha ? { expected_head_sha } : undefined,
        },
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true }, null, 2) }] };
    },
  );

  server.tool(
    'get_pull_request_comments',
    'Get the review comments on a pull request',
    PRCommentsInput,
    async ({ owner, repo, pull_number, per_page, page }) => {
      const url = new URL(`https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}/comments`);
      url.searchParams.append('per_page', String(per_page ?? 100));
      if (page) url.searchParams.append('page', String(page));
      const result = await githubRequest(url.toString());
      const parsed = z.array(ReviewCommentSchema).parse(result);
      return { content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }] };
    },
  );

  server.tool(
    'get_pull_request_reviews',
    'Get the reviews on a pull request',
    PRReviewsInput,
    async ({ owner, repo, pull_number, per_page, page }) => {
      const url = new URL(`https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}/reviews`);
      url.searchParams.append('per_page', String(per_page ?? 100));
      if (page) url.searchParams.append('page', String(page));
      const result = await githubRequest(url.toString());
      const parsed = z.array(ReviewSchema).parse(result);
      return { content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }] };
    },
  );
}
