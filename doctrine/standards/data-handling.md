# Data-Handling Standard

The [tool-gate](tool-gate.md) guards what goes *into* a tool call. This standard guards what an agent
writes *out* — into logs, evidence files, reports, artifacts, the knowledge base, and error messages.
Output is the seam where secrets and personal data leak, precisely because writing them out feels like
description, not disclosure.

## The bar

- **Secrets never reach durable output.** API keys, tokens, passwords, connection strings, private
  keys — none belong in a log line, a committed file, a report, or an error message. A secret's home
  is an environment variable or a secrets manager, read at point of use and never echoed.
- **Never echo a secret to stdout.** When a command needs a secret, capture it into a variable; don't
  let it land in output that a transcript, a CI log, or an evidence capture will preserve. A secret
  printed once is a secret to rotate.
- **Redact before you write.** Any writer that persists agent-visible state — an evidence collector, a
  report generator, a log sink — runs its content through redaction first. Redaction at write time is
  structural; "remember not to include it" is not.
- **Minimize personal data.** Carry only the personal data the task needs, only as long as it needs it.
  Don't fold names, contacts, or identifiers into durable knowledge or logs when an opaque reference
  would do.

## Why a standard, not a reminder

A single leaked token is an incident: rotate it, treat its exposure window as compromised, and scrub
every place it landed. The defense that actually holds is mechanical — a redaction pass wired into the
writers, the way [design.md](design.md) wires a critic into the surface it guards — not an agent
resolving, under context pressure, to be careful. State the bar here; enforce it in the runtime's
output path.

> Last reviewed: 2026-06-24
