---
name: client-launch
description: "End-to-end client project — onboarding, proposal, contract, CRM entry, brand kit, site build, audit, handoff. Orchestrates 10+ skills. Use when running a full client engagement, or /client-launch."
user-invocable: true
argument-hint: "[client-name] [project-type]"
---

# Client Launch — Full Client Project Pipeline

From initial contact to delivered project with documentation.

## Orchestrated Skills
1. `/client-onboard` → Intake questionnaire, requirements gathering
2. `/client-onboard` -> Create lead in the current client pipeline
3. `/proposal-gen` → Generate project proposal with scope and pricing
4. `/contract-review` → Review/generate service contract
5. `/brand-kit` → Brand identity (if new brand or rebrand)
6. `/launch-site` OR `/launch-theme` → Build the deliverable
7. `/full-audit` → Pre-handoff quality check
8. `/scheduled-report` -> Track project state in the current client pipeline
9. `/deploy-verify` → Final deployment verification
10. `/email-draft` → Client handoff email with documentation

## Workflow

### Phase 1: Intake (client-onboard + client pipeline)
- Gather client requirements (business type, goals, timeline, budget)
- Create CRM lead in the current client pipeline after live source verification
- Set project status to "Discovery"

### Phase 2: Proposal (proposal-gen + contract-review)
- Generate proposal from requirements
- Include scope, deliverables, timeline, pricing
- Generate or review service contract
- Reference: `/contract-review` for legal compliance

### Phase 3: Project Setup (client pipeline)
- Convert lead to active project in the current client pipeline
- Set milestones and payment schedule
- Create project communication channel

### Phase 4: Build (branch based on project type)
**If website**: `/launch-site [project] [niche] [domain]`
**If Shopify theme**: `/launch-theme [theme] [niche]`
**If Shopify store**: `/launch-theme` + `/shopify-store`
**If marketing**: `/campaign [brand] [product] [goal]`

### Phase 5: Quality (full-audit)
- Run complete audit on deliverable
- Fix all critical and high-priority issues
- Document any known limitations

### Phase 6: Handoff (deploy-verify + email-draft)
- Final deployment verification
- Generate handoff documentation:
  - Login credentials and access points
  - How to edit content
  - Maintenance guide
  - Support contact info
- Draft handoff email to client
- Update client-pipeline project status to "Delivered"

## Project Types
| Type | Primary Skills | Timeline |
|------|---------------|----------|
| Astro website | launch-site | 1-2 weeks |
| Shopify theme | launch-theme | 1-2 weeks |
| Shopify store | launch-theme + shopify-store | 2-3 weeks |
| Marketing campaign | campaign | 1 week |
| SEO optimization | full-audit + aeo-optimize | 3-5 days |
| Brand identity | brand-kit + ai-image | 2-3 days |
