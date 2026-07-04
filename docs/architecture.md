# Architecture

Agentic OS is a portable framework for building and coordinating AI agents. The framework contains
the rules, reusable primitives, runtime machinery, and validation gates. Deployment-specific
content belongs outside the framework in an instance zone.

## System Map

```mermaid
flowchart TD
    User[Operator] --> Instance[Instance zone]
    Instance --> Runtime[runtime]
    Runtime --> Ledger[coordination ledger]
    Runtime --> Router[model/router logic]
    Runtime --> MCP[MCP servers]

    subgraph Portable framework
        Doctrine[doctrine]
        Loop[loop]
        Primitives[primitives]
        Roles[roles]
        Skills[skills]
        Standards[standards]
        Prompting[prompting]
        Coordination[coordination]
    end

    Doctrine --> Loop
    Doctrine --> Standards
    Primitives --> Roles
    Primitives --> Skills
    Coordination --> Ledger
    Standards --> Gates[validation gates]
    Runtime --> Gates
```

## Change Sequence

```mermaid
sequenceDiagram
    actor Maintainer
    participant Files as Framework files
    participant Validate as validate.mjs
    participant Purity as zone-purity gate
    participant CI as GitHub Actions

    Maintainer->>Files: Edit doctrine, primitive, role, skill, or runtime
    Maintainer->>Validate: Run validate.mjs --all
    Validate-->>Maintainer: Schema and self-test result
    Maintainer->>Purity: Run verify-zone-purity.sh
    Purity-->>Maintainer: Coupling result
    Maintainer->>CI: Push
    CI-->>Maintainer: Framework validation result
```

## Portable vs Instance Boundary

| Framework zone | Instance zone |
|---|---|
| Agent, skill, and command schemas | Private hosts and account IDs |
| Generic doctrine and standards | Client names and business context |
| Validation machinery | Secrets and credential paths |
| Role and skill templates | Local operator preferences |
| Runtime interfaces | Deployment-specific service config |

## Main Entry Points

| Need | Start |
|---|---|
| First install | [`QUICKSTART.md`](../QUICKSTART.md) |
| Contribution rules | [`CONTRIBUTING.md`](../CONTRIBUTING.md) |
| Building blocks | [`primitives/README.md`](../primitives/README.md) |
| Agent loop | [`loop/README.md`](../loop/README.md) |
| Coordination model | [`coordination/README.md`](../coordination/README.md) |
| Validation | [`primitives/_lib/validate.mjs`](../primitives/_lib/validate.mjs) and [`runtime/verify-zone-purity.sh`](../runtime/verify-zone-purity.sh) |
