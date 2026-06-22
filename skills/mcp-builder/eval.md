---
skill: mcp-builder
---
# Eval: mcp-builder

A failing-baseline eval — without the skill the agent hand-rolls an ad-hoc server; with the skill
it scaffolds a spec-compliant MCP server with typed tools and a test.

## Baseline
Prompt the agent **without** the mcp-builder skill loaded:

> "Build an MCP server that exposes a 'search tickets' tool."

Observed baseline failure: the agent writes an improvised script with an untyped/incorrect tool
schema, no input validation, and no test — it may not register correctly with an MCP client and
the tool contract is unverified.

## Pass
With the mcp-builder skill loaded, the agent scaffolds the server to the MCP spec, defines the
tool with a typed input schema, implements it, and includes a test/smoke check.

Pass criterion: the tool has a valid typed input schema, the server follows the MCP contract, and
there is an executable check that the tool responds. **Fail** if the tool schema is missing/untyped
or the server is never verified to register and respond.
