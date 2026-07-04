# App Flow

> Shared registers (decision log, assumptions, open questions, change requests) are maintained in `00_build_intake.md` / `01_prd.md`; log any raised here there.

## Route Map
| Route | Purpose | Auth State | Owner Story |
| --- | --- | --- | --- |

## Screen Inventory
| Screen | Purpose | Empty | Loading | Error | Success |
| --- | --- | --- | --- | --- | --- |

## Primary User Journey

## Secondary Journeys

## State Matrix
- Empty states:
- Loading states:
- Error states:
- Auth states:

## Button And Form Behavior
| Element | Action | Success | Failure | Validation |
| --- | --- | --- | --- | --- |

## Navigation Rules

## Notifications And Confirmations

## Public Write Surfaces And Abuse Handling
| Surface | Rate Limit | Lockout/Challenge | Abuse Handling | Verification |
| --- | --- | --- | --- | --- |

## CSRF Decisions
| State-Changing Route | CSRF Strategy | Verification |
| --- | --- | --- |

## Gate
- [ ] Every route has a purpose.
- [ ] Every button has a destination, mutation, or dismissed state.
- [ ] Every form has validation, success, and failure behavior.
- [ ] Every state-changing browser route has a CSRF decision and verification.
- [ ] Every public write surface has rate-limit, lockout, or abuse handling.
- [ ] Dead ends are intentional.
