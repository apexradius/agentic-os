---
name: mcp-builder
description: "Build MCP (Model Context Protocol) servers and integrations. Scaffold, implement tools, test, deploy. Use when creating MCP servers, tool integrations, or /mcp-builder."
user-invocable: true
argument-hint: "[service-name] [tools-description]"
---

# MCP Builder

Create Model Context Protocol servers that give Claude access to external services.

## Scaffold
```bash
npx @anthropic-ai/create-mcp-server [name]
# or
mkdir [name] && cd [name] && npm init -y && npm install @anthropic-ai/mcp-server
```

## Server Structure
```
mcp-server-[name]/
  src/
    index.ts          # Server entry, tool registration
    tools/            # Individual tool implementations
      [tool-name].ts
  package.json
  tsconfig.json
```

## Tool Definition Pattern
```typescript
server.tool("tool-name", "Description of what it does", {
  param1: { type: "string", description: "..." },
  param2: { type: "number", description: "..." }
}, async (params) => {
  // Implementation
  return { content: [{ type: "text", text: result }] };
});
```

## Registration in Claude Code
Add to `~/.claude/mcp.json`:
```json
{
  "mcpServers": {
    "[name]": {
      "command": "node",
      "args": ["/path/to/mcp-server-[name]/dist/index.js"]
    }
  }
}
```

## Testing
1. Build: `npm run build`
2. Test standalone: `node dist/index.js` (should start without errors)
3. Test in Claude: restart Claude Code, verify tools appear
4. Test each tool with sample inputs

## Common Integrations
- REST API wrapper (any API → MCP tools)
- Database query tool (PostgreSQL, MySQL, SQLite)
- File system operations (specialized directories)
- External service (Stripe, Twilio, SendGrid, etc.)

## Memory Layer Hierarchy (for Agent Systems)
When building agents alongside MCPs:
| File | Purpose |
|------|---------|
| `soul.md` | Agent philosophy and personality |
| `user.md` | User preferences and writing style |
| `memory.md` | Long-term distilled facts and preferences |
| `agents.md` | Highest-level operational rules and security protocols |

## Retrieval Strategy Selection
| Data Type | Strategy |
|-----------|----------|
| Structured codebase, exact identifiers | File Search (Grep/RipGrep) |
| Large unstructured knowledge base (1,000+ docs) | Traditional RAG / Semantic Search |
| Mixed (code + docs with conceptual queries) | Hybrid Search |

## Adversarial Dev Pattern
For production-grade agent systems, use 3-agent consensus:
1. **Planner** — architects spec and task breakdown
2. **Generator** — implements code
3. **Evaluator** — skeptical QA engineer who must approve before "sprint" completes

Only proceed to next sprint when evaluator score meets predefined threshold (e.g., 7/10).

## Security: The Lethal Trifecta
Do NOT deploy an agent without reviewing if it has all three:
1. Private data access (user files, email, CRM)
2. Untrusted content input (web pages, emails, user messages)
3. Exfiltration vector (can send external messages, make API calls)

If all three are present → prompt injection risk is critical. Add input sanitization before any LLM call that processes external content.
