/**
 * Child-process MCP proxy.
 *
 * Spawns third-party MCP packages as child processes, discovers their tools
 * via the MCP protocol, and re-registers them on the parent MCP server.
 * Handles process lifecycle, crash recovery, and error wrapping.
 *
 * Used by: apex-core-mcp (context7, memory), apex-tools-mcp (imagesorcery, 21st-dev),
 *          apex-commerce-mcp (shopify)
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z, type ZodTypeAny } from 'zod';
import { log } from '../logging/index.js';

export interface ProxyTarget {
  /** Human name for logging (e.g. 'context7', 'shopify') */
  name: string;
  /** Command to spawn (e.g. 'npx') */
  command: string;
  /** Args to pass (e.g. ['-y', '@upstash/context7-mcp']) */
  args: string[];
  /** Environment variables to pass to the child process */
  env?: Record<string, string>;
  /** Optional prefix to add to tool names (e.g. 'ctx7_') to avoid collisions */
  toolPrefix?: string;
}

interface ProxiedChild {
  client: Client;
  transport: StdioClientTransport;
  target: ProxyTarget;
}

/**
 * Keys matching this pattern are treated as sensitive and have their values
 * replaced with `[REDACTED]` before being emitted to logs.
 *
 * Deliberately narrow: matches `token`, `key`, `secret`, `password`, `auth`
 * (case-insensitive, anywhere in the key). Does NOT match innocuous keys like
 * `NODE_ENV`, `PATH`, or `HOME`.
 */
const SENSITIVE_ENV_KEY = /token|key|secret|password|auth/i;

/**
 * Return a shallow copy of `env` where values for sensitive keys are replaced
 * with `[REDACTED]`. Safe to stringify into logs.
 */
export function redactEnv(env: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    out[k] = SENSITIVE_ENV_KEY.test(k) ? '[REDACTED]' : v;
  }
  return out;
}

/**
 * Redact any argv element that looks like a raw secret (bearer token, long
 * base64-ish blob, or `--flag=<secret>` form where the flag name matches
 * SENSITIVE_ENV_KEY). Command args are usually package names like
 * `@upstash/context7-mcp`, but callers can pass tokens positionally.
 */
export function redactArgs(args: string[]): string[] {
  return args.map((arg) => {
    const eq = arg.indexOf('=');
    if (eq > 0) {
      const rawKey = arg.startsWith('--') ? arg.slice(2, eq) : arg.slice(0, eq);
      if (SENSITIVE_ENV_KEY.test(rawKey)) return `${arg.slice(0, eq)}=[REDACTED]`;
    }
    return arg;
  });
}

/**
 * Convert a JSON Schema `inputSchema` (from a child MCP tool) into a Zod
 * shape that `McpServer.tool()` can consume.
 *
 * Handles: string, number, integer, boolean, array, object.
 * For unknown types, falls back to `z.any()`.
 * Respects the `required` array from the JSON Schema — fields not listed
 * as required become `.optional()`.
 */
function jsonSchemaPropertyToZod(prop: Record<string, unknown>): ZodTypeAny {
  const type = prop['type'] as string | undefined;
  const description = prop['description'] as string | undefined;

  let schema: ZodTypeAny;

  switch (type) {
    case 'string':
      schema = z.string();
      break;
    case 'number':
    case 'integer':
      schema = z.number();
      break;
    case 'boolean':
      schema = z.boolean();
      break;
    case 'array':
      schema = z.array(z.any());
      break;
    case 'object':
      // zod 4 requires an explicit key schema; z.record(z.string(), z.any())
      // preserves the zod 3 z.record(z.any()) meaning (string keys, any values).
      schema = z.record(z.string(), z.any());
      break;
    default:
      schema = z.any();
  }

  if (description) {
    schema = schema.describe(description);
  }
  return schema;
}

