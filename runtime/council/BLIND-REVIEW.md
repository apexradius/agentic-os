# Council blind peer-review — shipped feature reference

> Generic council-governance capability (zone-pure). Reduces sycophancy in the Council's
> cross-review by blinding reviewer identity and measuring the effect. Personas shape each
> reviewer's lens; blinding overlays aliases over (never erases) the permanent audit trail.

## What shipped (verified 2026-06-23)

- **Personas** (`roles.json` v2): each frontier role carries
  `persona{alias,temperament,value_priority,domain_bias,adversarial_mandate}`. The council prompt
  loader renders a `**Persona:**` line and keeps the `**Signature:** [name+model]` audit line.
- **Blind primitives** (`ledger/aorg`): `alias_registry(round_id, members)` seals an alias map at
  `STATE/blind/{round_id}.json`; pseudonyms rotate by `hash(round_id+role)`. `FRONTIER_REVIEW_POOL`,
  `reviewer_pool(exclude_author)`, `pick_blind_reviewers(author,k)`; `other_frontier` kept as a
  back-compat shim. `--blind` on `aorg review` stores `reviewer_alias` AND the real `reviewer` +
  `blinded=True`; `aorg blind-alias --round R` prints the rotating map.
- **Sealed phase + reveal** (`council/council`): directors write sealed per-item contributions; the
  `reveal-item <id>` subcommand concatenates them once all active directors submit and stamps
  `reveal_at`.
- **MCP exposure** (`council/server.py`): `council_submit` records a director's SEALED (blind)
  contribution; `council_reveal_item` performs the reveal. (`council_record` is the open-vote path.)
- **Dissent metric** (`council_dissent_metric.py`): pure read of `STATE/tasks.jsonl`; dissent =
  `decision != pass` OR `challenge`; segmented by `review.blinded`. Emits
  `{blinded_dissent_rate, unblinded_dissent_rate, n_blind, n_open, ...}`.

## Load-bearing invariants

- **Audit trail immutable** — real `reviewer`, name-stamped approvals/dissents, and the signature
  line stay on the permanent record under real identity. Blinding never deletes them.
- **Challenge gate counts REAL names** — the ≥2-distinct-challenger escalation keys on real
  `reviewer`, never the alias (two aliases of one model must not falsely escalate).
- **Persona-strip on blind delivery** — a blind review-task body carries only the rotating
  `Reviewer-X` pseudonym and is stripped of the author's alias/signature/persona text (no de-anon by
  fingerprint over a small pool).
- **Opt-in only** — `--blind`, `AORG_BLIND_REVIEW=1`, and the sealed phase default OFF; existing
  flows are unchanged until the metric shows an effect and Ayo flips them.

## Verify

```sh
cd framework/runtime/ledger/tests && python3 -m pytest test_blind_review.py test_user_challenge_gate.py -q
AORG_STATE_DIR=~/.local/state/aorg python3 framework/runtime/council/council_dissent_metric.py
```

## Rollout status (slice G — pending Ayo)

Blinding is OFF by default. Next: run blinded + unblinded reviews, compare the two dissent rates,
set the threshold that means "blinding works" + the default-on task class, then flip
`AORG_BLIND_REVIEW=1`. Open tuning decisions: a 3rd reviewer for real anonymity over the 2-member
frontier pool; reveal timing (currently at decision-lock).
