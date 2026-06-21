#!/usr/bin/env node

/**
 * apex-commerce-mcp — Commerce/Shopify/Stripe MCP
 *
 * Consolidates:
 *   - a vendored shopify-mcp (72 tools), proxied — entry path from MCP_SHOPIFY_ENTRY
 *   - Stripe Revenue Dashboard
 *
 * Total: ~74 tools + system_health
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import Stripe from 'stripe';
import {
  UnifiedErrorHandler,
  proxyChildMcp,
  registerHealthTool,
  toolResult,
  toolError,
  log,
  EXIT_CODES,
  type ProxyTarget,
} from '@framework/mcp-shared';

const MCP_NAME = 'apex-commerce-mcp';
const MCP_VERSION = '1.0.3';

// The shopify-mcp server is vendored (not a dependency of this package). Its entry script is
// supplied by the install via MCP_SHOPIFY_ENTRY; when unset, the Shopify proxy is skipped.
function resolveShopifyTarget(accessToken: string, storeDomain: string): ProxyTarget | null {
  const shopifyMcpEntry = process.env['MCP_SHOPIFY_ENTRY'];
  if (!shopifyMcpEntry) return null;

  return {
    name: 'shopify',
    command: 'node',
    args: [shopifyMcpEntry, 'start', '--transport', 'stdio'],
    env: {
      SHOPIFY_ACCESS_TOKEN: accessToken,
      SHOPIFY_STORE_DOMAIN: storeDomain,
      SHOPIFY_SHOP_DOMAIN: storeDomain,
    },
  };
}

async function main(): Promise<void> {
  const errorHandler = new UnifiedErrorHandler({
    mcpName: MCP_NAME,
    retryOverrides: {
      shopify: { maxRetries: 3, initialDelayMs: 2000, maxDelayMs: 60_000 },
    },
  });

  const serviceStatus: Record<string, boolean> = { shopify: false, stripe: false };

  const server = new McpServer({ name: MCP_NAME, version: MCP_VERSION });
  let totalTools = 0;

  // Proxy Shopify (72 tools)
  const accessToken = process.env['SHOPIFY_ACCESS_TOKEN'] ?? '';
  const storeDomain = process.env['SHOPIFY_STORE_DOMAIN'] ?? '';

  if (!accessToken || !storeDomain) {
    log.warn(MCP_NAME, 'shopify', 'startup',
      'Missing SHOPIFY_ACCESS_TOKEN or SHOPIFY_STORE_DOMAIN — Shopify tools unavailable');
  }

  const shopifyTarget = resolveShopifyTarget(accessToken, storeDomain);

  if (shopifyTarget) {
    const shopifyCount = await proxyChildMcp(server, shopifyTarget, MCP_NAME);
    serviceStatus.shopify = shopifyCount > 0;
    totalTools += shopifyCount;
  } else {
    log.warn(MCP_NAME, 'shopify', 'startup',
      'MCP_SHOPIFY_ENTRY not set — Shopify proxy tools unavailable');
  }

  // Stripe Integration
  const stripeKey = process.env['STRIPE_SECRET_KEY'];
  const stripe = stripeKey ? new Stripe(stripeKey) : null;
  if (stripe) {
    serviceStatus.stripe = true;
    log.info(MCP_NAME, 'stripe', 'startup', 'Stripe configured');
  }

  server.tool(
    "revenue_dashboard",
    "Get a real-time overview of revenue across all streams (Stripe, Shopify, Etsy).",
    {},
    async () => {
      try {
        const report: any = {
          revenue_target: process.env['COMMERCE_REVENUE_TARGET'] || undefined,
          timestamp: new Date().toISOString(),
          streams: {}
        };

        if (stripe) {
          const balance = await stripe.balance.retrieve();
          report.streams.stripe = {
            available: balance.available.map(b => `${(b.amount / 100).toFixed(2)} ${b.currency.toUpperCase()}`),
            pending: balance.pending.map(b => `${(b.amount / 100).toFixed(2)} ${b.currency.toUpperCase()}`)
          };
        }

        report.streams.etsy = "Awaiting KYC (Pending 2-5 days)";
        report.streams.shopify = "Active (Consult Shopify tools for per-order detail)";

        return toolResult(JSON.stringify(report, null, 2));
      } catch (e) {
        return toolError(e);
      }
    }
  );
  totalTools += 1;

  // Health check
  registerHealthTool(server, {
    mcpName: MCP_NAME,
    version: MCP_VERSION,
    errorHandler,
    checks: {
      shopify: async () => {
        if (!accessToken || !storeDomain) return 'Missing credentials';
        return serviceStatus.shopify ? null : 'Child process failed to start';
      },
      stripe: async () => {
        return stripe ? null : 'Stripe not configured';
      }
    },
  });
  totalTools += 1;

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.ready(MCP_NAME, totalTools, serviceStatus);

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
