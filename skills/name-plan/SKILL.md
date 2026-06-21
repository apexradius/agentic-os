---
name: name-plan
description: "Rename plan files and batch rename code symbols — convention detection, git-aware renaming, dry-run preview. Use when renaming plans, variables, files, /name-plan."
user-invocable: true
argument-hint: "[target: plan-file-path or code-directory] [optional: new-name]"
---

# Name Plan

## Mode 1: Plan File Renaming

Replace Claude Code's random plan filenames (e.g., `optimized-cuddling-ladybug.md`) with meaningful names.

### Steps
1. **Find the plan file** — check system context for current plan path, or look in `~/AI Tools/Claude/cli/plans/`
2. **Analyze content** — read the plan to understand the task being planned
3. **Generate slug** — 2-4 word kebab-case name capturing the task essence
4. **Rename** — `mv "[old-path]" "[directory]/[new-slug].md"`
5. **Confirm** — report: `Plan renamed: [old-name] -> [new-name]`

### Slug Rules
- 2-4 words, kebab-case: `chrome-mcp-architecture`, `db-migration-postgres`
- End with a domain word when helpful: `-plan`, `-design`, `-migration`, `-refactor`, `-setup`
- Never generic: `plan.md`, `project.md`, `task.md`, `work.md`
- Never single-word: `migration.md` is too vague

### When NOT to Rename
- Plan already has a descriptive name
- User explicitly chose the current filename
- No plan mode is active

## Mode 2: Code Symbol Renaming

Batch rename variables, functions, files, or directories with convention detection and safety.

### Step 1: Detect Naming Convention
Scan the target codebase and identify the dominant convention:

| Convention | Pattern | Common In |
|-----------|---------|-----------|
| camelCase | `getUserName` | JavaScript, TypeScript, Java |
| snake_case | `get_user_name` | Python, Ruby, Rust |
| kebab-case | `get-user-name` | CSS, HTML attributes, file names |
| PascalCase | `GetUserName` | C#, Go exported, React components |
| SCREAMING_SNAKE | `MAX_RETRIES` | Constants across all languages |

### Step 2: Preview Changes (Dry Run)
Before any rename, show a complete preview:

```
Dry Run — 12 changes across 5 files:

src/utils/helper.ts:
  L14: getUserData → fetchUserProfile
  L28: getUserData → fetchUserProfile

src/api/routes.ts:
  L7:  import { getUserData } → import { fetchUserProfile }

tests/utils.test.ts:
  L3:  import { getUserData } → import { fetchUserProfile }
  L15: getUserData( → fetchUserProfile(
```

### Step 3: Git-Aware Rename
- **Track file renames with git:** `git mv old-name.ts new-name.ts` preserves history
- **Update all imports:** grep for the old name across the codebase; update every reference
- **Update test files:** test descriptions and assertions often reference symbol names
- **Check config files:** webpack aliases, tsconfig paths, package.json scripts may reference old names

### Step 4: Execute and Verify
1. Apply all changes
2. Run linter to catch broken references: `npx tsc --noEmit` or `python -m py_compile`
3. Run tests to verify nothing broke
4. Report: total files changed, total replacements, any errors

## Anti-Patterns

- **Renaming without updating all references** — broken imports are worse than bad names
- **Mixing conventions in one codebase** — detect and follow the existing convention
- **Renaming in published APIs without deprecation** — breaking change for consumers
- **No dry run** — always preview before applying; one wrong regex can corrupt a codebase
- **Renaming auto-generated code** — generated files will revert on next generation; rename the generator config instead
