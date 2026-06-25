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
| [threat-model.md](threat-model.md) | The build-time security question — untrusted input meets privilege — answered before a primitive ships. |
| [reference-integrity.md](reference-integrity.md) | The framework's own links resolve and every standard is on its index — no silent doc rot. |
| [primitive-integrity.md](primitive-integrity.md) | Every primitive ships its full machinery (spec + schema + creator + validator) — no half-built primitive the harness silently skips. |
| [standard-shape.md](standard-shape.md) | The contract every standards-as-code gate obeys — node shebang, zero npm deps, parseable selftest tail. The gate that holds the gates. |

The **prompt house style** — how agent bodies are written — is a standard too, but it lives
with its validator in [`../../prompting/`](../../prompting/).

> Last reviewed: 2026-06-25
