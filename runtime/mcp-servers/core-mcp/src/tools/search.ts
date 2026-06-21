import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { log } from '@framework/mcp-shared';
import { Exa } from 'exa-js';

export function isExaAvailable(): boolean {
  return !!process.env.EXA_API_KEY;
}

export function registerSearchTools(server: McpServer): void {
  if (!isExaAvailable()) return;

  // The Exa client takes the API key from process.env.EXA_API_KEY if not explicitly provided,
  // but it's safe to pass it directly.
  const exa = new Exa(process.env.EXA_API_KEY as string);
  const SERVICE = 'exa';

  server.tool(
    'exa_search',
    'Semantic search with neural or keyword mode using Exa',
    {
      query: z.string().describe('The search query'),
      numResults: z.number().optional().describe('Number of results to return (default: 10)'),
      useAutoprompt: z.boolean().optional().describe('Use Exa autoprompt to optimize the query'),
      type: z.enum(['neural', 'keyword']).optional().describe('Search type (default: neural)'),
    },
    async ({ query, numResults = 10, useAutoprompt, type }) => {
      try {
        const result = await exa.search(query, { numResults, useAutoprompt, type });
        return {
          content: [{ type: 'text', text: JSON.stringify(result.results, null, 2) }],
        };
      } catch (error) {
        log.error('apex-core-mcp', SERVICE, 'exa_search', String(error));
        return {
          content: [{ type: 'text', text: `Error: ${String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'exa_find_similar',
    'Find pages similar to a given URL using Exa',
    {
      url: z.string().describe('The URL to find similar pages for'),
      numResults: z.number().optional().describe('Number of results to return (default: 10)'),
    },
    async ({ url, numResults = 10 }) => {
      try {
        const result = await exa.findSimilar(url, { numResults });
        return {
          content: [{ type: 'text', text: JSON.stringify(result.results, null, 2) }],
        };
      } catch (error) {
        log.error('apex-core-mcp', SERVICE, 'exa_find_similar', String(error));
        return {
          content: [{ type: 'text', text: `Error: ${String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'exa_get_contents',
    'Get clean text or markdown content from specific URLs using Exa',
    {
      urls: z.array(z.string()).describe('Array of URLs to retrieve contents for'),
      text: z.boolean().optional().describe('Return plain text (default: true)'),
    },
    async ({ urls, text = true }) => {
      try {
        const result = await exa.getContents(urls, { text: text ? true : undefined });
        return {
          content: [{ type: 'text', text: JSON.stringify(result.results, null, 2) }],
        };
      } catch (error) {
        log.error('apex-core-mcp', SERVICE, 'exa_get_contents', String(error));
        return {
          content: [{ type: 'text', text: `Error: ${String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'exa_search_and_contents',
    'Combined semantic search and content extraction using Exa',
    {
      query: z.string().describe('The search query'),
      numResults: z.number().optional().describe('Number of results to return (default: 5)'),
      useAutoprompt: z.boolean().optional().describe('Use Exa autoprompt to optimize the query'),
      type: z.enum(['neural', 'keyword']).optional().describe('Search type (default: neural)'),
      text: z.boolean().optional().describe('Return plain text contents (default: true)'),
    },
    async ({ query, numResults = 5, useAutoprompt, type, text = true }) => {
      try {
        const result = await exa.searchAndContents(query, { numResults, useAutoprompt, type, text: text ? true : undefined });
        return {
          content: [{ type: 'text', text: JSON.stringify(result.results, null, 2) }],
        };
      } catch (error) {
        log.error('apex-core-mcp', SERVICE, 'exa_search_and_contents', String(error));
        return {
          content: [{ type: 'text', text: `Error: ${String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'exa_highlights',
    'Semantic search returning specific highlighted passages using Exa',
    {
      query: z.string().describe('The search query'),
      numResults: z.number().optional().describe('Number of results to return (default: 5)'),
      numSentences: z.number().optional().describe('Number of sentences per highlight (default: 3)'),
      highlightsPerUrl: z.number().optional().describe('Number of highlights per URL (default: 3)'),
    },
    async ({ query, numResults = 5, numSentences = 3, highlightsPerUrl = 3 }) => {
      try {
        const result = await exa.searchAndContents(query, {
          numResults,
          highlights: { numSentences, highlightsPerUrl }
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result.results, null, 2) }],
        };
      } catch (error) {
        log.error('apex-core-mcp', SERVICE, 'exa_highlights', String(error));
        return {
          content: [{ type: 'text', text: `Error: ${String(error)}` }],
          isError: true,
        };
      }
    }
  );
}
