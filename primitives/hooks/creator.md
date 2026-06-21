# Creator: how to add or change a hook

> The SOP for registering a hook. Read [`spec.md`](spec.md) first — especially the two-layer
> split: this primitive checks the entry shape; the runtime I/O contract is a separate gate.

## Author the hook

1. **Write the script** under the runtime's hook dir (`.claude/hooks/<name>.sh` /
   `.codex/hooks/<name>.py`). It must obey the **runtime I/O contract**: read the event JSON
   from stdin, write any decision JSON to stdout, exit `0` to allow / `2` to block, and **fail
   open** (errors exit 0 — never wedge the agent). Reference `${CLAUDE_PROJECT_DIR}` /
   `${CLAUDE_PLUGIN_ROOT}`, never an absolute path.
2. **Register it** in the `hooks` block of the config (`.claude/settings.json` or
   `.codex/hooks.json`): pick the event, set a `matcher` if it's tool-scoped, add a hook entry
   with `type` (`command`/`prompt`), the `command`/`prompt`, and a `timeout` ≤ 600.

## Verify (both layers — the gate)

```bash
# Layer 1 — entry shape (this primitive):
node framework/primitives/hooks/validate.mjs ~/.claude/settings.json
node framework/primitives/hooks/validate.mjs --selftest

# Layer 2 — runtime I/O contract (deferred, but still required for "done"):
python3 <path>/validate-codex-hook-runtime.py .claude/hooks/<name>.sh
```

A hook is done only when **both** layers pass. A green entry shape with a broken I/O contract
is a hook that loads and then misbehaves — exactly the failure this split exists to surface.

## Constraints

- Don't register a hook whose script doesn't yet pass the runtime check.
- Don't set a `timeout` over 600s (the runtime cap) — the validator warns; the runtime clamps.
- Keep event names current — an unknown event warns (it may be a typo, or newer than the
  validator's known set; confirm against the runtime docs before dismissing the warning).

## Reference implementation

Prior art worth reading (referenced, not imported): `validate-codex-hook-runtime.py` (the
runtime I/O contract checker this primitive defers to) and the plugin-dev hook skill's
`hook-linter.sh` / `validate-hook-schema.sh` under the official plugins marketplace — they
lint the script body (shebang, `set -euo pipefail`, stdin read, exit codes) the layer below.
