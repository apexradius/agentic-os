---
name: agent-orchestrator
description: "Orchestrate multiple agents for complex tasks — DAG of agent tasks with dependencies, model tiering, context management, PIV loop. Use when coordinating multi-agent workflows, parallel task execution, or agent team architecture."
argument-hint: "[workflow-description]"
---

# Agent Orchestrator

Run complex multi-step tasks by coordinating multiple agents.

## Steps
1. **Parse workflow** — break description into discrete agent tasks
2. **Build dependency graph** — which tasks depend on which
3. **Assign roles** — every agent gets a role with enforced permissions (see Role Enforcement)
4. **Define contracts** — every agent gets a YAML contract block (see Agent Contract Format)
5. **Validate ownership** — no two Builder agents own the same file (see Conflict Prevention)
6. **Identify parallelism** — tasks with no shared dependencies run simultaneously (the fan-out/fan-in contract this skill implements is doctrine: [../../coordination/fan-out.md](../../coordination/fan-out.md))
7. **Launch agents** — use Agent tool with appropriate subagent_type:
   - `Explore` for research/analysis (read-only)
   - `Plan` for architecture/design
   - `general-purpose` for implementation
8. **Post-agent verification** — after every Builder completes, spawn a Validator (see Post-Agent Verification)
9. **Collect results** — wait for all agents, aggregate outputs
10. **Synthesize** — combine findings into a coherent final report
11. **Handle failures** — retry failed tasks (max 2 retries per Failure Budget), then escalate

## Role Enforcement

Two roles. No exceptions.

### Builder
- **Permitted tools**: All (Read, Write, Edit, Bash, Glob, Grep, MCP tools)
- **Constraint**: may only modify files listed in its contract `owns` field
- **Enforcement**: contract instructions state file ownership explicitly. Post-completion, orchestrator runs `git diff --name-only` and verifies only owned files were changed. If a Builder touched files outside its `owns` list, flag as a violation and escalate to user — do NOT auto-revert.

### Validator
- **Permitted tools**: Read, Glob, Grep only
- **Constraint**: must not modify any files
- **Enforcement**: contract instructions explicitly state "DO NOT modify, create, write, edit, or delete any files. You are read-only." Post-completion, orchestrator runs `git diff --name-only` — if ANY files were modified, fail closed: report the violation, do NOT auto-revert, escalate to user.

## Agent Contract Format

Every agent receives a YAML contract block in its prompt. This is the single source of truth for what the agent can and cannot do.

```yaml
# Agent Contract
role: Builder | Validator
owns:
  - src/api/users.ts
  - src/api/users.test.ts
reads:
  - src/types/*.ts
  - src/config.ts
forbidden:
  - "DO NOT modify any file not listed in owns"
  - "DO NOT install packages globally"
  - "DO NOT delete files"
output: "Write findings to /tmp/agent-{name}-output.md"
timeout: 300s
```

- `role`: Builder or Validator
- `owns`: files this agent may modify (Builders only; empty for Validators)
- `reads`: files this agent needs to read for context
- `forbidden`: explicit constraints — state what NOT to do
- `output`: where this agent writes its results (use /tmp for ephemeral, project path for persistent)
- `timeout`: max execution time before the orchestrator kills the agent

## Conflict Prevention

Before launching any agents:

1. Collect all `owns` lists from all Builder contracts
2. Check for overlaps — if any file appears in two or more Builder `owns` lists, resolve before launching:
   - Split the file's work into sequential tasks (first builder, then second)
   - Or reassign so only one builder touches the file
3. No two Builders may run in parallel if they own the same file. Sequential execution with a Validator between them is acceptable.

## Post-Agent Verification

After every Builder completes:

1. Spawn a Validator agent scoped to the Builder's output
2. Validator checks:
   - Did the Builder's changes match the task requirements?
   - Are there regressions in files the Builder touched?
   - Do tests pass (if applicable)?
3. Validator reports: PASS, FAIL (with specifics), or WARN (non-blocking concerns)
4. If FAIL: enter retry under Failure Budget

## Failure Budget

- **Max 2 retries** per agent task
- On first failure: retry with the Validator's failure report appended to the agent's prompt
- On second failure: retry with additional constraints or simplified scope
- On third failure: **escalate to user** with full context (original task, all three failure reports, Validator feedback)
- Never silently retry beyond the budget. Never skip a failed task without escalation.

## Progress Markers

Builder agents must output progress markers for status tracking:

```
[PROGRESS: 0%] Starting task: implement user API
[PROGRESS: 25%] Created route handlers
[PROGRESS: 50%] Added validation logic
[PROGRESS: 75%] Wrote tests
[PROGRESS: 100%] Task complete, all tests passing
```

- Orchestrator monitors stdout for `[PROGRESS: X%]` lines
- If no progress marker received within timeout/2, orchestrator pings the agent or flags as potentially stuck
- Final output must include `[PROGRESS: 100%]` or an explicit failure report

## Example
```
Task A: Research (Validator) ─┐
Task B: Research (Validator) ─┼──→ Task D: Implement (Builder) ──→ Task E: Verify (Validator)
Task C: Plan (Validator) ─────┘
```
A, B, C run in parallel (all read-only). D waits for all three. E validates D's output.

## Model Selection Per Agent
- **Opus 4.6**: Deep architectural planning, complex debugging, high-stakes analysis
- **Sonnet 4.6**: Default workhorse — coding, tool use, agentic workflows
- **Haiku 4.5**: Delegate to subagents for large-scale data processing, web research, summarizing thousands of tokens cheaply

## Context Management Rules
- **Progressive Disclosure**: Don't load all instructions and tools upfront — agents should only discover and load specific skills or reference docs as the query demands
- **Compaction threshold**: Trigger `/compact` manually at 60% context capacity; waiting for auto-compact at 95% degrades quality
- **Session reset**: Use `/clear` when switching to unrelated tasks or after 3-4 deep turns on the same topic

## Contract-First Spawning (Agent Teams)
Before launching a multi-agent team:
1. Define inter-agent communication protocol (what data is passed between agents)
2. Define file ownership (which agent writes to which files — no overlaps to prevent conflicts)
3. Use a shared task list / scratchpad file all agents can read

## PIV Loop (for Builder agents)
1. **Plan**: Enter Plan Mode; instruct agent to ask 10+ clarifying questions
2. **Externalize**: Save agreed plan as structured markdown (PRD/spec)
3. **Reset**: Clear context — load only the saved plan
4. **Implement**: Build the feature
5. **Validate**: Spawn Validator agent before marking complete

## Scout Pattern
Before loading large docs into context, deploy a lightweight Explore agent to scan and identify which files are actually relevant — then load only those.

## Anti-Patterns
- **Implementation subagents**: Never use subagents to write code for the main project — they lack full file change awareness and produce conflicting code
- **Credential exposure**: Never paste API keys in agent prompts — use .env files or Secret Managers
- **Monolithic rules**: Global CLAUDE.md > 200-500 lines = route to task-specific files instead
- **Lethal Trifecta**: Never combine (1) private data access + (2) untrusted inputs (web scraping) + (3) exfiltration vectors (email/Slack) in one agent without human-in-the-loop
- **Unsupervised Builders**: Never let a Builder run without a post-completion Validator. The extra 30 seconds saves hours of debugging.
- **Auto-revert on violation**: Never automatically revert a Validator violation. The orchestrator doesn't know what the agent was doing — a human must review.

## Output
Final synthesized report with contributions from each agent cited. Include which agent handled each section, role (Builder/Validator), progress markers, and any failures/retries with Validator feedback.
