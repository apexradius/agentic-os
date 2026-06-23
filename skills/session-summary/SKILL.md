---
name: session-summary
description: "End-of-session close-out — capture what changed and was decided, then reconcile every open item into the durable task ledger so nothing is lost on context reset. Use when ending or wrapping up a session, saving progress, closing out for the day, moving on to the next session, or on /session-summary."
user-invocable: true
disable-model-invocation: false
---

# Session Summary — end-of-session close-out

The wrap-up that makes a session safe to end: a quick summary, the work **banked into clean,
current repos**, and — the step usually skipped — **every loose end reconciled into the durable
task ledger**, so open work survives the reset instead of dying in a scrolled-away conversation.
This is the per-session form of the loop's plan close-out (Plan → Implement → Verify → **Close
out**): same move, wider scope.

## 1. Compile the summary
1. **Changed** — `!git diff --stat`, plus uncommitted / untracked state.
2. **Accomplished** — features, fixes, and decisions (with the *why* on anything that would cause
   rework if reversed).
3. **Open** — pending items, blockers, and anything gated on someone else's decision.
4. **VNA** — the single concrete next action a cold session could resume from (not "continue X").

## 2. Bank the work — leave every touched repo clean and current
A session isn't closed while its work sits **uncommitted** (dirty) or **unpushed / unmerged**
(behind) — that is how repos quietly drift and fall behind across sessions. Enumerate the repos
**by the files you changed**, not just the current directory (one session can touch several). For
**each**:
1. **Check state — and that it's safe to bank.** `!git status -sb` (dirty? untracked?) and, when an
   upstream exists, ahead/behind it (`!git rev-list --left-right --count @{u}...HEAD`). If the repo
   is mid-rebase / merge / cherry-pick or on a detached HEAD, **stop** — not a safe state to bank;
   ledger it and move on.
2. **Bank what this session owns** — stage by **explicit path** (never `git add -A` / `git add .`,
   which sweeps in unrelated or unowned files), commit per the repo's commit policy (its configured
   author and hooks — don't add a trailer a `commit-msg` hook strips, don't `--no-verify`), then
   push. If you're on the default branch, **branch first**.
3. **Land it — only on verified-green CI.** Merge a feature branch to the default branch *only*
   after confirming CI has actually passed (checks queried and green) and review is clean — then
   merge so the default branch isn't left behind. If CI is failing, pending, or its status is
   unknown/unverified, **do not merge**: record the open PR as a ledger item (§3) with what it's
   waiting on. Pushing the branch is fine; landing it waits for green. Don't leave a green, owned
   branch dangling, and never merge on an unchecked pipeline.
4. **Prove it landed** — after pushing, **re-query** ahead/behind and confirm `0  0` (in sync);
   don't trust the push command's exit. If the push was rejected (remote moved), fetch + rebase,
   re-verify, re-push — never force-push to win the race.
5. **Report final state per repo** — `clean & pushed` / `committed, PR #N open (awaiting X)` /
   `left dirty — <reason>`. A repo left dirty or behind is acceptable only as a *recorded,
   deliberate* decision (§3), never an oversight.

## 3. Reconcile open items into the task ledger — the step that's usually missed
For **each** open item, pending, or blocker from steps 1–2 (including any un-landed PR):
1. **Search the ledger first** — is it already tracked? (Don't re-add; don't re-ask what's decided.)
2. **If absent**, append a ledger entry: what's left, the owner, and the gate/blocker if any.
3. **If present but changed this session**, update it in place (status, new evidence).

Report exactly what you **added** vs **already-present** vs **updated** — no silent writes. The
task ledger is where open work survives a context reset; the summary report does not — it scrolls
away. Items gated on a human decision are recorded as gated, never silently dropped.

## 4. Save the durable residue
- Fold session-spanning **decisions and context** into the knowledge / memory store — standing
  facts only, never ephemeral session state.
- **Retire finished plans** per the loop's close-out: once the outcome is in knowledge and any
  remainder is in the ledger, delete the plan file. A finished plan left on disk reads as open work.

## Output
Concise markdown — **Accomplished · Repos (clean & pushed / gated) · Open (→ ledger: added /
already-present) · Decisions · VNA.**

## Constraints
- **Bank what you own; surface what you don't.** Commit and push the session's own work by
  default — but never blind-commit a multi-author or unfamiliar tree; record it as a ledger item
  for its owner. When one commit would mix your work with someone else's, stage only yours.
- **Never merge on an unchecked or non-green pipeline.** A merge requires CI confirmed passing —
  failing, pending, or unknown status means push the branch and ledger the PR, don't land it.
- **Don't cross a protected/published gate unprompted.** Merging to a protected default branch,
  force-pushing, or pushing a public / release repo needs the explicit go-ahead that gate
  requires — until then it's a gated ledger item, not a silent push.
- **Never bypass a guard to bank.** No `--no-verify`, no force-push, no `git add -A` to sweep a
  tree clean — a blocking hook or a rejected push is a finding to resolve or ledger, not an
  obstacle to route around.
- **Don't duplicate** an item already in the ledger — reconcile, don't re-add.
- **Don't save ephemeral state** as a standing fact — only what a future session needs.

## Anti-Patterns
- A pretty summary with open items left only in the report (they vanish at reset).
- Re-asking or re-listing something the ledger already tracks.
- Declaring the session closed while a plan file or uncommitted thread silently holds open work.
- Closing with a touched repo left dirty or behind upstream when it isn't a recorded, deliberate
  decision — the default failure that grows divergence session over session.
- Reporting `pushed` from the command's exit code without re-querying that the branch is actually
  in sync with upstream.
