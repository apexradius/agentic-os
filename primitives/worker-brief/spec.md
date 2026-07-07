# Primitive: Worker Brief

A worker brief is the self-contained task an orchestrator hands a **cold** worker when it fans work
out, plus the **summary-only** result the worker hands back. It makes
[fan-out.md](../../coordination/fan-out.md)'s contract machine-checkable: a worker starts with zero
conversation history, so everything load-bearing must be in the brief, and a worker returns a
condensed result — never its reasoning trace.

One document is one of two kinds, discriminated by `kind`:

- `kind: "brief"` — the dispatch (orchestrator → worker).
- `kind: "return"` — the result (worker → orchestrator).

## The shape of a brief

| Field | Req | Purpose |
|---|---|---|
| `objective` | ✓ | The outcome to accomplish — not the steps. |
| `inputs` | ✓ | The self-contained context a cold worker needs (string or list). |
| `constraints` | ✓ | The boundaries: what NOT to touch, the scope fence, invariants to hold. At least one. |
| `stance` | ✓ | The skeptical posture — verify before reporting, burden of proof on the implementer, flag deviations. |
| `verify_bar` | ✓ | The definition of done. Build brief → an executable check; recon brief → a deliverable bar. |
| `return_contract` | ✓ | The declared output shape: `required_fields` (must include `summary`) + `summary_max_chars`. |
| `tool_guidance` | | Which tools/sources to prefer or avoid. |
| `hold_point` | | Where the worker must stop and hand back. |
| `plan_anchor` | | The plan slice / task id this serves. |
| `questions` | | Specific questions the return must answer. |
| `deviation_policy` | | How to handle a needed deviation (default: flag, don't absorb). |

`verify_bar` is required, not garnish: a brief without a definition of done is exactly the artifact
this primitive exists to reject. The declared `return_contract` is fan-out.md's non-negotiable —
a worker without a declared return shape duplicates effort and leaves gaps.

## The shape of a return

Required: `kind`, `status` (`done` | `blocked` | `needs-input`), `summary`, `evidence` (non-empty).
Optional: `deviations`, `fence_respected`, `artifacts`, `follow_ups`.

## Return cap: what is enforced, honestly

"Only a summary returns — never the trajectory" is enforced two structural ways:

1. **Summary-only by omission.** The return schema is `additionalProperties: false` and has no field
   for a tool log or reasoning trace. A conforming return literally cannot carry the trajectory — a
   `trajectory` or `tool_log` key is rejected, not ignored.
2. **A character cap.** `summary_max_chars` is a **ceiling** the validator enforces when a contract
   is supplied. It is a character proxy for the ~1–2K token summary target — **chars are not tokens**,
   so this is a ceiling, not an exact token count. Live-message token counting is the runtime
   instance's job; this primitive does not build it. No theater: the char cap is a real reject, and
   it is labelled for what it is.

## Validation

`worker-brief.schema.json` (ajv) is the build-time authority; [`render.mjs`](render.mjs) carries the
light dispatch-time twin (`validateReturn`) an orchestrator imports so it does not reimplement the
cap check. `validate.mjs` proves the two agree and that the twin's field allowlist has not drifted
from the schema. Briefs are composed per dispatch, so there is no durable corpus — the inline
RED/GREEN selftest is the standalone proof; real brief/return files can be passed as targets.

## Constraints

- Do not add fields to the return envelope without updating both the schema and `render.mjs`'s
  allowlist — the drift guard fails loudly if they diverge.
- The primitive's own files stay zone-pure (generic exemplars). A brief *instance* is data and may
  name anything; the validator does not gate target content.

## Verify

```sh
node validate.mjs                 # RED/GREEN selftest
node ../_lib/validate.mjs --all   # the whole harness, this primitive included
```

Law: fan-out.md (the contract) + the delegation rule ([../../doctrine/rules/delegation.md](../../doctrine/rules/delegation.md)).
