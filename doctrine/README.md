# framework/doctrine — the law

Doctrine is **law**: the non-negotiable rules and quality standards every agent obeys, on
every task, regardless of who asks or what's convenient. Doctrine holds no state and no
code — knowledge is state (held in the adopter's instance zone), machinery is code
([`primitives/`](../primitives/)).

Two shelves:

- **[`rules/`](rules/)** — the hard rules. Things you must, and must never, do.
- **[`standards/`](standards/)** — the quality bar. How good "done" has to be.

## Reading order

| Read this | When |
|---|---|
| [rules/root-cause.md](rules/root-cause.md) | A bug, error, or regression appears |
| [rules/decision-making.md](rules/decision-making.md) | You're unsure, blocked, or about to ask a question |
| [rules/anti-patterns.md](rules/anti-patterns.md) | Always — these are the failure modes that erode trust |
| [rules/delegation.md](rules/delegation.md) | Before dispatching a sub-agent |
| [standards/excellence.md](standards/excellence.md) | Before deciding what "good enough" means |
| [standards/communication.md](standards/communication.md) | Before writing a response to the user |
| [standards/design.md](standards/design.md) | Any UI, frontend, or document surface |

The **process** that applies this law — Plan → Implement → Verify, the artifact gates, the
verification gates — is [`../loop/`](../loop/). The **prompt house style** is
[`../prompting/`](../prompting/). How agents work together is [`../coordination/`](../coordination/).

## The no-bloat contract (how this framework is built)

The framework earns the right to exist by staying small. Six rules govern every file:

1. **Every file teaches or works.** Complexity is *added*, never inherent — so any file that
   does neither is deleted. Justify what you add.
2. **Doctrine is law, knowledge is state, code is machinery — never in one file.** Mixing
   them is the original sin that bloats a system: you can no longer change one without
   risking the others.
3. **Spec + schema + creator + validator for every primitive.** Prose alone isn't enough; a
   primitive the machine can't check is a primitive that drifts. (See [`../primitives/`](../primitives/).)
4. **Single source per artifact, synced to where runtimes load it.** No symlinks, no second
   hand-maintained copy. One thing is true; everything else is a generated mirror.
5. **Reference external products, don't absorb them.** Point to a repo in a registry; never
   vendor its bloat into this tree.
6. **Commit source, gitignore artifacts. Secrets live in a secrets manager, never a file.**

> Last reviewed: 2026-06-19
