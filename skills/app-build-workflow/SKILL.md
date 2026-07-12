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
0_viability.md
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
3. **Gate 0 FIRST — run the viability kill-test (`0_viability.md`) before drafting ANY spec doc.** Four cheap checks, hours not days; fail any → stop and report, do not proceed to intake. This is the front-loaded feasibility pass that catches distribution/mechanism/policy kills before spec effort is sunk:
   - **Distribution + unit economics** — realistic acquisition channel for this budget; order-of-magnitude CAC vs LTV. Underwater → kill.
   - **Mechanism feasibility** — can the core promise physically be built on the target platform? (Does an API/primitive exist to do the load-bearing thing — e.g. run code at a future time, sync across accounts, access the sensor?) One doc-read or one-day spike. No path → kill or redesign.
   - **Platform-policy legality** — do the store guidelines + regulators allow this architecture? (Search the actual guideline text for the data/category, not memory.) Forbidden → redesign or kill.
   - **Wedge reachability** — is the market gap not just real but *reachable* vs free/incumbent competitors with distribution.
4. Fill `00_build_intake.md` from the user idea and any discoverable project context.
5. Ask only for decisions that cannot be discovered from repo, docs, logs, or tools.
6. Stop at the intake gate until the user confirms scope.
7. Draft `01_prd.md`, then stop at the PRD gate until the user confirms P0 scope.
8. Treat new P0 work after PRD approval as a change request.
9. Complete the remaining docs in order: TRD, app flow, UI/UX brief, backend schema, implementation plan, verification plan.
10. Run role-based review lanes before implementation: Product Manager, Architect, Tech Lead, UI/UX Designer, Senior Developer, QA Engineer, Security Engineer, and DevOps Engineer.
11. Run the engineering modes that match the phase: Full Startup Engineering Team, Senior Codebase Audit, Production Debugging, Performance Optimization, Clean Architecture Refactor, Startup Backend Architect, AI Engineering Team, Senior Frontend Engineer, AI Technical Lead, Production Security Audit, and Senior DevOps And Deployment Engineer.
12. Resolve all block and fix-before-build findings in the specs.
13. Do not implement until every gate passes.
14. During implementation, update `progress.md` after every phase, failed check, blocker, change request, and deploy.

## Gates

- Viability (Gate 0, before all others): distribution/CAC-vs-LTV is not underwater; the core mechanism is physically buildable on the target platform (named API/primitive, or a spike that ran); no store guideline or regulation forbids the chosen architecture (quoted from the live guideline text); the wedge is reachable vs free/incumbent competitors. Any hard fail here stops the workflow before intake — no spec docs are drafted.
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

- Run Gate 0 (`0_viability.md`) before any spec doc; a hard viability fail stops the workflow — do not draft intake/PRD to "keep momentum" on a project that can't distribute, can't run, or is architecturally disallowed.
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

- `templates/0_viability.md`
- `templates/00_build_intake.md`
- `templates/01_prd.md`
- `templates/02_trd.md`
- `templates/03_app_flow.md`
- `templates/04_ui_ux_brief.md`
- `templates/05_backend_schema.md`
- `templates/06_implementation_plan.md`
- `templates/07_verification_plan.md`
- `templates/progress.md`
