#!/usr/bin/env node
/**
 * apex-github-mcp — GitHub API MCP server
 *
 * Provides 26 tools for GitHub operations:
 *   - Repository: create, search, fork
 *   - Issues: create, get, list, update, comment
 *   - Pull Requests: create, get, list, review, merge, files, status, update-branch, comments, reviews
 *   - Files: get contents, create/update, push multiple
 *   - Branches: create
 *   - Search: code, issues, users
 *   - Commits: list
 *   + system_health
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  UnifiedErrorHandler,
  registerHealthTool,
  log,
  EXIT_CODES,
} from '@framework/mcp-shared';

import { registerRepoTools } from './tools/repos.js';
import { registerIssueTools } from './tools/issues.js';
import { registerPullTools } from './tools/pulls.js';
import { registerFileTools } from './tools/files.js';
import { registerBranchTools } from './tools/branches.js';
import { registerSearchTools } from './tools/search.js';
import { registerCommitTools } from './tools/commits.js';
import { githubRequest, hasGitHubAuthCandidate } from './github-client.js';

const MCP_NAME = 'apex-github-mcp';
const MCP_VERSION = '1.0.0';

async function main(): Promise<void> {
  // Validate token presence early
  const hasAuth = hasGitHubAuthCandidate();
  if (!hasAuth) {
    log.warn(MCP_NAME, 'github', 'startup', 'No GitHub token found in GITHUB_TOKEN, GH_TOKEN, GITHUB_PERSONAL_ACCESS_TOKEN, or gh auth');
  }

  const errorHandler = new UnifiedErrorHandler({
    mcpName: MCP_NAME,
    retryOverrides: {
      github: { maxRetries: 2, initialDelayMs: 500 },
    },
  });

  const server = new McpServer({ name: MCP_NAME, version: MCP_VERSION });

  // Register all tool groups
  registerRepoTools(server);       // 3 tools
  registerIssueTools(server);      // 5 tools
  registerPullTools(server);       // 10 tools
  registerFileTools(server);       // 3 tools
  registerBranchTools(server);     // 1 tool
  registerSearchTools(server);     // 3 tools
  registerCommitTools(server);     // 1 tool

  const totalTools = 26;

  // Health check
  registerHealthTool(server, {
    mcpName: MCP_NAME,
    version: MCP_VERSION,
    errorHandler,
    checks: {
      github_api: async () => {
        try {
          await githubRequest('https://api.github.com/rate_limit');
          return null;
        } catch (err) {
          return err instanceof Error ? err.message : String(err);
        }
      },
    },
  });

  // Connect transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  log.ready(MCP_NAME, totalTools + 1, { github_api: hasAuth });

  // Graceful shutdown
  const shutdown = () => {
    log.info(MCP_NAME, 'system', 'shutdown', 'Shutting down');
    process.exit(EXIT_CODES.SUCCESS);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  log.error(MCP_NAME, 'system', 'fatal', error instanceof Error ? error.message : String(error));
  process.exit(EXIT_CODES.FATAL_CONFIG_ERROR);
});
