---
name: client
description: "Full client lifecycle — onboard, scope, estimate, propose, contract, build, audit, handoff. End-to-end project management. Use when starting a client project, or /client."
user-invocable: true
argument-hint: "[client-name] [project-type]"
---

# Client — End-to-End Project Management

From first contact to delivered project with documentation.

## Phase 1: Intake
- Gather: business name, type, goals, timeline, budget
- Create CRM entry via the current client pipeline skill after live source verification
- Classify project: website, Shopify store, marketing, SEO, custom dev

## Phase 2: Scope & Estimate
- Decompose into features (must-have / should-have / nice-to-have)
- Size each feature (XS/S/M/L/XL hours)
- Add buffers: 20% unknowns + 30% communication + 10% QA
- **Output**: Scope document with timeline + cost breakdown

## Phase 3: Proposal
- Professional proposal document:
  - Executive summary
  - Scope of work (deliverables, exclusions)
  - Timeline with milestones
  - Pricing (fixed or hourly with cap)
  - Payment schedule (milestone-based)
  - Terms and conditions
- Generate via `/pdf-gen` for professional delivery

## Phase 4: Contract
- Service agreement covering:
  - Scope, deliverables, timeline
  - Payment terms, late fees
  - IP ownership, licensing
  - Revision policy (N rounds included)
  - Termination clause
  - Liability limitation
- Review via `/contract-review` for compliance

## Phase 5: Build (routes by project type)
| Type | Primary Flow |
|------|-------------|
| Astro website | `/launch-site` |
| Shopify theme | `/launch-theme` |
| Shopify store | `/launch-theme` + `/shopify-store` |
| Marketing campaign | `/campaign` |
| SEO optimization | `/audit` + fixes |
| Brand identity | `/brand-kit` + `/create` |

## Phase 6: Quality
- Run `/audit` on deliverable (standard tier minimum)
- Fix all critical and high-priority issues
- Run `/qa` on interactive elements
- Document known limitations

## Phase 7: Handoff
- Final deployment via `/release` or `/deploy-verify`
- Generate handoff documentation:
  - Access credentials
  - How to edit content
  - Maintenance guide
  - Support contact
- Draft handoff email via `/email-draft`
- Update CRM status to "Delivered"

## Project Tracking
Throughout all phases, use `/plan` (medium level) to maintain:
- `task_plan.md` — current phase and progress
- `progress.md` — work log
- `findings.md` — client requirements and decisions
