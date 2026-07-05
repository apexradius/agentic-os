# Empirical Learning Loop

A framework that ships standards and primitives accumulates evidence every time an instance runs it —
run-records, eval scoreboards, gate-decision logs. Left alone, that evidence rots: the same slice fails
the same way, a gate that never denies sits in the allowlist forever, a doctrine rule everyone quietly
skips under pressure is never noticed. The learning loop is the discipline that turns accumulated outcomes
into a *reviewed* change — and its first law is what it must **not** be.

## The loop must not be autonomous (the load-bearing law)

The failure mode this standard exists to prevent: an unstructured self-evaluating loop that reads its own
output and rewrites the framework. Run once without external success criteria, that pattern generates
hundreds of junk artifacts and hallucinates capabilities that never existed — because nothing outside the
loop defined "better." So the loop here **reads evidence and proposes; a human decides; the
change then goes through the ordinary Plan → Implement → Verify path** with its validators. The machine
never edits the framework on its own authority. This is enforced by construction: the analyzer that reads
the evidence has no write path and always exits success — it is a report generator, not an actor.

## The four steps

1. **Gather** — a *bounded* window of evidence: run-records ([observability](observability.md)), eval
   scoreboards ([eval-harness](../../standards/eval-harness/)), and gate decisions
   ([tool-gate](../../standards/tool-gate/) audit log). All append-only, all already redacted.
2. **Surface** — extract signals, not conclusions: recurring Verify failures by slice, rework hotspots
   (runs that took more than one implement→verify attempt), duration/cost outliers, and one-sided gates —
   a rule that *always allows* is candidate dead weight; a rule that *always denies* is either real-risk
   confirmation or friction to re-tune. Each signal cites the evidence rows that produced it.
3. **Decide** — a human-run retro ranks the candidates, keeps what is worth a change, and discards the
   noise. This is a judgment step, deliberately not an automated one.
4. **Change** — the chosen item enters PIV like any other work: plan, implement, validators green, verify.
   If it touches a consumer-facing contract, the [versioning standard](versioning.md) bumps the version.

## Cadence and bounds

Periodic — a retro, not a continuous daemon. The input window is bounded and the candidate count is capped,
so the signal stays legible and the loop can never drown a reviewer in noise. A candidate with no cited
evidence is dropped: evidence is the entry ticket, not an afterthought.

## What runs it

The reading half is [`framework/runtime/learning/`](../../runtime/learning/) — a zero-dependency analyzer
over the run-record log that prints signals plus a bounded list of review candidates and **nothing else**:
no write path, exit always success, output addressed to a human. It closes the loop the
[observability standard](observability.md) opens — observability captures how each run went; this turns a
window of those captures into the next thing worth improving.

> Last reviewed: 2026-06-25
