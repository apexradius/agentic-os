/**
 * 1Password tools — migrated from mcp-1password (old Server API → McpServer.tool())
 *
 * Shells out to `op` CLI for vault operations. The OnePasswordClient logic
 * is preserved from the original.
 */

import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { toolResult, toolError, log } from '@framework/mcp-shared';

const MCP = 'apex-core-mcp';
const HOME_DIR = process.env['HOME'] || homedir();

interface OpField { id: string; type: string; label: string; value?: string }
interface OpItem {
  id: string; title: string; category: string;
  vault: { id: string; name: string };
  fields?: OpField[];
  created_at?: string; updated_at?: string;
}
interface OpVault { id: string; name: string; type: string }

class OpClient {
  private readonly cmd: string;
  private readonly env: NodeJS.ProcessEnv;

  constructor() {
    this.cmd = 'op';
    this.env = {
      ...process.env,
      SSH_AUTH_SOCK: process.env['SSH_AUTH_SOCK']
        ?? `${HOME_DIR}/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock`,
    };
  }

  check(): boolean {
    try {
      execSync(`${this.cmd} --version`, { stdio: 'pipe', env: this.env });
      return true;
    } catch {
      return false;
    }
  }

  private exec(command: string, format: 'json' | 'text' = 'json'): string {
    const flag = format === 'json' ? '--format=json' : '';
    return execSync(`${this.cmd} ${command} ${flag}`.trim(), {
      encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], env: this.env,
    }).trim();
  }

  listVaults(): string {
    const vaults: OpVault[] = JSON.parse(this.exec('vault list'));
    if (!vaults.length) return 'No vaults found.';
    return `Found ${vaults.length} vault(s):\n` +
      vaults.map(v => `  • ${v.name} (ID: ${v.id})`).join('\n');
  }

  listItems(vault: string, category?: string, search?: string): string {
    let cmd = `item list --vault="${vault}"`;
    if (category) cmd += ` --category="${category}"`;
    let items: OpItem[] = JSON.parse(this.exec(cmd));
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i => i.title.toLowerCase().includes(q));
    }
    if (!items.length) return 'No items found in vault.';
    return `Found ${items.length} item(s):\n` +
      items.map(i => `  • ${i.title} (ID: ${i.id}, Category: ${i.category})`).join('\n');
  }

  getItem(name?: string, uuid?: string, vault?: string): string {
    if (!name && !uuid) throw new Error('Either name or uuid must be provided');
    const cmd = uuid ? `item get "${uuid}"` : `item get "${name}" --vault="${vault}"`;
    const item: OpItem = JSON.parse(this.exec(cmd));
    return this.formatItem(item);
  }

  getField(itemName: string | undefined, itemUuid: string | undefined, field: string, vault?: string): string {
    if (!itemName && !itemUuid) throw new Error('Either item_name or item_uuid must be provided');
    if (!field) throw new Error('field parameter is required');
    const itemId = itemUuid ? `"${itemUuid}"` : `"${itemName}" --vault="${vault}"`;
    const out = this.exec(`item get ${itemId} --fields="${field}"`, 'text');
    return out || `Field "${field}" not found.`;
  }

  searchItems(query: string, vault?: string): string {
    let cmd = 'item list';
    if (vault) cmd += ` --vault="${vault}"`;
    let items: OpItem[] = JSON.parse(this.exec(cmd));
    const q = query.toLowerCase();
    items = items.filter(i =>
      i.title.toLowerCase().includes(q) || i.category.toLowerCase().includes(q),
    );
    if (!items.length) return `No items found matching "${query}".`;
    return `Found ${items.length} item(s) matching "${query}":\n` +
      items.map(i => `  • ${i.title} (ID: ${i.id}, Vault: ${i.vault?.name ?? 'Unknown'}, Category: ${i.category})`).join('\n');
  }

  private formatItem(item: OpItem): string {
    const lines = [`Title: ${item.title}`, `ID: ${item.id}`, `Category: ${item.category}`,
      `Vault: ${item.vault?.name ?? 'Unknown'}`];
    if (item.created_at) lines.push(`Created: ${item.created_at}`);
    if (item.updated_at) lines.push(`Updated: ${item.updated_at}`);
    if (item.fields?.length) {
      lines.push('\nFields:');
      for (const f of item.fields) {
        lines.push(f.type === 'concealed' ? `  ${f.label}: [REDACTED]` : `  ${f.label}: ${f.value ?? '[empty]'}`);
      }
    }
    return lines.join('\n');
  }
}

const opClient = new OpClient();

export function isOpAvailable(): boolean {
  return opClient.check();
}

export function registerOnePasswordTools(server: McpServer): void {
  server.tool('1password_list_vaults', 'List all available 1Password vaults', {},
    async () => {
      try { return toolResult(opClient.listVaults()); }
      catch (e) { return toolError(e); }
    },
  );

  server.tool('1password_list_items', 'List items in a vault, optionally filtered by category or search term', {
    vault: z.string().min(1).describe('Vault name or ID'),
    category: z.string().optional().describe("Filter by category (e.g., 'login', 'password')"),
    search: z.string().optional().describe('Search term to filter by name'),
  }, async ({ vault, category, search }) => {
    try { return toolResult(opClient.listItems(vault, category, search)); }
    catch (e) { return toolError(e); }
  });

  server.tool('1password_get_item', 'Retrieve a complete item from 1Password by name or UUID', {
    name: z.string().optional().describe('Item name'),
    uuid: z.string().optional().describe('Item UUID'),
    vault: z.string().optional().describe('Vault name or ID (required if using name)'),
  }, async ({ name, uuid, vault }) => {
    try { return toolResult(opClient.getItem(name, uuid, vault)); }
    catch (e) { return toolError(e); }
  });

  server.tool('1password_get_field', 'Retrieve a specific field value from a 1Password item', {
    item_name: z.string().optional().describe('Name of the item'),
    item_uuid: z.string().optional().describe('UUID of the item'),
    field: z.string().min(1).describe("Field label to retrieve (e.g., 'password', 'username')"),
    vault: z.string().optional().describe('Vault name or ID (required if using item_name)'),
  }, async ({ item_name, item_uuid, field, vault }) => {
    try { return toolResult(opClient.getField(item_name, item_uuid, field, vault)); }
    catch (e) { return toolError(e); }
  });

  server.tool('1password_search_items', 'Search for items across all accessible vaults', {
    query: z.string().min(1).describe('Search term'),
    vault: z.string().optional().describe('Limit search to a specific vault'),
  }, async ({ query, vault }) => {
    try { return toolResult(opClient.searchItems(query, vault)); }
    catch (e) { return toolError(e); }
  });

  log.info(MCP, '1password', 'register', 'Registered 5 1Password tools');
}
