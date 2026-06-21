---
name: api-endpoint
description: "Scaffold a REST API endpoint — validation, error handling, TypeScript types, auth patterns, rate limiting. REST vs GraphQL decision. Use when building API routes, creating endpoints, or /api-endpoint."
user-invocable: true
argument-hint: "[endpoint-description]"
---

# API Endpoint

Scaffold a complete API endpoint matching the project's framework.

## REST vs GraphQL Decision
- **Use REST when**: CRUD operations, public APIs, simple resource model, team unfamiliar with GraphQL, caching is important
- **Use GraphQL when**: Multiple clients with different data needs, complex nested relationships, rapid frontend iteration, avoiding over/under-fetching

## Authentication Pattern Selection
| Auth Type | When to Use |
|-----------|-------------|
| API Key | Server-to-server, simple integrations, low-risk data |
| JWT (Bearer) | Stateless user sessions, mobile apps, SPAs |
| OAuth 2.0 | Third-party access, user-delegated permissions |
| mTLS | High-security server-to-server, fintech/health |

## Versioning Strategy
- **URL versioning** (`/v1/`, `/v2/`): Explicit, cacheable, works with any client — preferred for public APIs
- **Header versioning** (`Accept: application/vnd.api.v2+json`): Cleaner URLs but harder to test and discover

## Rate Limiting Thresholds
- Anonymous: 60 req/min
- Authenticated: 300 req/min
- Premium: 1,000 req/min
- Always return `429 Too Many Requests` + `Retry-After` header

## Steps
1. **Detect framework** — Astro API routes (`src/pages/api/`), Next.js (`app/api/`), or Express
2. **Determine auth pattern** — API Key, JWT, or OAuth based on use case
3. **Generate** route handler with: Zod input validation, TypeScript request/response types, error handling (try/catch with proper status codes), CORS headers if needed, rate limiting middleware
4. **Create types file** if project uses separate type definitions
5. **Generate OpenAPI spec** entry for the endpoint (operation, parameters, request body, responses)
6. **Show curl examples** for testing all response codes

## Anti-Patterns
- Never expose stack traces in error responses — sanitize to `{ error: "message", code: "ERROR_CODE" }`
- Never return 200 with `{ success: false }` — use proper HTTP status codes
- Never log sensitive fields (passwords, tokens, PII) in request/response logs
