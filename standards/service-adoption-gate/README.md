# service-adoption-gate

Deterministic scanner for the service-adoption standard. It catches deployment defaults that are
too dangerous to inherit from third-party repos, self-hosted apps, browser automation bundles, or
container examples.

## What It Checks

- Docker images using `latest` or no tag.
- Host Docker socket mounts.
- `privileged: true`.
- `SYS_ADMIN`.
- `seccomp=unconfined`.
- Browser `--no-sandbox`.
- Weak or fixed default secrets in env-like settings.
- Protected cookies set without explicit `secure` and `sameSite`.

## What It Does Not Check

- Whether the product is strategically worth adopting.
- Whether a license permits commercial or multi-tenant use.
- Whether a privileged container is justified by a full threat model.
- Whether runtime network egress is safe.

Those require human review and, for live adoption, a written threat model.

## Usage

```bash
node framework/standards/service-adoption-gate/gate.mjs docker-compose.yml .env.example
node framework/standards/service-adoption-gate/gate.mjs --json path/to/service
node framework/standards/service-adoption-gate/validate.mjs
```

The gate is zero-dependency and intentionally structural. It is designed to catch unsafe defaults
early, before deployment files are copied into an instance runtime.
