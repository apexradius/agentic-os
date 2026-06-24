---
name: spec-driven-dev
description: "Spec-driven development — structured requirements → design → implementation → verification. Creates spec files before writing code. Use when building features, starting new projects, or when user says spec this, design first, plan before coding, or /spec-driven-dev."
user-invocable: true
argument-hint: "[feature-or-project-description]"
---

# Spec-Driven Development

Write specs before code. Every feature flows: Requirements → Design → Tasks → Implementation → Verification.

## Process

### Step 1: Requirements Spec
Create `specs/[feature].requirements.md`:
```markdown
# Requirements: [Feature Name]

## User Stories
- As a [role], I want [capability], so that [benefit]

## Acceptance Criteria
- [ ] Given [context], when [action], then [result]
- [ ] Given [context], when [action], then [result]

## Out of Scope
- [Explicitly excluded items]

## Dependencies
- [External systems, APIs, libraries]

## Constraints
- [Performance, security, compatibility requirements]
```

### Step 2: Design Spec
Create `specs/[feature].design.md`:
```markdown
# Design: [Feature Name]

## Architecture Decision
[Chosen approach and why. Include alternatives considered.]

## Data Model
[Schema changes, new models, relationships]

## API / Interface
[Endpoints, function signatures, props]

## Error Handling
[Expected errors and how each is handled]

## Security Considerations
[Auth, validation, injection prevention]
```

### Step 3: Task Breakdown
Create `specs/[feature].tasks.md`:
```markdown
# Tasks: [Feature Name]

## Phase 1: [Setup]
- [ ] Task 1 — [file(s)] — [Tier · effort] — [estimate]
- [ ] Task 2 — [file(s)] — [Tier · effort] — [estimate]

## Phase 2: [Core Implementation]
- [ ] Task 3 — [file(s)] — [Tier · effort] — [estimate]

## Phase 3: [Testing & Polish]
- [ ] Task 4 — [file(s)] — [Tier · effort] — [estimate]

## Definition of Done
- [ ] All acceptance criteria passing
- [ ] Tests written and passing
- [ ] No linter errors
- [ ] Code reviewed
```

### Step 4: Implementation
- Work through tasks in order
- Check off completed tasks in the tasks file
- If design changes needed, update design spec FIRST, then code

### Step 5: Verification
- Walk through each acceptance criterion
- Run tests
- Update tasks file with completion status

## Rules
1. **Never write code before specs exist** — at minimum, requirements + 3 acceptance criteria
2. **Specs live in `specs/` directory** in project root
3. **Update specs when reality diverges** — specs are living documents
4. **One spec set per feature** — don't combine unrelated features
5. **Acceptance criteria are testable** — no vague language like "should work well"

## When to Skip
- Bug fixes with clear reproduction steps (just fix it)
- Single-line changes
- Documentation-only changes
