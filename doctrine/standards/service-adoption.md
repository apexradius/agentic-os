# Service Adoption Standard

Any third-party service, self-hosted app, container bundle, browser automation stack, or
deployment template must be made safe before it can enter an instance runtime. A repo being popular
or open source is not a deployment argument.

## The Bar

- Images are pinned by version or digest; untagged images and `latest` are not acceptable.
- The host Docker socket is not mounted into application containers.
- Containers do not run privileged, with `SYS_ADMIN`, or with `seccomp=unconfined` unless a
  threat model names the blast radius and the mitigation.
- Browser automation does not use `--no-sandbox` in production paths.
- Secrets, tokens, passwords, and service keys are supplied by the instance secret system or
  environment, not fixed defaults in deploy files.
- Session cookies are set with explicit `secure` and `sameSite` attributes on protected surfaces.
- Risky operations that touch money, customer data, credentials, or outbound communications have a
  human approval gate.

## Non-Goals

This standard does not decide whether a product is strategically worth adopting. It only blocks the
deployment failure class where an unsafe default becomes a live operating assumption.

## Verification

Use [`../../standards/service-adoption-gate/`](../../standards/service-adoption-gate/) to catch the
deterministic portion of this standard in compose files, env examples, shell commands, and common
cookie-setting code.

> Last reviewed: 2026-06-30
