---
name: learn
description: "Analyze a codebase and extract patterns, conventions, architecture decisions. Creates a knowledge base for the project. Use when joining a new project, onboarding, or /learn."
user-invocable: true
argument-hint: "[project-directory]"
---

# Learn — Codebase Knowledge Extraction

Analyze a project and produce a comprehensive knowledge base.

## Analysis Areas

### 1. Architecture
- Framework and language detection
- Directory structure and organization pattern
- Entry points and build pipeline
- Deployment target (server, static, serverless)

### 2. Conventions
- Naming patterns (camelCase, snake_case, BEM, etc.)
- File organization (by feature, by type, hybrid)
- Import patterns and module structure
- Error handling approach
- Logging patterns

### 3. Dependencies
- Key libraries and their roles
- Version constraints
- Custom vs third-party split

### 4. Data Flow
- State management approach
- API patterns (REST, GraphQL, RPC)
- Database access patterns (ORM, raw SQL, query builder)
- Authentication/authorization flow

### 5. Testing
- Test framework and runner
- Test file location convention
- Coverage requirements
- Test data/fixture patterns

## Output
Create `docs/CODEBASE.md`:
```markdown
# Codebase Knowledge: [Project]

## Quick Reference
- Language: [X]
- Framework: [X]
- Build: [command]
- Test: [command]
- Deploy: [command]

## Architecture
[findings]

## Conventions
[findings]

## Key Files
| File | Purpose |
|------|---------|
| [path] | [what it does] |

## Gotchas
- [non-obvious things a new developer needs to know]
```
