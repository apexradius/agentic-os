# capability-bundle

Dry-run verification for installable capability bundles.

This is the LifeOS lesson Apex keeps: bundle installation must be preflighted before
anything is copied. The checker validates a bundle manifest and reports what would be
installed, created, or replaced; it never writes target files.

## Manifest Shape

```json
{
  "name": "prompt-os-strategy-pack",
  "version": "1.0.0",
  "allowed_target_roots": ["framework/", "apex/"],
  "protected_paths": ["framework/primitives/"],
  "files": [
    {
      "source": "library/strategies/proof.md",
      "target": "apex/config/prompt-router/library/strategies/proof.md",
      "type": "prompt-strategy"
    }
  ]
}
```

## Checks

- manifest name and semver are valid
- sources and targets are relative, normalized paths
- every target is under a declared allowed root
- protected paths are not targeted
- generated/runtime artifacts are not targeted
- case-insensitive target collisions fail before copy
- file `type` is one of the declared capability types
- CLI dry runs confirm source files exist beside the bundle manifest
- CLI dry runs classify each target as `create`, `replace`, or `unknown`

The JSON result includes `summary.can_apply`. It is `true` only when the manifest is
valid and every checked source/target preflight passes.

## Run

```bash
node framework/standards/capability-bundle/validate.mjs bundle.json
node framework/standards/capability-bundle/validate.mjs bundle.json --json
```

`source` paths are resolved relative to the manifest file. `target` paths are resolved
relative to the current working directory. The command stays read-only in both modes.

With no argument it runs selftests for the one-command framework harness.
