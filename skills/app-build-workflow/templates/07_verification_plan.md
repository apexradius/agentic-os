# Verification Plan

> Shared registers (decision log, assumptions, open questions, change requests) are maintained in `00_build_intake.md` / `01_prd.md`; log any raised here there.

## Acceptance-Criteria Verification Matrix
| AC | Evidence Type | Command/Path | Expected Result | Status |
| --- | --- | --- | --- | --- |

## Agent Team Review Closure Matrix
| Lane | Finding | Severity | Closure Evidence | Status |
| --- | --- | --- | --- | --- |

## Engineering Mode Closure Matrix
Debugging (reproduction · root cause · regression proof), Performance (baseline · after · delta), and Refactor (behavior-preservation tests) must appear as rows when triggered. Security and DevOps closure evidence lives in the Security Test Matrix and Observability Proof / Rollback Rehearsal / Post-Launch sections below — reference those, do not duplicate.
| Mode | Finding | Required Evidence | Observed Evidence | Status |
| --- | --- | --- | --- | --- |

## Commands
- Lint:
- Type check:
- Unit:
- Integration:
- E2E:

## Browser Smoke Paths

## Screenshot Requirements
- Mobile:
- Desktop:

## Visual QA Matrix
| Surface | Reference Route / Screen | Checks | Tool / Path | Observed Result |
| --- | --- | --- | --- | --- |

Required visual checks:
- Navigation escape visible on every user-controlled screen.
- No unintended text, icon, or symbol underlines in app controls.
- No fixed or sticky action covers body text, fields, or cards.
- Header, title, subtext, icon, button, and trailing-value alignment holds at target sizes.
- Companion/mascot asset, if used, matches the canonical source across app icon, prototype, and in-app UI.
- Motion is short, purposeful, and disabled or simplified under reduced motion.
- Permission prompts occur only at the user-initiated moment and have a recovery path.
- OCR/import/automation flows produce a review state before mutation.
- The dominant task or value and primary action are identifiable within two seconds.
- Every chart labels units, maps each series, names the comparison window, exposes exact current-period detail, and identifies source/freshness.
- Mobile charts adapt controls and callouts without unreadable text or document-level horizontal overflow.
- Screenshots are captured after page transitions and animations settle, not during a dimmed or intermediate state.
- Browser proof checks every in-scope route for console errors, page errors, and horizontal overflow.

## Accessibility Checks

## Security Test Matrix
Enumerate every attack surface as a row: each user-controlled input, each server-side URL/fetch (SSRF), each file upload, each inbound webhook/callback. Each cell records the attempted attack + observed result, or `N/A` with a one-line reason — never blank.
| Surface | SQLi | XSS | CSRF | SSRF | File Upload | Auth Bypass | Rate Limit | Webhook (Sig/Replay) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Secret Scan
- Tracked files:
- Untracked files:
- Config files:
- `.env` files:
- Git history:

## Dependency/CVE Audit

## Database Migration Check

## Backup And Restore Test

## Observability Proof
- Health check:
- Structured logs:
- Error tracking:
- Alert route:
- Synthetic check:

## Rollback Rehearsal
- Code:
- Config:
- Schema:
- Data:

## Clean-Checkout Setup Test

## Release Readiness
- Environment:
- Go/no-go criteria:
- Rollback owner:
- Alert owner:
- Support owner:

## Post-Launch Validation Window
- Duration:
- Checks:
- Owner:

## Gate
- [ ] Every P0 acceptance criterion has observed evidence.
- [ ] Every block or fix-before-build review finding is closed or explicitly waived.
- [ ] Every selected engineering mode has closure evidence.
- [ ] Visual QA matrix has observed proof for target device sizes.
- [ ] Screenshot/prototype proof covers first-run, returning-user, paywall/continuation, main navigation, dense forms, permissions, and companion/help states when in scope.
- [ ] CI passes or waiver is approved.
- [ ] Security matrix lists every input, server-side fetch, upload, and inbound webhook as a row; every cell is an observed result or justified `N/A` (no blanks).
- [ ] Secret scan is clean.
- [ ] Dependency audit has no unwaived critical/high issues.
- [ ] Rollback or restore is rehearsed where state can change.
- [ ] Clean-checkout setup works.
- [ ] Release owner, rollback owner, alert owner, and support owner are named.
