# Technical Requirements Document

> Shared registers (decision log, assumptions, open questions, change requests) are maintained in `00_build_intake.md` / `01_prd.md`; log any raised here there.

## Stack Decision
- Frontend:
- Backend:
- Database:
- Auth:
- Hosting:

## Runtime And Dependency Contract
- Runtime version:
- Package manager and version:
- Lockfile policy:
- Dependency/CVE policy:
- One-command clean-checkout setup:

## Architecture Overview

## External APIs And SDKs
| System | Reason | Auth Method | Rate Limits | Failure Behavior |
| --- | --- | --- | --- | --- |

## Inbound Webhooks (if the app receives them)
| Source | Endpoint | Signature/Verification Method | Timestamp Tolerance | Replay/Idempotency Handling |
| --- | --- | --- | --- | --- |

## Environment And Secrets
- `.env.example` contract:
- Secret source mapping:
- Secret values are never written in specs:

## Auth And Authorization
- Auth provider:
- Roles:
- Tenant/client/owner scoping:
- Super-admin bypass rules:
- Negative access tests:
- Session/credential lifecycle (or delegated to auth provider): credential storage (hashing algo), session/token expiry + rotation, logout/invalidation, cookie flags (httpOnly/secure/sameSite):

## Data Fetching

## Error Handling

## Logging, Analytics, Monitoring
- Structured logs:
- Health checks:
- Error tracking:
- Alert route:
- Alert owner:
- Synthetic checks:

## Performance Constraints

## Security Constraints

## CI And Status Checks
- Lint:
- Type check:
- Unit tests:
- Integration tests:
- E2E/browser tests:
- Secret scan:
- Dependency audit:
- Required before merge/deploy:

## Deployment

## Rollback
- Code:
- Config:
- Schema:
- Data:

## Gate
- [ ] Stack is chosen and justified.
- [ ] Runtime, package manager, and lockfile policy are explicit.
- [ ] Fresh clone can bootstrap from documented commands and example env files.
- [ ] No API, SDK, or database is named without an integration reason.
- [ ] Every secret has a source and no credential value appears in repo files.
- [ ] Auth rules include protected-data scoping and negative access tests.
- [ ] CI, deploy, observability, and rollback are specified before coding.
