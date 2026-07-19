# App Flow

> Shared registers (decision log, assumptions, open questions, change requests) are maintained in `00_build_intake.md` / `01_prd.md`; log any raised here there.

## Route Map
| Route | Purpose | Auth State | Owner Story |
| --- | --- | --- | --- |

## Reference Pattern Ledger
| Source | Flow Or Screen | Pattern Observed | Adopt / Adapt / Reject | Reason |
| --- | --- | --- | --- | --- |

## Screen Inventory
| Screen | Purpose | Empty | Loading | Error | Success |
| --- | --- | --- | --- | --- | --- |

## Primary User Journey

## First-Run, Returning, And Recovery Routing
| User State | Detection Signal | First Screen | What Is Skipped | Recovery If Uncertain |
| --- | --- | --- | --- | --- |

## Conversion Continuity (Reciprocity & Momentum)
- The "Goal-Gradient" Start (How does the first screen show progress >20%?):
- Pre-Signup Investment (IKEA Effect: what does the user customize/create before signing up?):
- Real product action before account/payment (Reciprocity: what free value is delivered first?):
- Account creation moment (Lazy Registration / Smart Defaults):
- Paywall moment (Is there a visual timeline and transparency bias?):
- Cancel / restore / billing recovery:
- Continuation after payment or cancellation (Deep-linking back into the container):

## Secondary Journeys

## State Matrix (Edge Cases)
- Empty states (Must include a simple illustration, 2-3 actionable tips, and a primary CTA button):
- Loading states:
- Error states (No error codes/jargon. Plain language with a direct recovery shortcut):
- 404 / Recovery (Apologetic, light copy with a back-home CTA and alternative suggestions):
- Auth states:

## Companion / Coach / Assistant Behavior
- Persona:
- Canonical asset source:
- Local/offline behavior:
- Page-specific hints:
- Contextual explainers:
- Motion states:
- Safety boundaries:

## Button And Form Behavior
| Element | Action | Success | Failure | Validation |
| --- | --- | --- | --- | --- |

## Navigation Rules
- Main surfaces:
- Pushed details:
- Sheets/modals (Must include a visible Cancel or Back button - "Emergency Exits"):
- Tutorials/walkthroughs:
- Explicit transient states:

## Notifications And Confirmations

## Public Write Surfaces And Abuse Handling
| Surface | Rate Limit | Lockout/Challenge | Abuse Handling | Verification |
| --- | --- | --- | --- | --- |

## CSRF Decisions
| State-Changing Route | CSRF Strategy | Verification |
| --- | --- | --- |

## Gate
- [ ] Every route has a purpose.
- [ ] Every new or changed journey cites inspected reference patterns or records the fallback source.
- [ ] Every button has a destination, mutation, or dismissed state.
- [ ] Every form has validation, success, and failure behavior.
- [ ] First-run, returning-user, uncertain, offline, and recovery routes are explicit.
- [ ] Account/payment gates preserve user context and resume the same task afterward.
- [ ] Every user-controlled screen has a visible escape in the first viewport.
- [ ] Every state-changing browser route has a CSRF decision and verification.
- [ ] Every public write surface has rate-limit, lockout, or abuse handling.
- [ ] Dead ends are intentional.
