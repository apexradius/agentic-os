# Adversarial Review Standard

An adversarial review is not a second summary. It is a deliberate search for ways the
work could be wrong while still sounding plausible.

## Required Failure Modes

Every clean-pass review must explicitly check these failure modes:

- `hallucinated-surface` — cites files, commands, APIs, data, or behavior that do not exist.
- `plausible-but-wrong` — gives an answer that fits the story but contradicts evidence.
- `silent-fallback` — hides an unavailable tool, skipped check, or degraded path.
- `scope-drift` — claims work outside the requested or owned boundary.
- `fabricated-verification` — says a check passed without a command, tool call, or observed output.
- `confident-staleness` — treats stale memory, docs, or model knowledge as current truth.

## Evidence Bar

Findings need evidence. A review artifact may record no findings, but only when it also
records clean-pass coverage over all required failure modes. Evidence can be a command,
tool call, artifact pointer, or observed output summary. A finding with only a confident
note is not a finding; it is another unverified claim.

The executable gate lives in [`../../standards/adversarial-review/`](../../standards/adversarial-review/).