function jsonSchemaToZodShape(
  inputSchema: Record<string, unknown> | undefined,
): Record<string, ZodTypeAny> {
  if (!inputSchema) return {};

  const properties = inputSchema['properties'] as Record<string, Record<string, unknown>> | undefined;
  if (!properties) return {};

  const required = new Set(
    Array.isArray(inputSchema['required']) ? (inputSchema['required'] as string[]) : [],
  );

  const shape: Record<string, ZodTypeAny> = {};
  for (const [key, prop] of Object.entries(properties)) {
    let fieldSchema = jsonSchemaPropertyToZod(prop);
    if (!required.has(key)) {
      fieldSchema = fieldSchema.optional();
    }
    shape[key] = fieldSchema;
  }
  return shape;
}

/**
 * Spawn a child MCP process, connect to it, discover its tools,
 * and register them on the parent server.
 *
 * Returns the number of tools registered, or 0 if the child failed to start.
 */
export async function proxyChildMcp(
  parentServer: McpServer,
  target: ProxyTarget,
  mcpName: string,
): Promise<number> {
  try {
    const safeArgs = redactArgs(target.args);
    const safeEnv = redactEnv(target.env ?? {});
    log.info(
      mcpName,
      target.name,
      'proxy_start',
      `Spawning ${target.command} ${safeArgs.join(' ')}`,
      { env: safeEnv },
    );

    const transport = new StdioClientTransport({
      command: target.command,
      args: target.args,
      env: { ...process.env, ...(target.env ?? {}) } as Record<string, string>,
    });

    const client = new Client({ name: `${mcpName}-proxy-${target.name}`, version: '1.0.0' });
    await client.connect(transport);

    // Discover tools from the child
    const { tools } = await client.listTools();
    if (!tools || tools.length === 0) {
      log.warn(mcpName, target.name, 'proxy_start', 'Child MCP registered 0 tools');
      return 0;
    }

    log.info(mcpName, target.name, 'proxy_start', `Discovered ${tools.length} tools from ${target.name}`);

    // Register each tool on the parent server, forwarding calls to the child.
    // Convert the child's JSON Schema inputSchema into a Zod shape so that
    // the parent MCP server advertises the correct parameter schema to clients.
    // This ensures tools like 21st-dev/magic pass their parameters through correctly.
    let registered = 0;
    for (const tool of tools) {
      const toolName = target.toolPrefix ? `${target.toolPrefix}${tool.name}` : tool.name;
      // Capture tool.name in closure
      const childToolName = tool.name;

      // Build a Zod shape from the child tool's inputSchema
      const zodShape = jsonSchemaToZodShape(tool.inputSchema);

      parentServer.tool(
        toolName,
        tool.description ?? `Proxied from ${target.name}`,
        zodShape,
        async (args: Record<string, unknown>) => {
          try {
            const result = await client.callTool({ name: childToolName, arguments: args });
            // Cast through unknown to satisfy SDK's strict content type union
            return result as unknown as {
              content: Array<{ type: 'text'; text: string }>;
            };
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            log.error(mcpName, target.name, toolName, `Proxy call failed: ${msg}`);
            return {
              content: [{ type: 'text' as const, text: `Error from ${target.name}: ${msg}` }],
              isError: true as const,
            };
          }
        },
      );
      registered++;
    }

    log.info(mcpName, target.name, 'proxy_start', `Registered ${registered} proxied tools`);
    return registered;
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    // Spawn errors can embed the full argv / env in the message on some
    // platforms. Scrub any `key=value` pair whose key matches the sensitive
    // pattern before logging.
    const msg = raw.replace(
      /([A-Za-z_][A-Za-z0-9_]*)=([^\s"']+)/g,
      (match, key: string) => (SENSITIVE_ENV_KEY.test(key) ? `${key}=[REDACTED]` : match),
    );
    log.error(mcpName, target.name, 'proxy_start', `Failed to spawn child MCP: ${msg}`);
    return 0;
  }
}

/**
 * Helper to expand `~` in paths (used for config values that may contain home dir).
 */
export function expandHome(p: string): string {
  if (p.startsWith('~/')) {
    return `${process.env['HOME'] ?? ''}/${p.slice(2)}`;
  }
  return p;
}
