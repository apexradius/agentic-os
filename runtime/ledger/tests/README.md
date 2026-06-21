# framework/runtime/ledger/tests — engine tests for the copied aorg ledger

These tests exercise the **copy** of the aorg ledger engine in
[`../aorg`](../aorg) — not the live bin. They are the 4C exit gate: they prove the
copy still behaves, and prove it did so **without touching the live control plane**.

## Run

```sh
python3 -m pytest framework/runtime/ledger/tests/ -q
```

No install step — the engine is pure-stdlib and the subprocess tests invoke `python3` directly.
To also tripwire the live ledger file (not just the broker socket/pid), point the run at it:

```sh
AORG_TRIPWIRE_TASKS="$AORG_STATE_DIR/tasks.jsonl" \
  python3 -m pytest framework/runtime/ledger/tests/ -q
```

(`$AORG_STATE_DIR` is the install's live ledger dir — the adopter sets it in their
instance env file, e.g. an `aorg.env.example` in the instance config zone.)

## What's covered

| File | Kind | Asserts |
|---|---|---|
| `test_aorg_state_merge.py` | import-as-module (pure fns) | the last-writer-wins / append-merge state reconciliation logic |
| `test_redaction.py` | import-as-module (pure fns) | secret/PII redaction before a report is written |
| `test_user_challenge_gate.py` | subprocess + tmp state | the ≤2-ping-pong cross-review → escalate-to-human gate |
| `test_blind_review.py` | subprocess + tmp state | blind peer-review: real name retained for audit, alias sealed until reveal, distinct-real-name escalation still fires |

## Isolation (`conftest.py`)

The engine reaches the live broker / VPS only via env, so the conftest forces it inert **before any
test module imports the engine**: `AORG_CANONICAL_MODE=0` (no canonical proxy), `AORG_VPS_MIRROR=0`
(no tailnet mirror), `AORG_BROKER_DISABLE=1` (no broker transport). It also points `AORG_ROLES_FILE`
at the **generic** [`fixtures/roles.json`](fixtures/roles.json) — there is no Apex roster in
`framework/`. The subprocess tests additionally set `AORG_STATE_DIR` to a fresh tmp dir per call.

## Live-plane tripwire (risk R1)

A session-scoped autouse fixture fingerprints the live broker socket + pid (and the live
`tasks.jsonl` when `AORG_TRIPWIRE_TASKS` is set) at start, and asserts byte-identical at end. If the
isolated tests ever leaked into the live plane, the run fails loudly. Verified on the 4C run: live
`tasks.jsonl` mtime/size, socket mtime, and broker pid all unchanged.

## Known drift (differential-confirmed, not extraction-caused)

`test_blind_review.py::BlindReviewTests::test_blind_alias_subcommand_rotates_and_is_distinct` is
marked `@unittest.expectedFailure`. It asserts a **3**-member blind reviewer pool, but
`FRONTIER_REVIEW_POOL = ("claude", "codex")` = **2** in *both* the live bin and this copy — a
pre-existing upstream test/code mismatch, confirmed identical by running the same case against the
live bin (4C differential). We do **not** patch the engine to make it pass (that would diverge the
copy from live — see [`../SEAM.md`](../SEAM.md), "live canonical until Stage 6"). If the pool ever
grows to 3, this flips to an *unexpected success* and the marker comes off.

Expected result: **34 passed, 1 xfailed.**

## Excluded (deliberately)

- `test_council_personas` — validates the Apex roster, not engine logic (would need the Apex
  `roles.json` in `framework/`).
- Policy / operator-CLI tests — those tools (`apex-permission`, `apex-elevate`) are referenced, not
  copied (see [`../POLICY-ENGINE.md`](../POLICY-ENGINE.md)).

---

> Last reviewed: 2026-06-19
