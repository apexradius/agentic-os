/**
 * File and content operations — get contents, create/update files, push multiple files.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { githubRequest } from '../github-client.js';

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

const AuthorSchema = z.object({
  name: z.string(),
  email: z.string(),
  date: z.string(),
});

const FileContentLinksSchema = z.object({
  self: z.string(),
  git: z.string().nullable(),
  html: z.string().nullable(),
});

const FileContentSchema = z.object({
  name: z.string(),
  path: z.string(),
  sha: z.string(),
  size: z.number(),
  url: z.string(),
  html_url: z.string(),
  git_url: z.string(),
  download_url: z.string(),
  type: z.string(),
  content: z.string().optional(),
  encoding: z.string().optional(),
  _links: FileContentLinksSchema,
});

const DirectoryEntrySchema = z.object({
  type: z.string(),
  size: z.number(),
  name: z.string(),
  path: z.string(),
  sha: z.string(),
  url: z.string(),
  git_url: z.string(),
  html_url: z.string(),
  download_url: z.string().nullable(),
});

const ContentSchema = z.union([FileContentSchema, z.array(DirectoryEntrySchema)]);

const TreeEntrySchema = z.object({
  path: z.string(),
  mode: z.enum(['100644', '100755', '040000', '160000', '120000']),
  type: z.enum(['blob', 'tree', 'commit']),
  size: z.number().optional(),
  sha: z.string(),
  url: z.string(),
});

const TreeSchema = z.object({
  sha: z.string(),
  url: z.string(),
  tree: z.array(TreeEntrySchema),
  truncated: z.boolean(),
});

const CommitSchema = z.object({
  sha: z.string(),
  node_id: z.string(),
  url: z.string(),
  author: AuthorSchema,
  committer: AuthorSchema,
  message: z.string(),
  tree: z.object({ sha: z.string(), url: z.string() }),
  parents: z.array(z.object({ sha: z.string(), url: z.string() })),
});

const ReferenceSchema = z.object({
  ref: z.string(),
  node_id: z.string(),
  url: z.string(),
  object: z.object({ sha: z.string(), type: z.string(), url: z.string() }),
});

const CreateUpdateResponseSchema = z.object({
  content: FileContentSchema.nullable(),
  commit: z.object({
    sha: z.string(),
    node_id: z.string(),
    url: z.string(),
    html_url: z.string(),
    author: AuthorSchema,
    committer: AuthorSchema,
    message: z.string(),
    tree: z.object({ sha: z.string(), url: z.string() }),
    parents: z.array(z.object({ sha: z.string(), url: z.string(), html_url: z.string() })),
  }),
});

// ---------------------------------------------------------------------------
// Tool input schemas
// ---------------------------------------------------------------------------

const GetFileContentsInput = {
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  path: z.string().describe('Path to the file or directory'),
  branch: z.string().optional().describe('Branch to get contents from'),
};

const CreateOrUpdateFileInput = {
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  path: z.string().describe('Path where to create/update the file'),
  content: z.string().describe('Content of the file'),
  message: z.string().describe('Commit message'),
  branch: z.string().describe('Branch to create/update the file in'),
  sha: z.string().optional().describe('SHA of the file being replaced (required when updating existing files)'),
};

const PushFilesInput = {
  owner: z.string().describe('Repository owner (username or organization)'),
  repo: z.string().describe('Repository name'),
  branch: z.string().describe("Branch to push to (e.g., 'main' or 'master')"),
  files: z.array(z.object({ path: z.string(), content: z.string() })).describe('Array of files to push'),
  message: z.string().describe('Commit message'),
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function fetchContents(owner: string, repo: string, path: string, branch?: string) {
  let url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  if (branch) url += `?ref=${branch}`;
  const response = await githubRequest(url);
  const data = ContentSchema.parse(response);
  // Decode base64 file content
  if (!Array.isArray(data) && data.content) {
    data.content = Buffer.from(data.content, 'base64').toString('utf8');
  }
  return data;
}

async function createTree(owner: string, repo: string, files: Array<{ path: string; content: string }>, baseTree: string) {
  const tree = files.map((f) => ({
    path: f.path,
    mode: '100644' as const,
    type: 'blob' as const,
    content: f.content,
  }));
  const response = await githubRequest(
    `https://api.github.com/repos/${owner}/${repo}/git/trees`,
    { method: 'POST', body: { tree, base_tree: baseTree } },
  );
  return TreeSchema.parse(response);
}

async function createCommit(owner: string, repo: string, message: string, tree: string, parents: string[]) {
  const response = await githubRequest(
    `https://api.github.com/repos/${owner}/${repo}/git/commits`,
    { method: 'POST', body: { message, tree, parents } },
  );
  return CommitSchema.parse(response);
}

async function updateRef(owner: string, repo: string, ref: string, sha: string) {
  const response = await githubRequest(
    `https://api.github.com/repos/${owner}/${repo}/git/refs/${ref}`,
    { method: 'PATCH', body: { sha, force: true } },
  );
  return ReferenceSchema.parse(response);
}

// ---------------------------------------------------------------------------
// Register tools
// ---------------------------------------------------------------------------

export function registerFileTools(server: McpServer): void {
  server.tool(
    'get_file_contents',
    'Get the contents of a file or directory from a GitHub repository',
    GetFileContentsInput,
    async ({ owner, repo, path, branch }) => {
      const contents = await fetchContents(owner, repo, path, branch);
      return { content: [{ type: 'text' as const, text: JSON.stringify(contents, null, 2) }] };
    },
  );

  server.tool(
    'create_or_update_file',
    'Create or update a single file in a GitHub repository',
    CreateOrUpdateFileInput,
    async ({ owner, repo, path, content, message, branch, sha }) => {
      const encodedContent = Buffer.from(content).toString('base64');

      // If no SHA provided, try to get the existing file SHA
      let currentSha = sha;
      if (!currentSha) {
        try {
          const existing = await fetchContents(owner, repo, path, branch);
          if (!Array.isArray(existing)) {
            currentSha = existing.sha;
          }
        } catch {
          // File does not exist — will create new
        }
      }

      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      const body: Record<string, unknown> = { message, content: encodedContent, branch };
      if (currentSha) body.sha = currentSha;

      const response = await githubRequest(url, { method: 'PUT', body });
      const parsed = CreateUpdateResponseSchema.parse(response);
      return { content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }] };
    },
  );

  server.tool(
    'push_files',
    'Push multiple files to a GitHub repository in a single commit',
    PushFilesInput,
    async ({ owner, repo, branch, files, message }) => {
      // Get current HEAD ref
      const refResponse = await githubRequest(
        `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`,
      );
      const ref = ReferenceSchema.parse(refResponse);
      const commitSha = ref.object.sha;

      // Build tree, commit, update ref
      const tree = await createTree(owner, repo, files, commitSha);
      const commit = await createCommit(owner, repo, message, tree.sha, [commitSha]);
      const result = await updateRef(owner, repo, `heads/${branch}`, commit.sha);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
