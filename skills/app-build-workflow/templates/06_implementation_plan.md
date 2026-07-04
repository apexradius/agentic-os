# Implementation Plan

> Shared registers (decision log, assumptions, open questions, change requests) are maintained in `00_build_intake.md` / `01_prd.md`; log any raised here there.

## Build Phases
| Phase | Goal | Dependencies | Exit Evidence |
| --- | --- | --- | --- |

## File Ownership And Expected Changes
| Area | Files | Owner | Notes |
| --- | --- | --- | --- |

## Agent Team Review Findings
| Lane | Finding | Severity: block/fix/advisory | Owner | Status |
| --- | --- | --- | --- | --- |

## Engineering Mode Ledger
| Mode | Trigger | Owner | Findings | Required Spec Updates | Closure Evidence |
| --- | --- | --- | --- | --- | --- |

Pre-seed these rows when the mode is triggered (their required artifacts have no other home in the package):
| Mode | Required Closure Artifacts |
| --- | --- |
| Production Debugging | reproduction · root cause · regression proof |
| Performance Optimization | baseline · after · delta |
| Clean Architecture Refactor | behavior-preservation tests (pre-move) |

(Security and DevOps closure evidence live in the Security Test Matrix and Observability/Rollback/Post-Launch sections of `07_verification_plan.md` — reference, do not duplicate.)

Required modes to consider:
- Full Startup Engineering Team
- Senior Codebase Audit
- Production Debugging
- Performance Optimization
- Clean Architecture Refactor
- Startup Backend Architect
- AI Engineering Team
- Senior Frontend Engineer
- AI Technical Lead
- Production Security Audit
- Senior DevOps And Deployment Engineer

## Task List
| Task | Acceptance Criteria | Files | Model/Effort | Verification |
| --- | --- | --- | --- | --- |

## Dependency Ordering

## CI Jobs And Required Status Checks

## Test Plan Per Phase

## Verification Command Per Acceptance Criterion
| AC | Command/Path | Expected Result |
| --- | --- | --- |

## Migration Order And Rollback Notes

## Deployment Steps

## Rollback Steps
- Code:
- Config:
- Schema:
- Data:

## Known Risks

## Final Demo Script

## Gate
- [ ] Tasks are sequenced by dependency.
- [ ] Each task maps to acceptance criteria.
- [ ] Each task has verification.
- [ ] Block and fix-before-build review findings are closed or waived.
- [ ] Engineering mode findings are recorded with closure evidence.
- [ ] CI requirements are defined before merge/deploy.
- [ ] First build slice creates a runnable skeleton.
- [ ] Last slice proves the user journey end to end.
