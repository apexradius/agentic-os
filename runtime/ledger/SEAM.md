# SEAM.md — the aorg/council ledger engine: faithful copy + coupling seam

> **What this is.** `framework/runtime/ledger/` and `framework/runtime/council/` hold a
> **faithful copy** of a live agent control-plane engine, lifted out of a host monorepo at
> Stage 4. `aorg` is a ~6.5k-line pure-stdlib monolith with **zero local imports** — it cannot
> be import-bisected into clean modules without rewriting safety-critical state-machine logic.
> So the extraction is a *copy + a documented seam*, not a refactor.
>
> **This file is the seam.** It records (1) provenance + the byte-faithful proof, (2) the rule
> that the live bin stays canonical until cutover, (3) the neutralization hunk map (every line
> this copy changed from the original, and why each is behavior-preserving), and (4) the
> irreducible residual coupling — enumerated, categorized, and gated.
>
> **Real instance values are abstracted here as `<placeholders>`** so this doc is safe to publish.
> Each adopter records the real values in their private instance zone; the Apex instance keeps them
> in `apex/config/aorg/EXTERNALIZATION-RECORD.md` (the placeholder→value legend + the full changelog).

## Provenance

| | |
|---|---|
| **Copied from** | `<monorepo>/bin/` (the live install) |
| **Copy method** | `cp` (byte-identical), proven by `diff` == empty before any edit |
| **What's here** | `ledger/{aorg, aorg-broker, aorg-broker-watchdog, aorg-watchdog, aorg-sync-loop}` + `council/{council, server.py, apex-council-mcp}` |
| **Not here** | `aorg-cost-report` (operator reporting tool, not the state machine); the operator CLIs; the policy engine — see [`POLICY-ENGINE.md`](POLICY-ENGINE.md) |

The copies were verified byte-identical to the live source (`diff -q` empty on all six) and
`py_compile`-clean (the four python bins) / `bash -n` + `zsh -n` clean (the two shell launchers)
**before** the neutralization edits below were applied. That proof is the faithfulness evidence;
after neutralization the copy intentionally diverges from the live bin exactly per the hunk map.

## The canonical-source rule (until cutover)

The **live bin** at `<monorepo>/bin/*` remains authoritative until cutover. Until then everything
here is **inert**: no `~/.local/bin` wrapper, no launchd plist, no MCP registration points at it; it
touches no live state, socket, or ledger. Cutover repoints the runtime to these paths (the adopter
records their cutover plan in their instance zone); after cutover the copy *becomes* the live control
plane. Until then, **fix bugs in the live bin first**, then re-sync the copy + update this seam.
Never let the copy silently drift (risk R2).

## Neutralization hunk map

The only coupling that is **mechanically removable without touching logic** is the env-default
config: reads of the shape `os.environ.get("VAR", "<instance default>")`. The live env always sets
these, so swapping the *default* for a neutral value is behavior-identical under the live env and
gives the framework a sane instance-free fallback. Every change below is of that class. The `Was`
column names the value-class removed; the real instance values are in the adopter record.

### `ledger/aorg`
| Was | Now | Why behavior-preserving |
|---|---|---|
| Operator-identity literals (`<operator>` name, ~30 sites + a named fn) | `OPERATOR` / `OPERATOR_EXACT` / `OPERATOR_CONTAINS` env-reads (default `"operator"`) | Instance env supplies the real name + aliases; under the live env every identity check resolves exactly as before. |
| `AORG_WORKSPACE` default `<adopter-workspace>` | default `~` | Live env always sets it; `~` is the generic fallback. |
| `AORG_VPS_MIRROR_HOST` default `<vps-target>` | default `""` | `should_mirror_vps_state()` gates on `AORG_VPS_MIRROR`/STATE==default and returns `False` off-topology — empty host never fires unconfigured. |
| `AORG_VPS_MIRROR_STATE_DIR` default `<canonical-home>/…/state` | default `""` | Only used when mirroring is enabled (host set). |
| `AORG_VPS_CANONICAL_ROOT` default `<canonical-home>/…/control-plane` | default `""` | Only used on canonical-proxy commands (require a host). |
| `AORG_VPS_CANONICAL_BIN` default `f"{ROOT}/bin/aorg"` | `… if VPS_CANONICAL_ROOT else ""` | Avoids a bogus `/bin/aorg` when root is empty. |
| `…EXPECT_STATE_OWNER`/`…GROUP` default `<canonical-user>` | default `""` | Ownership check only runs against the canonical host. |
| `SAFE_PATH_PREFIXES`: instance workspace prefixes | `*AORG_EXTRA_SAFE_PREFIXES` (`os.pathsep`-split) | Adopter supplies prefixes via env; `WORKSPACE` + tmp/var-www generics remain. |
| `PATH_HIGH_RISK_PATTERNS`: instance client/deploy globs | `*AORG_EXTRA_HIGH_RISK_PATHS` | Generic high-risk globs (`.env`, prod, `/etc`, …) remain; instance paths via env. |
| `--runner-root` argparse default `<canonical-home>/…/runner` | `os.environ.get("AORG_RUNNER_ROOT", "")` | Only used with `--enqueue-runner`. |

