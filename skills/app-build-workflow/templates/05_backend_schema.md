# Backend Schema

> Shared registers (decision log, assumptions, open questions, change requests) are maintained in `00_build_intake.md` / `01_prd.md`; log any raised here there.

## Entities And Relationships
| Entity | Purpose | Owner Feature | Relationships |
| --- | --- | --- | --- |

## Tables Or Collections
| Name | Columns/Fields | Defaults | Nullability | Indexes | Unique Rules |
| --- | --- | --- | --- | --- | --- |

## Auth Mapping

## Authorization And Row-Level Rules
| Entity | Protected Action | Rule | Negative Test |
| --- | --- | --- | --- |

## Tenant/Owner Scoping

## File/Storage Model

## Validation Rules

## Data Classification
| Dataset | Classification | Retention | Export | Deletion | Backup |
| --- | --- | --- | --- | --- | --- |

## Audit Fields

## Backup And Restore
- Backup method:
- Restore test:
- Restore time:

## Seed Data

## Migration Plan

## Gate
- [ ] Every table has an owner feature.
- [ ] Every relationship names cardinality.
- [ ] Protected data has an authorization rule.
- [ ] Cross-tenant or cross-owner access has negative tests.
- [ ] No user-generated field is stored without validation.
- [ ] Logs and analytics exclude secrets and raw sensitive data unless explicitly approved and redacted.
- [ ] Schema supports every P0 flow.
- [ ] Data-bearing apps have backup and restore requirements.
