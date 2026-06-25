# doctrine/rules — the hard rules

Things you must do, and things you must never do. Unlike [standards](../standards/) — which
set how *good* the work must be — rules are binary: a rule is either kept or broken.

| Rule | One line |
|---|---|
| [root-cause.md](root-cause.md) | No fix without understanding why it broke. |
| [decision-making.md](decision-making.md) | Find the answer before asking; declare assumptions before acting. |
| [anti-patterns.md](anti-patterns.md) | The recurring failure modes — never do these. |
| [delegation.md](delegation.md) | Sub-agents start cold; verify before and after. |
| [reversibility.md](reversibility.md) | Classify blast radius before acting; irreversible earns ceremony. |
| [idempotency.md](idempotency.md) | A retried step must converge — twice lands the same state as once. |

> Last reviewed: 2026-06-24
