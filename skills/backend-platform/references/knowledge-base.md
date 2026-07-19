# Backend & Infrastructure — Knowledge Base

> Source: NotebookLM notebook "Backend & Infrastructure — Knowledge Base" (128 sources). Citation scheme: `[BE <id>]` where `<id>` = 8-char prefix of the NotebookLM source UUID. Every bullet traces to a returned source; no un-cited claims.
>
> **CORPUS SKEW (read first):** This is a **cloud-native / platform-engineering (DevOps)** corpus, not an application-backend one. Dominant weight: Kubernetes, containers, service mesh, API gateways, IaC, CI/CD, observability. Provenance is overwhelmingly **YouTube-tutorial + podcast transcripts** (conversational: "let's dive in", "skill number one") — practitioner narrative, not spec/textbook. Vendor-flavored throughout: Zuplo, Honeycomb, HashiCorp Vault, MongoDB Atlas/RavenDB (sponsor reads), Railway, DigitalOcean, KEDA. Languages skew Go + Node.js (some Python/Scala). Numbers below are **directional source claims**, not benchmarks.

## §api-design
- Establish a machine-readable **OpenAPI 3.0** contract (title, version, servers, every endpoint + params + response schema); generate code from schema or schema from code [BE 77c8a749].
- **Single source of truth:** keep the OpenAPI schema in the API's own repo; duplicating it into gateway configs invites "schema drift" [BE 77c8a749].
- REST maps resources to HTTP verbs + explicit paths; API **management gateways** (Zuplo) target REST — schema parsing, dev portals, versioning, monetization [BE 77c8a749]. **GraphQL** = one endpoint, schema auto-introspected, three ops (query/mutation/subscription), enables fully-typed "deny-by-default" client-server channel [BE 6b1bea6b][BE 67bc3913].
- **Versioning follows client-distribution model:** installed/mobile apps must support multiple versions in the wild; continuously-deployed web/SaaS keeps one latest hosted version [BE f4498b96]. Centralize versioning at the gateway to evolve backends without breaking consumers; store gateway config as version-controlled code (PR-reviewable, roll-back-able) [BE 77c8a749].
- **Status codes:** 200 success; 404 missing resource; 429 rate-limited at edge (body should follow RFC problem-details JSON) [BE 77c8a749][BE b93b2a3b]; 500 unhandled backend exception; 502 proxy up but upstream dead; 503 cold-start / zero live instances [BE 35d0c386][BE b5a77dcf][BE 5a53e5f7].
- **Idempotency is non-negotiable for state-changing ops:** same action run once or 100× yields the same end-state, no duplicate resources [BE 6dc080c6].
- Decouple routing from backends: strip path prefixes at the ingress/proxy layer (middleware), not in app code [BE b5a77dcf][BE 66ce5652].
- **Gap flagged in-corpus:** pagination is named as a standard REST feature but sources give **no** concrete rules (params, cursors) [BE 8e725d93].

## §data-layer
- **SQL vs NoSQL is workload-driven:** choose NoSQL (Cassandra) for extreme write throughput under spiky "hockey-stick" load [BE b79b4c5a]. Modern apps run a **heterogeneous mix** (primary SQL + NoSQL + cache) — beware "database sprawl" and fragile sync jobs; unified/document platforms (MongoDB Atlas, RavenDB) consolidate to avoid it [BE f4498b96][BE fb4028a0][BE 3d1b98d2].
- SQL schema is driven by app objects (tables, typed columns) [BE 01c6f5ea][BE b5a77dcf]. For high-cardinality telemetry, **drop schemas/indexes** entirely and use a columnar store where every dimension is auto-indexed [BE 88ddf250].
- **Query perf:** unoptimized patterns cause catastrophic full-table scans (source cites a "5x full table scan" incident) [BE 88ddf250]; target p95 query < 1s to keep debuggers in flow [BE 88ddf250]; route reads to **secondary replicas** to stop hammering the primary's oplog [BE 86168ea7].
- **Migrations** run best as one-off Kubernetes **Jobs** (golang-migrate / drizzle-kit packaged in a container) executed before the matching app deploy; automate local bootstrap via make/task scripts [BE b5a77dcf][BE 6b1bea6b][BE 4bbf8dbf].
- **Connection pooling:** app clients instantiate a pool (Node/Go); in-cluster DBs can use operators (CloudNativePG → PgBouncer). A **fixed HTTP-worker pool saturates in seconds** if the DB slows [BE b93b2a3b][BE b5a77dcf][BE 88ddf250].
- **Caching (Redis/Valkey):** serve hot reads from memory to cut DB load + cost, but you MUST design cache-invalidation, expiration, and network-drop error handling or risk corruption [BE 72780883]. DigitalOcean replaced managed Redis with Redis-compatible Valkey [BE 7a8ffcec].

