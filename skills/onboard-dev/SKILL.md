---
name: onboard-dev
description: "Onboard a developer to a project — repo discovery, architecture mapping, dev environment setup, first-contribution guide. Use when onboarding devs, /onboard-dev."
user-invocable: true
argument-hint: "[project-directory]"
---

# Developer Onboarding

## Step 1: Repo Discovery

Scan the project directory and extract key metadata:

```bash
# Detect stack
ls package.json requirements.txt Cargo.toml go.mod Gemfile composer.json pyproject.toml 2>/dev/null
# Read project docs
cat README.md CONTRIBUTING.md .github/CONTRIBUTING.md 2>/dev/null
# Check for containerization
ls Dockerfile docker-compose.yml .devcontainer/ 2>/dev/null
# Check CI/CD
ls .github/workflows/ .gitlab-ci.yml Jenkinsfile .circleci/ 2>/dev/null
```

Extract: language, framework, package manager, build tool, test framework, CI system.

## Step 2: Architecture Mapping

Generate a high-level map of the codebase:

1. **Directory structure** — `find . -type d -maxdepth 3` (skip node_modules, .git, __pycache__)
2. **Entry points** — main files, server startup, CLI entry, route definitions
3. **Data layer** — database connections, ORM models, migrations directory
4. **API surface** — routes/endpoints, GraphQL schema, RPC definitions
5. **External integrations** — third-party API calls, webhook handlers, SDK usage

Output as an ASCII architecture diagram:

```
┌─────────────┐     ┌──────────────┐     ┌───────────┐
│   Frontend   │────▶│   API Server  │────▶│  Database  │
│  (Next.js)   │     │  (FastAPI)    │     │ (Postgres) │
└─────────────┘     └──────┬───────┘     └───────────┘
                           │
                    ┌──────▼───────┐
                    │  External APIs │
                    │ (Stripe, etc.) │
                    └──────────────┘
```

## Step 3: Dev Environment Setup

Generate a complete setup script based on what the repo needs:

### Dependencies
```bash
# Node.js project
nvm use $(cat .nvmrc 2>/dev/null || echo "lts/*")
npm install  # or yarn, pnpm — detect from lockfile

# Python project
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt  # or pip install -e .

# Docker project
docker compose up -d
```

### Environment Variables
- Look for `.env.example`, `.env.template`, or `.env.sample`
- List every required env var with description and where to get the value
- Flag secrets that need credentials from a password manager or cloud console

### Database
- Check for migration files and run them: `npx prisma migrate dev`, `alembic upgrade head`, `rails db:migrate`
- Check for seed data: `npm run seed`, `python manage.py loaddata`

### Verify Setup
- Run the dev server and confirm it starts: `npm run dev`, `python manage.py runserver`
- Run the test suite and confirm it passes: `npm test`, `pytest`
- Open the app in browser and verify the home page loads

## Step 4: First-Contribution Guide

Walk the developer through a typical change:

1. **Create a branch:** `git checkout -b feature/your-feature`
2. **Find the right file:** Based on architecture map, point to where new features/fixes go
3. **Make the change:** Show the pattern used in existing code (controller, service, model, test)
4. **Run tests:** Show the test command and how to run a single test file
5. **Submit PR:** Link to PR template if one exists, explain review process

## Step 5: Common Gotchas Per Stack

### Node.js / TypeScript
- `node_modules` not in .gitignore (check)
- TypeScript strict mode surprises (check tsconfig.json)
- Different package managers (npm vs yarn vs pnpm) — use whichever has a lockfile

### Python
- Virtual environment not activated (symptoms: wrong Python version, missing packages)
- `requirements.txt` vs `pyproject.toml` — check which is authoritative
- Database URL format differences between local and production

### Docker
- Port conflicts with locally-running services
- Volume mounts not syncing on macOS (use `:delegated` flag)
- Container needs rebuild after Dockerfile changes (`docker compose up --build`)

### General
- Git hooks (husky, pre-commit) — install them: `npx husky install`, `pre-commit install`
- Editor config (.editorconfig, .prettierrc) — install extensions
- Missing system dependencies (libpq, imagemagick, ffmpeg) — list and install commands

## Output

Generate an `ONBOARDING.md` file in the project root with all findings structured as:

1. Quick Start (clone to running in 5 minutes)
2. Architecture Overview (diagram + key files table)
3. Environment Variables (complete list)
4. Common Tasks (add feature, run tests, deploy)
5. Gotchas (stack-specific issues)
6. Team Conventions (branch naming, commit style, PR process)

## Anti-Patterns

- **Assuming the README is accurate** — verify every instruction by actually running it
- **Skipping the test suite** — if tests do not pass on a fresh setup, the onboarding is broken
- **Not documenting env vars** — "ask someone" is not documentation; list every variable
- **Ignoring CI config** — the CI pipeline defines what the project actually requires to build and test
- **Writing setup instructions without testing them** — run the setup from scratch on a clean directory