### `ledger/aorg-broker`
| Was | Now |
|---|---|
| `AORG_WORKSPACE` default `<adopter-workspace>` | default `~` |
| `AORG_BIN = ROOT / "bin" / "aorg"` | `AORG_BIN = Path(__file__).resolve().parent / "aorg"` (sibling-resolve) |

> Note (broker `AORG_BIN`): the broker shells out to its sibling `aorg` bin. The original computed
> `ROOT/bin/aorg`, which only resolves in the live `bin/`-nested layout; the flat framework layout
> puts the bin **beside** the broker under `ledger/`, so `ROOT/bin/aorg` → `framework/runtime/bin/aorg`
> (does not exist) and every coordination verb fails. Sibling-resolve is **byte-identical on the live
> install** (the broker lives in `bin/`, so `parent == ROOT/bin`) and correct in the framework — the
> same neutralization class as `cmd_watchdog` and council's `COUNCIL`/`AORG_BIN` sibling-resolve.
> Surfaced + reproduced + proven fixed by the cutover broker boot test (`roster`/`status` return
> through the framework copy with the live tripwire green); the adopter records the cutover detail.

### `council/council`
| Was | Now |
|---|---|
| `APEX_AI_ORG_ROOT` default `<monorepo>` | default `str(Path(__file__).resolve().parents[1])` (the runtime root) |

> Note: council resolves `AORG_BIN = ROOT/bin/aorg`; the framework layout puts the bin at
> `ledger/aorg`, so council needs `APEX_AI_ORG_ROOT` (or `AORG_BIN`) wired at cutover to actually
> run. The neutral default only removes the instance literal — zero-config council is best-effort.

### `council/server.py` + `council/apex-council-mcp` (the council MCP stdio server)

The live council MCP registration runs a pure-stdlib Python stdio server
(`<monorepo>/mcp/apex-council-mcp/server.py`, 506 lines, hand-rolled JSON-RPC 2.0, 9 tools) behind a
5-line bash launcher. The port flattens both into the `council/` dir so the held registration has a
framework target. `server.py` is a **byte-faithful copy** — `diff` vs the live source shows **only**
the 4 path-global lines below; everything else (all 9 tool defs, `run_council`, `serve`,
`handle_request`, `self_test`) is byte-identical.

| Was | Now | Why behavior-preserving |
|---|---|---|
| `ROOT` default `<monorepo>` | `str(Path(__file__).resolve().parents[1])` | Same neutral default as `council/council` → one consistent state root (`framework/runtime/state/council`). |
| `COUNCIL = ROOT/"bin"/"council"` | `Path(__file__).resolve().parent/"council"` | The flattened CLI is a **sibling** of the server (no `bin/` subdir) — same class as the `cmd_watchdog` sibling-resolve. |
| `SOURCE_ROOT = parents[2]` | `parents[1]` (the runtime root) | `--self-test` cwd; the framework has one tree, not the live source-vs-installed split. |
| `SOURCE_COUNCIL = SOURCE_ROOT/"council"/"bin"/"council"` | `COUNCIL` | One council in the framework; source == installed. |

The launcher `council/apex-council-mcp` mirrors the live 5-liner but resolves the server **relative to
its own dir** (`exec python3 "$HERE/server.py"`), so it no longer keys off `APEX_AI_ORG_ROOT` (the
*state* root, set at registration time — not the code root).

> **Known pre-existing defect (NOT a port regression):** the council CLI's own `--self-test` (the
> director prompt-injection step) fails on this machine with `FileNotFoundError` — and fails
> **byte-identically on the live council**. It is an environment/Stage-4 council-CLI selftest bug (the
> "Selftest fixtures" residual class), inherited unchanged by the faithful copy. Because `server.py
> --self-test` delegates to that broken step, the **binding acceptance for the port is the state-free
> raw-stdio probe** (initialize → serverInfo `apex-council-mcp`; tools/list == 9 tools; ping;
> council_paths resolving under a tmp root) plus a direct council **init + handoff** against a tmp root —
> both pass; broker socket mtime+pid identical throughout.

