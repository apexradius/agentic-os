# Executable Orchestration Manifests

An orchestration manifest is the portable plan for a multi-agent DAG. It is not a
chat transcript and not a task ledger replacement. It is the runnable contract that
says which nodes exist, who owns them, what each node depends on, which files it may
touch, how it is validated, what artifact it emits, and where recovery resumes.

The executable shape gate is
[`../standards/orchestration-manifest/`](../standards/orchestration-manifest/).

## Required manifest shape

```json
{
  "id": "release-hardening",
  "nodes": [
    {
      "id": "validator-hardening",
      "owner": "codex",
      "depends_on": [],
      "files_owned": ["framework/standards/session-discipline/validate.mjs"],
      "validation_command": "node framework/standards/session-discipline/validate.mjs",
      "output_artifact": "reports/validator-hardening.md",
      "resume_key": "validator-hardening"
    }
  ]
}
```

## Rules

- Node IDs are unique.
- Dependencies must point at existing node IDs.
- The graph must be acyclic.
- Every node declares an owner.
- Every node declares owned files or an explicit empty list.
- Every node declares a validation command.
- Every node declares its output artifact.
- Every node declares a resume key stable enough to recover after interruption.

## Relationship to the ledger

The ledger tracks live ownership and status. The orchestration manifest is the planned
DAG before execution and the recovery map during execution. A runtime may project the
manifest into ledger tasks, but the manifest itself remains a portable artifact.

## Boundary

The framework defines the contract and validates the graph. It does not schedule
workers, spawn agents, run validation commands, or persist state. Those are instance
runtime responsibilities.

> Last reviewed: 2026-06-25
