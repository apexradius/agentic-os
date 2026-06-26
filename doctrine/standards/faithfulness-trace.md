# Faithfulness Trace Standard

A closeout claim is not complete until it points to evidence. "Done", "verified",
"passes", "deployed", and similar claims must map to the command, tool call, artifact,
or observed output that proves the statement.

The executable gate is in
[`framework/standards/faithfulness-trace/`](../../standards/faithfulness-trace/). It
checks the artifact shape; review still judges whether the evidence is sufficient.

## Required shape

A closeout trace records a list of claims. Each claim carries:

- `claim`: the done statement being made.
- `evidence.type`: `tool`, `command`, `artifact`, or `observed-output`.
- `evidence.ref` / `evidence.command` / `evidence.tool`: the pointer that lets another
  agent inspect the proof.
- `evidence.observed`: the result summary actually observed.
- `evidence.timestamp`: when the evidence was captured.

## Why this exists

Agent failure often happens at the last step: the system says work is complete based on
intent, memory, or a plan instead of observed reality. A faithfulness trace makes the
gap visible. If a claim cannot be mapped to evidence, the correct closeout is not
"done"; it is "not verified" with the missing proof named.

## Boundary

The framework standard is portable and deterministic. It does not store screenshots,
logs, or transcripts, and it does not call external services. Instances decide where
trace artifacts live and how much supporting evidence to retain.

> Last reviewed: 2026-06-25