## §auth-security
- **AuthN** = verify identity (human, pod, CI runner); **AuthZ** = permitted action. Centralize both at the **edge gateway** so policies/rate-limits run before any request reaches a backend [BE dfb41044][BE 77c8a749].
- Namespaces/routing are **not** security boundaries; east-west security needs a service mesh enforcing **mTLS** + "Intentions" (service-level firewall, least-privilege lateral traffic) [BE b5a77dcf][BE 86d5f98a]. Kubernetes API access via ServiceAccounts + **RBAC** (Roles namespaced, ClusterRoles cluster-wide) with least-privilege verbs [BE b5a77dcf].
- **Secrets:** never hardcode creds in source/config/IaC/wiki — leaves plaintext in git history [BE dfb41044][BE 3d1b98d2]. Centralize in Vault/Secrets Manager (encrypt at rest + in transit); prefer **dynamic short-lived** creds per app; encrypt PII via "encrypt-as-a-service" before DB write [BE dfb41044]. Kubernetes Secret values are only **base64, not encryption** — don't commit; use External Secrets Operator or Sealed Secrets/SOPS [BE b5a77dcf][BE 66ce5652]. Env vars carry config but use placeholder syntax (`${VAR}`), never raw creds; inject Docker build secrets via `--mount=type=secret` so they never bake into image layers [BE 2232ebe9][BE 48bfcec3][BE b93b2a3b].
- **AI/LLM keys:** an AI gateway isolates provider keys centrally; devs get one virtual key with $/token budgets to stop compromised code draining funds [BE 77c8a749][BE 5ac0bcec].
- **TLS:** mesh sidecars (Envoy) enforce mTLS with zero app-code change; terminate north-south TLS at your own NGINX/ingress; **avoid "flexible TLS"** (encrypted to CDN, plaintext to origin) for sensitive data [BE 86d5f98a][BE b93b2a3b][BE b5a77dcf].
- **Shift security left** in CI: SAST (Bandit → injection/XSS), SCA (dependency CVEs), secret-scanning pre-commit (GitLeaks), DAST (mock injection on running app), triage in a central dashboard (DefectDojo) [BE 3d1b98d2][BE 4f716bbe].
- **Container hardening:** never run as root (breakout = host root); pin minimal/distroless base images to shrink CVE surface; set CPU/mem limits to prevent DoS starvation [BE b93b2a3b][BE f2ca007b].
- **Supply chain / agentic:** pin deps to lockfiles/commit hashes (npm hijacks, e.g. Axios, inject into pipelines) [BE aba1d7d3]; MCP/agent connections risk prompt-injection + tool-poisoning — keep agents **read-only, human-in-the-loop for any write/exec** [BE 924a4d3e][BE 8bf7c466][BE 876ebd3e][BE c90b5ff3].

