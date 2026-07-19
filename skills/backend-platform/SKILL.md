---
name: backend-platform
description: Backend platform + infrastructure architecture — API design (OpenAPI single-source-of-truth, REST-vs-GraphQL, gateway versioning, status codes, idempotency), data layer (SQL-vs-NoSQL by workload, replicas, migrations-as-jobs, pooling, cache-invalidation), auth/security (edge authN/authZ, service-mesh mTLS, secrets never in git, shift-left scanning, container hardening, supply-chain pinning), architecture (monolith-before-microservices, async over sync-chaining, gateway north-south + mesh east-west, horizontal scaling), infra/deploy (multi-stage Docker + pinned digests, K8s Deployments/StatefulSets + resource limits, trunk-based CI/CD + feature flags, Terraform no-drift, twelve-factor), and reliability (metrics/logs/traces, probes, SLOs, self-healing). Use when designing/reviewing a backend platform, API contract, deploy pipeline, or scaling/reliability decision. NOT app-code craft (ORM/transactions), NOT distributed-systems theory (consensus/CAP), NOT DB internals — the platform-engineering layer.
user-invocable: true
context: fork
argument-hint: [backend platform / API / deploy / scaling decision]
---

## What this skill is

A backend-platform partner distilled from a **Backend & Infrastructure** corpus (cloud-native / platform-
engineering, 2024–2026). It turns platform discipline into an executable loop so a model doing backend/infra
work pulls the right rule and *actions* it: keeps the API contract a single source of truth, defaults to a
monolith until real scaling pain, decouples sync chains before they cascade, centralizes secrets and auth at
the edge, pins everything immutable, and instruments the three observability pillars — instead of premature
microservices, retry storms, config drift, and plaintext creds in git.

Load the depth file — don't guess: `references/knowledge-base.md` (api-design, data-layer, auth-security,
architecture, infra-deploy, reliability-observability, failures — each rule cited `[BE <id>]` with an explicit
skew + gaps note).

**Scope caveat (baked into the KB):** the *platform-engineering* layer (containers, K8s, service mesh, IaC,
CI/CD, observability, gateway/API-contract discipline) + the transferable backend principles (idempotency,
monolith-first, async decoupling, secrets hygiene). **Thin/absent (don't fabricate):** app-code craft (ORM
patterns, transaction isolation, request-validation), distributed-systems theory (consensus/CAP, exactly-once/
DLQ semantics beyond Kafka basics), specific-DB internals (Postgres planner, index types), backend testing, and
compliance frameworks (SOC2/PCI/GDPR). Corpus is **tutorial/podcast + vendor-sponsor** provenance — treat
vendor-specific claims (Zuplo, Honeycomb, Valkey) as illustrative and numbers as directional.

## When to load
- Designing/reviewing an API contract or gateway (versioning, status codes, idempotency).
- A data-layer decision (SQL-vs-NoSQL, replicas, migrations, pooling, caching).
- An architecture call (monolith-vs-microservices, sync-vs-async, scaling, mesh vs gateway).
- A deploy-pipeline / IaC / container-hardening decision, or a reliability/observability gap.

## The workflow

Run the stages relevant to the task — each cites a rule from the KB (§ + `[BE <id>]`).

### 1 — API AS A SINGLE SOURCE OF TRUTH (§api-design)
Establish a machine-readable **OpenAPI contract in the API's own repo** (duplicating it into gateway configs
invites schema drift). Pick REST or **GraphQL** to the client need; centralize **versioning at the gateway**
(config stored as version-controlled code). Use **status codes with discipline** (429 at the edge, 502
upstream-dead, 503 cold-start) and make **every state-changing op idempotent** (run once or 100× → same
end-state). Strip path prefixes at the ingress, not in app code.

### 2 — DATA LAYER TO THE WORKLOAD (§data-layer)
Choose **SQL-vs-NoSQL by workload** (NoSQL for extreme spiky write throughput), and beware **database sprawl**
+ fragile sync jobs. Route reads to **secondary replicas**; run **migrations as one-off jobs before the app
deploy**; instantiate **connection pools** (a fixed HTTP-worker pool saturates in seconds if the DB slows). If
you cache, you **must** design invalidation + expiration + network-drop handling or risk corruption.

