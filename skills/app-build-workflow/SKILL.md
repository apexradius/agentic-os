---
name: app-build-workflow
description: "Create gated app specs and high-fidelity product atlases before coding. Use for app ideas, Mobbin-backed flows, wireframes, dashboards, onboarding, companion UI, or build plans."
user-invocable: true
argument-hint: "[app idea or project name]"
---

# App Build Workflow

Use this skill to turn a raw app idea into an agent-ready build package. When the request is visual, it also produces a reference-backed, testable product atlas. The package must exist before application code is written.

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

For a full-product design, wireframe atlas, onboarding system, dashboard, or premium visual prototype, also create:

```text
specs/09_wireframe_atlas.md
<public-or-docs>/mockups/<product>-full-design-atlas.html
```

Read `references/premium-product-atlas.md` in full before producing either artifact. Treat the HTML as a design proof, not production application code.

## Procedure

1. Create `specs/` if it does not exist.
2. Copy the templates into `specs/`, preserving file names.
3. **Gate 0 FIRST — run the viability kill-test (`0_viability.md`) before drafting ANY spec doc.** Five cheap checks, hours not days; fail any → stop and report, do not proceed to intake. This is the front-loaded feasibility pass that catches distribution/mechanism/policy/archetype kills before spec effort is sunk:
   - **Distribution + unit economics** — realistic acquisition channel for this budget; order-of-magnitude CAC vs LTV. Underwater → kill.
   - **Mechanism feasibility** — can the core promise physically be built on the target platform? (Does an API/primitive exist to do the load-bearing thing — e.g. run code at a future time, sync across accounts, access the sensor?) One doc-read or one-day spike. No path → kill or redesign.
   - **Platform-policy legality** — do the store guidelines + regulators allow this architecture? (Search the actual guideline text for the data/category, not memory.) Forbidden → redesign or kill.
   - **Wedge reachability** — is the market gap not just real but *reachable* vs free/incumbent competitors with distribution.
   - **Archetype & moat durability** — the most predictive check: what do you actually compete against? Expensive human labor / fragmented legacy = winning archetype. A wedge beside a dominant platform (it ships the feature native, a funded incumbent owns it, or the runtime can't hold the promise) → kill. Also test operability at scale (human-judgment bottleneck → reprice as a service, not SaaS) and whether the output is verifiable vs a pure trust sale.
4. Fill `00_build_intake.md` from the user idea and any discoverable project context.
5. Before app flow or UI decisions, gather reference screens for every new or changed journey. Use Mobbin as the primary source for consumer/mobile app flows when available; otherwise use live competitors, platform HIG/docs, or screenshots. Inspect the screens, extract patterns, and record what is adopted or rejected.
6. Design launch routing before feature screens: new user, returning user, uncertain identity, offline/recovery, account creation, paywall, cancellation, restore, and continuation. When safe, let the first-run user do the real product task before account/payment so conversion feels like a natural continuation, not a cold gate.
7. If the product uses a companion, mascot, coach, or assistant, define one canonical asset source, personality boundaries, local/offline behavior, allowed motions, page-specific hints, contextual term explainers, and safety limits. Do not imply AI advice unless the product explicitly includes an AI model and verification plan.
8. Ask only for decisions that cannot be discovered from repo, docs, logs, or tools.
9. Stop at the intake gate until the user confirms scope.
10. Draft `01_prd.md`, then stop at the PRD gate until the user confirms P0 scope.
11. Treat new P0 work after PRD approval as a change request.
12. Complete the remaining docs in order: TRD, app flow, UI/UX brief, backend schema, implementation plan, verification plan.
13. If the request includes a full product design, wireframe atlas, onboarding system, dashboard, or visual prototype, execute `references/premium-product-atlas.md`. Compose with `component-gen` for UI construction and `browser-test` for rendered proof. Do not stop after the first attractive render.
14. Run role-based review lanes before implementation: Product Manager, Architect, Tech Lead, UI/UX Designer, Senior Developer, QA Engineer, Security Engineer, and DevOps Engineer.
15. Run the engineering modes that match the phase: Full Startup Engineering Team, Senior Codebase Audit, Production Debugging, Performance Optimization, Clean Architecture Refactor, Startup Backend Architect, AI Engineering Team, Senior Frontend Engineer, AI Technical Lead, Production Security Audit, and Senior DevOps And Deployment Engineer.
16. Resolve all block and fix-before-build findings in the specs.
17. Do not implement until every gate passes.
18. During implementation, update `progress.md` after every phase, failed check, blocker, change request, and deploy.

## Gates

- Viability (Gate 0, before all others): distribution/CAC-vs-LTV is not underwater; the core mechanism is physically buildable on the target platform (named API/primitive, or a spike that ran); no store guideline or regulation forbids the chosen architecture (quoted from the live guideline text); the wedge is reachable vs free/incumbent competitors; and the archetype is durable — not a wedge beside a platform that ships it native or a funded incumbent already owns, operable at scale without a human-judgment bottleneck (else reprice as a service). Any hard fail here stops the workflow before intake — no spec docs are drafted.
- Intake: primary v1 user, buyer/operator roles, measurable launch outcome, assumptions, open questions, and user signoff.
- PRD: P0 features map to user stories, atomic acceptance criteria, and verification methods.
- TRD: stack, runtime, package manager, lockfile, clean-checkout setup, env contract, secrets source, CI, observability, deploy, and rollback are explicit.
- App flow: reference patterns, routes, buttons, forms, states, auth behavior, first-run/returning-user routing, conversion continuity, navigation escapes, and public-write abuse handling are specified.
- UI/UX: platform-native visual system, brand provenance, complete route/role/state coverage, companion/asset rules where relevant, interaction states, actionable analytics anatomy, accessibility, responsive layouts, and inspected screenshot or prototype proof are specified.
- Schema: entities, relationships, tenant or owner scope, validation, retention, backup, and restore are specified.
- Implementation: each task maps to acceptance criteria and verification.
- Verification: tests, browser paths, screenshots, security matrix, secret scan, dependency audit, rollback rehearsal, clean checkout, and release ownership are specified.
- Agent team review: product, architecture, build, design, code, QA, security, and operations lanes have no unresolved block or fix-before-build findings.
- Engineering modes: selected mode outputs are recorded with trigger, owner, findings, required spec updates, and closure evidence.

## Rules

### Agent Execution & Determinism
- **Structural Determinism**: When processing large inputs or context for this workflow, use explicit XML tags (e.g., `<context>`, `<task>`) rather than unstructured text.
- **Blueprint Scaffolding**: Never output a final spec doc immediately. First, output a step-by-step reasoning outline. Wait for review before finalizing.
- **The Perfection Loop**: Before outputting any final spec document, establish an internal 5-criteria rubric for what constitutes a world-class output. Grade your draft, refine it, and only output when it scores 10/10.
- **Red Team Critique**: Before declaring a spec done, adopt a critical, risk-averse persona (e.g., skeptical CTO or strict PM) to flag immediate red flags and rewrite weak sections.
- **Combat Sycophancy**: Maintain absolute objectivity. If the user makes a factual error, provides a flawed premise (e.g., an unviable market wedge), or asks a leading question, you are strictly required to push back, present the counterargument, and correct the error.
- **Deep Reasoning**: For complex tasks (like Gate 0 viability), \"think hard about this\" to ensure second-order effects are considered.

### Workflow Rules

- Run Gate 0 (`0_viability.md`) before any spec doc; a hard viability fail stops the workflow — do not draft intake/PRD to "keep momentum" on a project that can't distribute, can't run, is architecturally disallowed, or is a platform/funded-incumbent trap.
- Never code before the package exists and gates pass.
- Every feature traces to story, acceptance criterion, screen/API/data, task, and verification method.
- Every acceptance criterion has exactly one primary verification method.
- Every new or changed journey cites inspected reference patterns or records why no reference source was available.
- Reference research uses specific screen or journey queries and inspects returned images; metadata, app names, and vague style searches are not visual evidence.
- A full-product atlas covers every in-scope route, role, primary state, and cross-screen handoff before polishing individual screens.
- Premium hierarchy must be legible in two seconds: one dominant value or task, one obvious primary action, restrained depth, and whitespace that groups rather than empties the page.
- Every decision-bearing chart states the question it answers and includes units, comparison context, a mapped legend, exact current-period detail, provenance/freshness, and a mobile adaptation. Decorative placeholder graphs fail the UI/UX gate.
- Every user-controlled screen has a visible escape in the first viewport: tabs for main surfaces, Back for pushed views, Close/Cancel for sheets, and Skip/Close for tutorials. Only explicit transient states may omit navigation.
- Final action buttons sit in normal content flow unless the platform pattern requires a persistent bar; fixed actions must prove they do not cover text at target device sizes.
- App controls must render like app controls, not browser links. Disable default underlines for in-app anchors/buttons; reserve underlines for prose links only when the design calls for them.
- Motion must be purposeful, short, and optional: define the animation, the trigger, the reduced-motion fallback, and the reason it helps comprehension.
- OCR, camera, import, or automation features must show a reviewable draft before creating or mutating user data.
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
- `references/premium-product-atlas.md` (load for full design, wireframe, onboarding, dashboard, or visual prototype requests)
