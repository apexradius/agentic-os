# cost-budget

A cumulative token/cost budget guard — the spend-side sibling of [`context-budget`](../context-budget/).
Where the context guard reads the transcript's **last** `message.usage` (a snapshot of window
occupancy) and keeps the handoff fresh, this guard reads the **sum** of every assistant message's
usage (a monotonic, never-resetting cumulative meter) and gates runaway spend. Same file, same
field, different fold.

## What it does

Two tiers, both fail-open:

| Tier | Event | Behaviour |
|---|---|---|
| **WARN** | `UserPromptSubmit` | Once used crosses `warn%` of the ceiling, injects a one-line advisory (tokens used / ceiling / %, plus a `$`-estimate when a price map is configured). Never blocks. |
| **HARD** | `PreToolUse` | Once used ≥ ceiling, **denies only the expansion tools** (sub-agent dispatch: `Task`/`Agent`, plus any configured expensive tools). The finish-and-verify path — reads, edits, `Bash`, commit, the handoff — stays fully open. |

A run that is over budget can still **land its current unit safely**; it just cannot **start new
expensive work**. The gate never hard-stops the session, and unlike the handoff gate it does not
"release" (you cannot un-spend) — it holds until the session ends or the budget is raised.

## What "cost" means here

We are subscription-only (no per-token billing). So:

- **Enforcement is on tokens** — total processed tokens (`input + cache_read + cache_creation +
  output`), the honest count of what the model chewed through. Real, in-hand, enforceable live
  from the transcript.
- **`$` is an estimate, reported only** — "what would this have cost at published list prices."
  Never an enforcement trigger. The price map is **instance config** (prices drift; this framework
  ships none). The `$` derivation is **per-category**: `cache_read` is billed at roughly a tenth of
  the input rate, so a single-bucket `$` would be an order-of-magnitude lie. The transcript
  preserves the 3-way input split per message; the central span layer collapses it into one
  `tokens_in`, so **`$` is derived from the transcript, not the spans table**.

## The meter (O(new bytes), not O(transcript))

The cumulative meter keeps a running per-model category sum + a byte-offset watermark in a session
sidecar (`~/.claude/session-env/<session_id>/cost-budget.json`) and re-reads only the delta window
each call — the watermark pattern `apex-agent-telemetry.py` proves. A single API message occupies
multiple transcript lines (same `message.id`, `output_tokens` grows), so the meter **dedups by
`message.id`, last-wins** — the same key the span emitter dedups on. The still-growing tail message
is never committed; the watermark rewinds to its start so it is counted once at its final value. A
corrupt/missing sidecar or a shrunk/rotated transcript triggers one full rescan, then a rewrite.

## Budget declaration (the effort-budget seam)

The ceiling is resolved by a ladder — first hit wins; none ⇒ unbounded ⇒ inert:

1. session sidecar `cost-budget.json` → `"budget_tokens"` — **an orchestrator (e.g. per-node
   effort budgets under the model-tier-routing standard) writes this per dispatched node**; no
   gate change needed.
2. env `COSTGUARD_SESSION_TOKENS` — the session default.
3. none ⇒ no ceiling ⇒ fail-open/silent.

Enforcement scope is **per-session** (the transcript sum is what is measurable in-hook). Per-agent
and per-task roll-ups are a reporting concern off the central spans table, not an in-hook gate.

## Porosity (read this before trusting the deny set)

`Bash` is deliberately in the finish-and-verify allow set. A determined session can therefore still
spawn expensive work through it (`claude -p`, `curl` loops, a shell that re-invokes a model).
**This is a budget guardrail, not a security boundary** — it stops the honest-mistake runaway
(a loop that keeps dispatching sub-agents), not an adversary. Do not mistake the deny set for
containment.

## Fail-open discipline

A broken budget gate must never block real work. The guard denies **only** on a positively-measured
`used ≥ a positively-declared ceiling`; absent either signal it is inert. Any error, unknown event,
missing `session_id`, unreadable transcript, or absent budget ⇒ exit 0, no decision.

## Instance configuration

| Env | Meaning | Default |
|---|---|---|
| `COSTGUARD_SESSION_TOKENS` | hard ceiling, total processed tokens | `0` (unbounded) |
| `COSTGUARD_WARN_PCT` | warn advisory threshold, percent of ceiling | `70` |
| `COSTGUARD_DISPATCH_TOOLS` | csv of tools denied at the hard tier | `Task,Agent` |
| `COSTGUARD_PRICE_MAP` | path to an instance JSON price map for the `$`-estimate | (none) |

Wire it via [`examples/settings.json`](examples/settings.json) (`PreToolUse` + `UserPromptSubmit`).
The price map is `{ model: { input, cache_read, cache_creation, output }, default?: {…} }` in `$`
per 1,000,000 tokens — the shipped [`fixtures/price-map.json`](fixtures/price-map.json) is
**synthetic** (selftest only), never real list prices.

An instance may deploy the hook as a rebranded copy into its own hook dir; a
`cost-budget.manifest.json` (discovered by the validator) then names the deployed path + the
env-var rebrand map, and the selftest asserts the deployed copy is byte-identical to this framework
hook modulo the rebrand — closing the copy-drift gap `context-budget` currently leaves open.

## Verify

```
node validate.mjs
```

Structural + JS-unit checks always run; python-dependent integration checks skip cleanly if
`python3` is absent; the parity check passes vacuously on a bare clone. The core proof — a synthetic
over-budget transcript denies `Task`/`Agent` while allowing `Read`/`Bash`, and an under-budget one
allows dispatch — is the plan's "synthetic over-budget run halts" bar, executable.
