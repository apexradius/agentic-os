<!--
DROP-IN README TEMPLATE — Apex repo-readme standard.
Copy into a repo's README.md, then replace every <PLACEHOLDER> and every diagram
with the repo's real components. Keep the section order. Keep it ≤250 lines.
The Mermaid blocks below are real, valid, and render on GitHub — adapt, don't delete.
-->

# <Repo Name> · <one-line value prop>

<Two sentences: what it is, and the one problem it removes. No marketing.>

```bash
<the single command to install or run it>
```

---

## 🧭 Choose your path

| You are… | Start here | Time |
|---|---|---|
| 🚀 New here | [Setup](#-setup-5-min) → [First run](#first-run) | ~5 min |
| ⚡ Daily user | [Architecture](#-architecture) · [Workflows](#-workflows) | ~15 min |
| 🧠 Extending it | [docs/architecture.md](docs/architecture.md) · [docs/reference/](docs/reference/) | varies |

---

## 🏗️ Architecture

> 💡 How the pieces connect. Drill-down lives in [docs/architecture.md](docs/architecture.md).

```mermaid
flowchart TD
    User([User]) -->|request| API[API Gateway]

    subgraph Edge
        API --> Auth{Authenticated?}
    end

    Auth -->|no| Reject[401 Reject]
    Auth -->|yes| Svc[Core Service]

    subgraph Backend
        Svc --> Queue[(Job Queue)]
        Svc --> DB[(Postgres)]
        Queue --> Worker[Worker Pool]
        Worker --> DB
    end

    Svc -->|events| Hook[Webhook Dispatch]
    Hook --> Ext[External Systems]
```

**Components**
- **API Gateway** — <one line per box; name the real module/path>
- **Core Service** — `src/<…>`
- **Worker Pool** — `src/workers/<…>`

---

## ⏱️ Setup (5 min)

> ⏱️ Zero to first run.

1. **Install**
   ```bash
   <install cmd>
   ```
2. **Configure** — copy `.env.sample` → `.env`, fill `<KEYS>`. (Secrets via the team's secrets manager — never commit `.env`.)
   ```bash
   cp .env.sample .env
   ```
3. **Run**
   ```bash
   <run cmd>
   ```

<a id="first-run"></a>
**First run** — you should see `<expected output>`. If not, see [Troubleshooting](#-faq).

---

## 🔄 Workflows

> 💡 The main path through the system, end to end.

```mermaid
flowchart TD
    Start([Trigger]) --> Validate{Input valid?}
    Validate -->|no| Err[Return 400 + reason]
    Validate -->|yes| Process[Process]
    Process --> Persist[(Persist)]
    Persist --> Notify[Emit event]
    Notify --> Done([200 OK])
```

### Request lifecycle (who calls whom)

```mermaid
sequenceDiagram
    actor User
    participant API
    participant Service
    participant DB as Postgres
    participant Hook as Webhook

    User->>API: POST /resource
    API->>Service: validate + route
    Service->>DB: write
    DB-->>Service: row id
    Service->>Hook: emit created event
    Service-->>User: 201 Created
```

### Status lifecycle

```mermaid
stateDiagram-v2
    [*] --> Pending
    Pending --> Active: approved
    Pending --> Rejected: denied
    Active --> Completed: finished
    Active --> Failed: error
    Failed --> Active: retry
    Completed --> [*]
```

---

## 🗄️ Data model
<!-- Keep only if the repo has a database. Otherwise delete this section. -->

```mermaid
erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : "appears in"
    USER {
        uuid id PK
        string email
    }
    ORDER {
        uuid id PK
        uuid user_id FK
        string status
    }
```

---

## 📚 What's inside

| Path | What it holds |
|---|---|
| `src/<…>` | <core logic> |
| `docs/architecture.md` | Full architecture + drill-down diagrams |
| `docs/reference/` | API reference, config, changelog |
| `.claude/` | Agent config — commands, hooks, agents |

---

## ❓ FAQ

**<Common failure>?** — <fix in one line.>
**<Common question>?** — <answer.>

---

## 🔗 Reference

- [Architecture deep-dive](docs/architecture.md)
- [Configuration](docs/reference/config.md)
- [Changelog](docs/reference/changelog.md)