### `ledger/aorg-watchdog`
| Was | Now |
|---|---|
| `DEFAULT_RUNNER_ROOT = Path("<canonical-home>/…/runner")` (hardcoded) | `Path(os.environ.get("AORG_RUNNER_ROOT", "~/apex-runner")).expanduser()` |

### `ledger/aorg-sync-loop` (zsh launcher) & `ledger/aorg-broker-watchdog` (bash launcher)
Thin operational wrappers — genericized to resolve the engine bin **relative to the script's own
dir** and read all install-specific values from env (with neutral defaults):
- sync-loop: `AORG_STATE_DIR` now **required** (`:?`) — its whole reason to exist is to stop the
  bin falling back to repo-relative state (the split-brain it was built to prevent); a generic
  launcher can't guess it. `AORG_WORKSPACE` → `$HOME` fallback; `AORG`/watchdog → `${0:A:h}/…`; `LOGDIR` derived.
- broker-watchdog: `AORG_BROKER_LABEL` (default `aorg-broker`, was `<broker-label>`),
  `AORG_PYTHON` (default `python3`, was `<python-bin>`), `AORG_BROKER_BIN`/`PLIST`/`SOCKET`/`LOG`
  all env with script-relative / `$HOME` defaults.

### Test-port additions (instance config locations, not env-defaults)

Porting the engine's own pytest suite (below) revealed three more couplings that are *instance
config locations*. They get the same env-mediation treatment — all behavior-preserving (live env
unset → identical default).

| Was | Now | Why |
|---|---|---|
| `ROLES_FILE = ROOT / "roles.json"` | `Path(os.environ.get("AORG_ROLES_FILE", ROOT / "roles.json"))` | The roster is **instance** config. Its path is now env-driven; tests inject a generic roster, the adopter points at the live one. |
| `POLICY_DIR = ROOT / "policy"` | `Path(os.environ.get("AORG_POLICY_DIR", ROOT / "policy"))` | The allowlists are instance config (and self-protected — see [`POLICY-ENGINE.md`](POLICY-ENGINE.md)). Env-driven location; the adopter points at the live policy dir. |
| `cmd_watchdog`: `script = ROOT / "bin" / "aorg-watchdog"` | `Path(__file__).resolve().parent / "aorg-watchdog"` | The flat framework layout has no `bin/` subdir; resolve the watchdog as a **sibling** of the bin. Equivalent on live (the live bin's dir holds the watchdog too). |

The instance values for **every** env var above live in the adopter's env file (the Apex instance:
`apex/config/aorg/aorg.env.example` for the tracked placeholders, `aorg.env` for the real values).

## Tests

`ledger/tests/` ports the engine-relevant subset of the live aorg pytest suite, retargeted to this
copy (bin located via `parents[1]/aorg`; broker/VPS forced off). Run:

```
python3 -m pytest framework/runtime/ledger/tests/ -q
```

- **What's covered:** state-merge + redaction (pure-function, import-as-module), and the
  review/blind-review/user-challenge flows (subprocess, tmp state). `conftest.py` forces isolation
  (`AORG_CANONICAL_MODE=0`, `AORG_VPS_MIRROR=0`, `AORG_BROKER_DISABLE=1`) and points `AORG_ROLES_FILE`
  at a **generic** test roster (`tests/fixtures/roles.json`) — no instance roster in `framework/`.
- **Live-plane tripwire (R1):** a session fixture fingerprints the broker socket + pid (and the live
  ledger, if `AORG_TRIPWIRE_TASKS` is set) at start and asserts byte-identical at end. Verified: live
  `tasks.jsonl` mtime/size, socket mtime, and broker pid all unchanged across the run.
- **Differential / known drift:** one test (`test_blind_alias_…distinct`) asserts a 3-member blind
  pool but `FRONTIER_REVIEW_POOL = ("claude","codex")` = 2 in **both** the live bin and this copy —
  a pre-existing upstream test/code mismatch, confirmed identical via differential. It is marked
  `@unittest.expectedFailure` (not "fixed" — fixing would diverge from the live bin). Result:
  **34 passed, 1 xfailed.**
- **Excluded:** `test_council_personas` (validates the instance roster, not engine logic) and the
  policy/operator-CLI tests (those tools are referenced, not copied).

## Residual coupling (declared debt — gated)

Everything else was coupling baked into **logic or data**, not an env default. Per the approved
Stage-4 plan it was **declared coupling debt** — the engine is a faithful copy, and rewriting
host-resolution / operational playbooks inside a 6.5k-line state machine is a separate, live-bin-first
sub-slice. The residual was enumerated as a content snapshot in [`.zone-residual.allow`](../.zone-residual.allow)
and held by the gate below, then **paid down to 0** across the decoupling + CLEANUP passes: each class
was externalized to an env var / config file with a neutral default. The classes:

