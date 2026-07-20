---
skill: backend-platform
---
# Eval: backend-platform

A failing-baseline eval — without the skill the agent reaches for microservices + Kubernetes by default, chains
sync calls, and treats secrets/observability as afterthoughts; with it, the agent defaults to monolith-first,
decouples sync chains, centralizes secrets + auth, deploys immutable, and instruments the three pillars.

## Baseline
Prompt the agent **without** the backend-platform skill loaded:

> "We're building the backend for a new SaaS — small team, pre-launch. How should we architect it, structure
> the services, and deploy it so it can scale?"

Observed baseline failure: the agent recommends "go microservices from the start for scalability, put each
domain in its own service, use Kubernetes, have services call each other over REST, use a shared database, and
set up CI/CD." Premature microservices for a pre-PMF small team; synchronous service chaining (cascade risk);
no idempotency; secrets/observability unmentioned; mutable deploys (`latest`); no monolith-first reasoning.

## Pass
With the backend-platform skill loaded, the agent:
- Defaults to a **monolith or PaaS** for a pre-PMF small team — splits to microservices only at real
  org-scaling pain, never prematurely.
- Prefers **async/event-driven** over sync chaining (one slow downstream saturates the pool → cascade), with
  **backoff on retries**; makes state-changing ops **idempotent**.
- Keeps the **API contract a single source of truth** (OpenAPI in the API repo), gateway-centralized versioning,
  disciplined status codes.
- Centralizes **secrets in a vault** (never in git; base64 ≠ encryption; dynamic short-lived creds) and
  **authN/authZ at the edge**; shifts security left (SAST/SCA/secret-scan) + hardens containers (non-root,
  pinned digests, resource limits).
- Deploys **immutable** (multi-stage Docker + pinned digests, trunk-based CI/CD + feature flags, Terraform with
  remote locked state, no out-of-band GUI drift).
- Instruments the **three pillars** (metrics/logs/traces, central aggregation, probes, SLOs, self-healing
  reconciliation) and names a likely **failure class** (cascading sync / config drift / retry storm).
- Cites `[BE <id>]`, flags vendor claims as illustrative, and defers app-code/distributed-theory/DB-internals/
  testing/compliance as gaps.

## Rubric (score each 0-2; pass ≥ 12/16)
1. Monolith/PaaS-first for a small pre-PMF team; microservices deferred to real scaling pain.
2. Async/event-driven over sync chaining; retries with backoff; idempotent state ops.
3. API contract single-source-of-truth + gateway versioning + status-code discipline.
4. Secrets in a vault (not git; base64≠encryption; dynamic creds); edge authN/authZ.
5. Shift-left security (SAST/SCA/secret-scan) + container hardening + supply-chain pinning.
6. Immutable deploys: pinned digests (not `latest`), resource limits, locked IaC state, no GUI drift.
7. Three-pillar observability + probes + SLOs + self-healing reconciliation; a failure class named.
8. Cites `[BE <id>]`; vendor claims illustrative; app-code/distributed-theory/DB-internals/testing/compliance gaps not fabricated.

**Fail** if the output is "microservices from day one, Kubernetes, services call each other over REST, shared
DB, set up CI/CD" — i.e. premature-microservices, sync-chained, secrets/observability-absent, mutable-deploy,
indistinguishable from the no-skill baseline.

## Results — 2026-07-19 (first execution)
Solvers: claude-sonnet-5 subagents (mirrors production agents); grader: claude-opus-4-8 subagent vs rubric with per-item evidence; spot-checked by session lead.

| Arm | Score | Verdict |
|---|---|---|
| Baseline (no skill) | 6/16 | FAIL — monolith-first instinct present, but zero secrets discipline, zero shift-left security, zero deploy immutability, zero citations |
| With skill | 16/16 | PASS — full spine: vault + edge auth, SCA/secret-scan/container hardening, pinned digests + locked IaC, three-pillars observability, dense [BE] citations |

Delta +10 — lift concentrated exactly where the baseline is blind (both arms already knew monolith-first; the 2026 baseline has absorbed that headline).