## §architecture
- **Monolith** kills distributed-systems complexity but hits "dependency hell" + merge friction as teams grow [BE 9d30ba49][BE b93b2a3b]. **Split to microservices** only at real org-scaling pain (teams stepping on each other) or divergent resource footprints — **never prematurely**; small teams / pre-PMF should use a monolith or PaaS [BE 9d30ba49][BE 2232ebe9][BE 9e7796b6][BE 84f6f4e6].
- **Sync chaining = cascading failure:** one slow downstream saturates the HTTP worker pool and freezes the whole chain [BE 4e869998][BE 88ddf250]. Prefer **async / event-driven** to decouple [BE 72780883].
- **Kafka** persists events to disk (replayable, multi-consumer), scales via **partitions**, parallelizes via **consumer groups** with built-in failover — vs. brokers that delete on consume [BE 4e869998][BE 01c6f5ea].
- **Gateway = north-south only.** East-west service-to-service belongs to a **service mesh** (sidecar proxies, transparent mTLS, per-service Intentions, cross-cluster mesh-gateway failover) — routing internal traffic through a gateway just adds latency [BE 77c8a749][BE 86d5f98a].
- **Scaling:** horizontal (replicas across nodes) > vertical (hardware-bound, single point of failure); layer load balancing — edge L4 LB → internal L7 reverse proxy/ingress (NGINX) → cluster Services (stable virtual IP over ephemeral pods) [BE 72780883][BE 66ce5652][BE 8a0f75c8][BE 48ef7a52]. KEDA scales on real queue depth/request rate and can go **to zero** (HTTP interceptor buffers requests during cold start) [BE 5a53e5f7].

## §infra-deploy
- **Docker:** image = read-only blueprint, container = ephemeral instance. Use **multi-stage builds** (fat builder → tiny runtime, GB→MB); **pin immutable tags/digests, never `latest`**; combine RUN layers; mount secrets at runtime [BE b93b2a3b][BE f2ca007b][BE 62c7d928].
- **Kubernetes:** Pod = smallest unit (shared netns/localhost); never run naked pods — wrap in **Deployments** (stateless, rolling updates, rollback) or **StatefulSets** (stable identity + dedicated volume for DBs); always set resource **requests + limits** (over-limit mem → OOMKill); apply **NetworkPolicies** for zero-trust segmentation [BE b5a77dcf][BE 9d1a36af][BE 4587da33][BE 66ce5652].
- **CI/CD is the orchestrator** — all test/build/scan/deploy flows through pipelines, not laptops [BE 48ef7a52]. Adopt **trunk-based dev** (small commits to main daily) over long-lived Git-flow branches; ship dark behind **feature flags** [BE f4498b96][BE 86ead67e][BE 88ddf250]. Optimize: fail-fast ordering, dependency/layer caching, parallel matrix jobs [BE 4bbf8dbf][BE b5a77dcf].
- **Environments:** enforce dev/staging/prod **parity** via IaC; decouple config from code (ConfigMaps/Secrets); spin up **ephemeral per-PR environments** for realistic pre-merge testing [BE acac77fd][BE 4587da33][BE a2c9b870][BE 9a498fa6].
- **IaC (Terraform):** declarative HCL (say *what*, not step-by-step); **never commit state** — encrypted remote backend + state locking; use reusable modules; **never make out-of-band GUI changes** (creates drift; next apply reverts) [BE acac77fd][BE 461a862c].
- **Twelve-Factor:** declare/isolate deps, config in env, backing services as attached resources, strictly separate build/release/run, export via port binding [BE 48bfcec3][BE 48ef7a52][BE 4587da33].
- **Autoscaling:** HPA on CPU/mem (basic) → KEDA on real metrics (queue depth, p-latency); Cluster Autoscaler/Karpenter for node scaling; scale-to-zero needs an HTTP interceptor to hold requests during cold boot until readiness passes [BE b5a77dcf][BE 5a53e5f7][BE 4a6a4a4c].

