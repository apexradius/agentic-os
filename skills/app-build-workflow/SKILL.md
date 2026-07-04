---
name: app-build-workflow
description: "Create a gated app-build spec package before coding. Use when turning a raw web app idea into PRD, TRD, app flow, UI/UX brief, schema, implementation, verification, and progress templates."
user-invocable: true
argument-hint: "[app idea or project name]"
---

# App Build Workflow

Use this skill to turn a raw web app idea into an agent-ready build package. The package must exist before application code is written.

## Output

Create or update these files under `specs/`:

```text
00_build_intake.md
01_prd.md
02_trd.md
03_app_flow.md
04_ui_ux_brief.md
05_backend_schema.md
06_implementation_plan.md
07_verification_plan.md
progress.md
```

Templates are in `templates/`.

## Procedure

1. Create `specs/` if it does not exist.
2. Copy the templates into `specs/`, preserving file names.
3. Fill `00_build_intake.md` from the user idea and any discoverable project context.
4. Ask only for decisions that cannot be discovered from repo, docs, logs, or tools.
5. Stop at the intake gate until the user confirms scope.
6. Draft `01_prd.md`, then stop at the PRD gate until the user confirms P0 scope.
7. Treat new P0 work after PRD approval as a change request.
8. Complete the remaining docs in order: TRD, app flow, UI/UX brief, backend schema, implementation plan, verification plan.
9. Run role-based review lanes before implementation: Product Manager, Architect, Tech Lead, UI/UX Designer, Senior Developer, QA Engineer, Security Engineer, and DevOps Engineer.
10. Run the engineering modes that match the phase: Full Startup Engineering Team, Senior Codebase Audit, Production Debugging, Performance Optimization, Clean Architecture Refactor, Startup Backend Architect, AI Engineering Team, Senior Frontend Engineer, AI Technical Lead, Production Security Audit, and Senior DevOps And Deployment Engineer.
11. Resolve all block and fix-before-build findings in the specs.
12. Do not implement until every gate passes.
13. During implementation, update `progress.md` after every phase, failed check, blocker, change request, and deploy.

## Gates

- Intake: primary v1 user, buyer/operator roles, measurable launch outcome, assumptions, open questions, and user signoff.
- PRD: P0 features map to user stories, atomic acceptance criteria, and verification methods.
- TRD: stack, runtime, package manager, lockfile, clean-checkout setup, env contract, secrets source, CI, observability, deploy, and rollback are explicit.
- App flow: routes, buttons, forms, states, auth behavior, and public-write abuse handling are specified.
- UI/UX: interaction states, accessibility, mobile/desktop layouts, and screenshot or prototype proof are specified.
- Schema: entities, relationships, tenant or owner scope, validation, retention, backup, and restore are specified.
- Implementation: each task maps to acceptance criteria and verification.
- Verification: tests, browser paths, screenshots, security matrix, secret scan, dependency audit, rollback rehearsal, clean checkout, and release ownership are specified.
- Agent team review: product, architecture, build, design, code, QA, security, and operations lanes have no unresolved block or fix-before-build findings.
- Engineering modes: selected mode outputs are recorded with trigger, owner, findings, required spec updates, and closure evidence.

## Rules

- Never code before the package exists and gates pass.
- Every feature traces to story, acceptance criterion, screen/API/data, task, and verification method.
- Every acceptance criterion has exactly one primary verification method.
- No builder approves its own plan; use separate review lanes before implementation.
- Treat engineering modes as gated review/build passes, not loose prompts.
- Debugging mode requires reproduction and root cause before fixes.
- Performance mode requires baseline and after-change evidence.
- Refactor mode preserves product behavior unless a change request approves behavior change.
- Security mode records attack scenario, severity, fix, and verification method.
- DevOps mode records rollback, logs, health check, alert owner, and post-launch validation.
- Protected data requires authorization rules and negative access tests.
- Secret scans cover tracked files, untracked files, config files, `.env` files, and git history.
- Data-bearing apps require backup and restore validation.
- Resume by reading `specs/progress.md` first.
- Log decisions, assumptions, open questions, and change requests raised in any phase back to `00_build_intake.md` / `01_prd.md` (single register home).

## Template Map

- `templates/00_build_intake.md`
- `templates/01_prd.md`
- `templates/02_trd.md`
- `templates/03_app_flow.md`
- `templates/04_ui_ux_brief.md`
- `templates/05_backend_schema.md`
- `templates/06_implementation_plan.md`
- `templates/07_verification_plan.md`
- `templates/progress.md`