| Class | Where | Externalized to (neutral default) |
|---|---|---|
| Fleet topology (`TAILNET_HOSTS`, `VPS_ALIASES`, `VPS_USERS`, target builders) | `aorg-broker` | `AORG_SSH_TARGETS` → adopter `ssh-targets.json`; empty = "no known hosts" |
| Host detection (branches that detect "running on the canonical host") | `aorg` | `on_canonical_host()` / `AORG_ON_CANONICAL_HOST` + `AORG_CANONICAL_WORKSPACE` + playbook prefixes |
| Embedded operational strings (service inventory, health probes, runner repo, ssh target, launchd label, agent windows) | `aorg` | `AORG_PLAYBOOK` + `AORG_BROKER_LABEL`/`WORKSPACE`; empty = "empty playbook" |
| Billing/doctor scan-root layout (hook/code roots, doctor scan roots, `hooks_dir`, `node_bin`) | `aorg` | `AORG_PLAYBOOK` keys; empty = no extra roots (`which node`) |
| Selftest fixtures referencing the live path | `aorg` | neutral `/var/www/example/…` + `/srv/example/…` |
| Defensive secret/Q2 regexes | `aorg-broker`; `aorg` | generic `.vault` path token + generic Q2/revenue vocab |
| Council director launch dirs | `council` | `WORKSPACE` (`APEX_AI_ORG_WORKSPACE`) + `DIRECTOR_ADD_DIRS` env |
| Validator coupling arbiter | `primitives` | adopter `zone-coupling.json` via `primitives/_lib/zone-coupling.mjs`; framework ships a GENERIC default (RFC-5737 doc IPs + `example-*`) |

The per-class **history + the real instance values** are in the adopter record (the Apex instance:
`apex/config/aorg/EXTERNALIZATION-RECORD.md`). The env-var **namespace** (`APEX_<NAME>`) and the MCP
server-identity names are deliberately **not** gated — config/identity namespaces carrying no host/IP/
secret value; the values they point at ARE gated.

### The gate (risk R3 tripwire)

```
framework/runtime/verify-zone-purity.sh
```

Greps the **whole `framework/` tree** — **markdown included** — for the blocklist pattern and **fails
on any literal not already in `.zone-residual.allow`**. A new coupling literal is, by construction,
absent from the snapshot → caught. Proven: green at **0** whitelisted lines — `framework/` is fully
zone-pure; FAILs on a planted `example-corp.com` literal. `.zone-residual.allow` is an empty snapshot,
so any future coupling literal is undocumented by construction → caught. Docs are gated too: every
framework `.md` is PAT-clean as of the SEAM scrub (real values live only in the adopter zone), so a
future Apex literal landing in any `.md` now FAILs the gate the same as one in code. Only build
artifacts and snapshots are excluded — `*.bak*` because an in-tree applier backup of an engine file
would otherwise re-introduce the literals it just removed (appliers write backups outside `framework/`;
rollback is `git checkout`); `package-lock.json`/`*.tsbuildinfo` because their base64 hashes randomly
contain short blocklist substrings. Path-form tokens in the blocklist match directories only (an
agent-vault path token matches `~/<vault>/` dirs, not API-key references).

**To change the residual** (after a real externalization / leak fix): regenerate the snapshot by
mirroring the gate's OWN whole-tree scan — NOT just the engine files, because the snapshot also holds
residual lines from many non-engine files (mcp-servers, router, validators), so a narrow grep
under-produces and the gate then fails on the missing lines. From `framework/runtime/` (the script's
dir; the gate sets `SCAN_ROOT="$(cd .. && pwd)"` = `framework/`):
`grep -rhiE '<pattern>' "$SCAN_ROOT" <gate excludes> | sed -E 's/^[[:space:]]+//' | sort -u > .zone-residual.allow`
— and update the class table/notes above (and the adopter record, which now holds the per-line
history) in the same commit. The snapshot shrinking is good (debt paid); it growing requires a
justification here.

## See also
- [`POLICY-ENGINE.md`](POLICY-ENGINE.md) — why `apex-permission`/`apex-elevate`/`*.allow.toml` are
  referenced, never copied, and the gated channel if they ever must be.
- The adopter's instance zone holds the wiring + env contract and the real-value record. For the Apex
  instance: `apex/config/aorg/README.md` (wiring) and `apex/config/aorg/EXTERNALIZATION-RECORD.md`
  (the placeholder legend, hunk-map originals, and the slice-by-slice changelog).
