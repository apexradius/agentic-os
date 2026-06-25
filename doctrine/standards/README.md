# doctrine/standards — the quality bar

[Rules](../rules/) are binary; standards are the bar the work must clear. "Done" means it
cleared these — not that it merely ran.

| Standard | Sets the bar for |
|---|---|
| [excellence.md](excellence.md) | What "good" means — the Prime standard, scoring, the frontier ladder. |
| [communication.md](communication.md) | How you write to the user — output discipline. |
| [design.md](design.md) | Any UI, frontend, or document surface. |
| [data-handling.md](data-handling.md) | What an agent writes *out* — secrets and PII never reach durable output. |
| [tool-gate.md](tool-gate.md) | What an agent *runs* — allow / ask / deny on a tool call before it executes. |
| [ci.md](ci.md) | How every repo handles CI, secret scanning, and pre-commit — without drift. |
| [context-budget.md](context-budget.md) | Keeping the living handoff fresh as the context window fills. |
| [session-discipline.md](session-discipline.md) | Making the PIV planning phase structural — no edit without a plan. |
| [observability.md](observability.md) | Making the framework's own runs measurable — the run-record. |
| [versioning.md](versioning.md) | The promise an update makes to consumers — SemVer where "breaking" = a green instance turning red. |
| [learning.md](learning.md) | Turning accumulated run evidence into reviewed change — without an autonomous self-modifying loop. |

The **prompt house style** — how agent bodies are written — is a standard too, but it lives
with its validator in [`../../prompting/`](../../prompting/).

> Last reviewed: 2026-06-25
