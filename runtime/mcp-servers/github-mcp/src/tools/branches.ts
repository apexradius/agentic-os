/**
 * Branch operations — create branches from refs or default branch.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { githubRequest } from '../github-client.js';

// ---------------------------------------------------------------------------
// Response schema
// ---------------------------------------------------------------------------

const ReferenceSchema = z.object({
  ref: z.string(),
  node_id: z.string(),
  url: z.string(),
  object: z.object({ sha: z.string(), type: z.string(), url: z.string() }),
});

// ---------------------------------------------------------------------------
// Tool input schema
// ---------------------------------------------------------------------------

const CreateBranchInput = {
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  branch: z.string().describe('Name for the new branch'),
  from_branch: z.string().optional().describe("Optional: source branch to create from (defaults to the repository's default branch)"),
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getDefaultBranchSha(owner: string, repo: string): Promise<string> {
  try {
    const response = await githubRequest(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/main`,
    );
    return ReferenceSchema.parse(response).object.sha;
  } catch {
    // Fallback to master
    const response = await githubRequest(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/master`,
    );
    if (!response) throw new Error("Could not find default branch (tried 'main' and 'master')");
    return ReferenceSchema.parse(response).object.sha;
  }
}

async function getBranchSha(owner: string, repo: string, branch: string): Promise<string> {
  const response = await githubRequest(
    `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`,
  );
  return ReferenceSchema.parse(response).object.sha;
}

// ---------------------------------------------------------------------------
// Register tools
// ---------------------------------------------------------------------------

export function registerBranchTools(server: McpServer): void {
  server.tool(
    'create_branch',
    'Create a new branch in a GitHub repository',
    CreateBranchInput,
    async ({ owner, repo, branch, from_branch }) => {
      const sha = from_branch
        ? await getBranchSha(owner, repo, from_branch)
        : await getDefaultBranchSha(owner, repo);

      const response = await githubRequest(
        `https://api.github.com/repos/${owner}/${repo}/git/refs`,
        { method: 'POST', body: { ref: `refs/heads/${branch}`, sha } },
      );
      const parsed = ReferenceSchema.parse(response);
      return { content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }] };
    },
  );
}