## §reliability-observability
- **Three pillars:** metrics (numeric, but aggregate-at-write discards context), logs (granular events), traces (one transaction across service hops via spans + W3C `traceparent` context propagation) [BE acac77fd][BE 88ddf250][BE efbdb3f1][BE 8aaa9f64].
- **Logs:** at scale, standard shippers deadlock and silently drop up to **50%** — decouple with dumb lightweight uploaders → durable storage (S3) → async parser workers; **aggregate centrally** (ELK/Cloud Logging), never SSH into ephemeral pod filesystems [BE 94b18953][BE b5a77dcf][BE 4a6a4a4c].
- **High cardinality** (user/session/txn IDs) chokes relational + metrics stores → use schema-less **columnar** engines that index every dimension for sub-second slicing [BE 88ddf250][BE 7232cbee]. Manual instrumentation + sampling (tail/adaptive) manage cost on custom business logic [BE efbdb3f1].
- **Probes:** readiness gates traffic until initialized; liveness restarts hung pods; map probes to the exact internal app port or trigger false crash-loops [BE 66ce5652][BE b5a77dcf].
- **SLOs / culture:** treat internal services as client-provider with SLAs; measure SLIs (latency, error budget) for data-driven decisions; run **blameless postmortems** [BE 94b18953][BE 88ddf250][BE 7232cbee][BE fc73e81c].
- **Self-healing = idempotent reconciliation loops** (observe → compare → correct, safe on repeat) [BE 6dc080c6]; a read-only AI assistant can pull logs/metrics/traces on alert to cut MTTR [BE 712454d5][BE 86ead67e].

## §failures
- **Cascading failure / sync trap:** tight-coupled sync HTTP saturates the worker pool → system-wide freeze; retry storms compound it [BE 4e869998][BE 88ddf250][BE efbdb3f1].
- **Premature optimization:** engineering for 100x before it's needed wastes time/money — fix the *current* bottleneck for ~10x [BE 67bc3913].
- **Premature microservices:** distributed complexity before PMF; monolith/PaaS is superior for small teams [BE 88ddf250][BE 9e7796b6].
- **Retries without backoff:** immediate/continuous retries → retransmit storms that saturate buffers and halt traffic ("highway pileup") — stagger/back off [BE 62860804].
- **Silent failures:** deadlocked agents drop 50% of telemetry with no error; ignoring unhandled-error paths lets crashes go unmonitored [BE 94b18953][BE 4437c483].
- **Resource starvation:** cramming stateful services + tooling into one cluster → pod eviction / OOM kills [BE c31ec053][BE b5a77dcf].
- **Configuration drift:** out-of-band GUI edits + unpinned versions + tiny config typos (stray comma, key misspelling) silently break deploys — reuse app structs to generate config [BE 461a862c][BE cb09f339].
- **Over-engineering:** "cloud-provider-in-a-box" (metrics/storage/logging control planes all forced inside Kubernetes); force-fitting simple needs into rigid data models with multi-stage translation [BE c31ec053][BE e91b6ebb].

## Gaps / honest caveats
- **Application-code craft is thin:** no depth on ORM patterns, transaction isolation levels, ACID internals, request-validation libraries; pagination explicitly uncovered [BE 8e725d93].
- **No distributed-systems theory:** no consensus (Raft/Paxos), no CAP/PACELC, no queue-delivery semantics (exactly-once, dead-letter queues) beyond Kafka basics.
- **No specific-DB internals:** nothing on Postgres planner, index types (B-tree/GIN/BRIN), vacuum, or data-modeling/normalization theory.
- **No compliance frameworks:** SOC2/PCI/GDPR unaddressed beyond a single Vault PII-encryption mention; no formal threat-modeling methodology.
- **Backend testing near-absent:** unit/integration/contract testing barely appears; "verify" mostly means probes + pipeline scans.
- **Provenance caveat:** tutorial/podcast transcripts + sponsor reads → practitioner heuristics and vendor pitches, not vendor-neutral primary specs. Treat vendor-specific claims (Zuplo, Honeycomb, Valkey) as illustrative, not authoritative.