### 3 — SECURE AT THE EDGE + EAST-WEST (§auth-security)
Centralize **authN/authZ at the edge gateway** so policy/rate-limits run before any backend. Namespaces are
**not** security boundaries — east-west needs a **service mesh (mTLS + least-privilege intentions)**. **Never
hardcode secrets** (plaintext in git history) — centralize in a vault, prefer **dynamic short-lived** creds; K8s
Secrets are **base64, not encryption**. **Shift security left** (SAST/SCA/secret-scan/DAST in CI), **harden
containers** (never root, distroless, resource limits), and **pin the supply chain** (lockfiles/digests; keep
agents read-only + human-in-the-loop for writes).

### 4 — ARCHITECT FOR THE STAGE, DEPLOY IMMUTABLE (§architecture, §infra-deploy)
**Monolith/PaaS before microservices** — split only at real org-scaling pain, never pre-PMF. Prefer
**async/event-driven** over sync chaining (one slow downstream saturates the pool → cascading freeze).
**Gateway = north-south, mesh = east-west.** Scale **horizontal > vertical**. Deploy immutable: **multi-stage
Docker + pinned digests (never `latest`)**, **K8s Deployments/StatefulSets with resource requests+limits**,
**trunk-based CI/CD + feature flags**, **Terraform with remote locked state and no out-of-band GUI changes**
(that's drift), twelve-factor config.

### 5 — MAKE IT OBSERVABLE & SELF-HEALING (§reliability-observability, §failures)
Instrument the **three pillars** (metrics/logs/traces with context propagation); **aggregate logs centrally**
(shippers can silently drop ~50% at scale — never SSH into ephemeral pods). Map **readiness/liveness probes**
to the right port. Treat services with **SLOs + blameless postmortems**. Build **self-healing as idempotent
reconciliation** (observe → compare → correct). And name the failure classes: **cascading sync**, **retries
without backoff** (highway pileup), **premature optimization/microservices**, **config drift**, **silent
failures**.

## Output contract
Return, in order:
1. **API/contract** — the single-source-of-truth + versioning + idempotency decision.
2. **Data** — the SQL/NoSQL + replica/migration/pooling/cache call.
3. **Security** — edge authN/authZ, mesh mTLS, secrets posture, shift-left + hardening.
4. **Architecture + deploy** — monolith-vs-microservices, sync-vs-async, and the immutable-deploy/IaC plan.
5. **Reliability** — the observability + probe + self-healing plan, and the failure class most likely to bite.

## Constraints (what NOT to do)
- **Never split to microservices pre-PMF or for a small team** — monolith/PaaS first; split only at real scaling pain.
- **Never chain sync calls without decoupling** — one slow downstream cascades; prefer async/event-driven + backoff on retries.
- **Never hardcode secrets or commit K8s Secrets** — base64 ≠ encryption; vault + dynamic short-lived creds; scan pre-commit.
- **Never deploy mutable** — pin digests (never `latest`), set resource limits, use remote locked IaC state, no out-of-band GUI changes.
- **Never duplicate the API schema into gateway configs** — one source of truth in the API repo, or drift.
- **Never cache without an invalidation/expiration/error plan, or run a fat build image** — multi-stage + cache design.
- **Never SSH into pods for logs or run agents with write access unattended** — central aggregation; read-only + HITL.
- **Never fabricate app-code craft, distributed-systems theory, DB internals, testing, or compliance depth** — absent from the corpus; defer.

## Verify (executable acceptance)
- [ ] API contract is a single source of truth with gateway-centralized versioning + idempotent state ops + disciplined status codes.
- [ ] Data-layer call fits the workload with replicas/migrations-as-jobs/pooling, and any cache has an invalidation plan.
- [ ] Auth/secrets are edge-centralized + mesh mTLS + vault/dynamic creds + shift-left scanning + container hardening + supply-chain pinning.
- [ ] Architecture defaults to monolith-before-microservices and async-over-sync; deploys are immutable (pinned digests, resource limits, locked IaC state).
- [ ] Observability covers the three pillars + probes + SLOs + self-healing, and the top failure class is named.
- [ ] Every claim cites `[BE <id>]`; vendor claims flagged illustrative; numbers directional; app-code/distributed-theory/DB-internals/testing/compliance gaps not fabricated.
