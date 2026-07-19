---
name: notebook-to-skill
description: "Turn a NotebookLM notebook into a validator-passing, source-cited skill by reading its sources through the live NotebookLM MCP. Use when converting NotebookLM research (a notebook, its sources, or a research corpus) into an executable skill — not for pasted text or manual transcription."
disable-model-invocation: true
argument-hint: "[notebook-id-or-title] [skill-name]"
---

# Notebook → Skill

Convert a Google NotebookLM notebook into an executable, **source-cited** skill by reading its
sources through the live `notebooklm-mcp` server — no pasting, no manual transcription.

## Prerequisites
- The `notebooklm-mcp` server is connected. Load its tools with ToolSearch (`notebooklm`)
  before the first call — schemas are deferred.
- Auth is live: `notebook_list` returns notebooks. The session token goes **stale ~weekly**;
  if calls fail with an auth error, the fix is a `nlm login` re-auth, not a code change.
- Report failures by functional consequence ("notebook unreachable"), never transport detail.

## Workflow

1. **Inventory the notebook.** `notebook_list` → find the target by title/id. `notebook_describe`
   (or `source_list_drive`) to see its sources and source ids. Record the source count — it
   drives the extraction method in step 2.

2. **Choose the extraction method — this is the decision that determines quality.**
   | Corpus | Method | Why |
   | --- | --- | --- |
   | Single creator, faithful voice matters, ≲ 50 sources | `source_get_content` per source | Returns raw transcript text — **no RAG paraphrase**. Cite each source's own id/video id. |
   | Large multi-creator "masters" corpus (100+ sources) | `notebook_query` with targeted questions | RAG-synthesizes across **all** sources, cited by source number. Paraphrase is acceptable when no single voice must be preserved. Verify specific numbers with a follow-up `source_get_content`. |
   Never `notebook_query` a single-creator notebook you promised to keep verbatim — the paraphrase
   silently rewrites the author's words.

3. **Distill to cited markdown.** Every rule, number, threshold, or named pattern carries a
   `(<source-id>)` citation so any claim is traceable. Extract: rules + thresholds, procedures,
   decision criteria, anti-patterns, templates. Drop nothing to prose that should be a checklist.

4. **Structure into an Apex skill.** Pick the zone first:
   - Generic, zero Apex coupling → `framework/skills/<name>/`
   - Apex-coupled instance → `apex/skills/<name>/`
   Then author:
   ```
   <zone>/skills/<name>/
     SKILL.md              # load-signal description + decision-complete procedure (<500 lines)
     references/<topic>.md # the depth + citations behind each rule (loaded on demand)
     templates/            # reusable output formats, if the skill emits a fixed shape
     eval.md               # failing-baseline (RED→GREEN) or rubric eval — REQUIRED
   ```
   The `description` is a **load signal** (when to trigger — symptoms, phrases), not a summary of
   the body. The body is decision-complete: no fork left to the implementer.

5. **Validate.** `node framework/primitives/skills/validate.mjs <zone>/skills/<name>/SKILL.md`
   — schema + eval-coverage must pass. Fix and re-run until green.

6. **Fan out.** `bash apex/scripts/skills-fanout-sync.sh --apply` mirrors the canonical skill to
   the runtime skill roots (`~/.claude/skills`, `~/.config/opencode/skills`, `~/.codex/skills`).

## Constraints (what NOT to do)
- **No invented content.** Every claim traces to a source id. If it isn't in the notebook, mark
  it as your own judgment, not a citation.
- **Don't cross-pollute a single-creator skill** with other notebooks' material — it breaks the
  "this creator's actual teaching" contract.
- **Don't dump notebook content into `apex/knowledge`.** The knowledge base holds standing facts
  and lessons, not extracted reference bodies — that belongs in the skill's `references/`.
- **Don't skip the eval.** A skill with no failing-baseline eval fails the validator and won't be
  counted; the eval is what proves the skill changes behavior.
- **One notebook can span multiple skills** — split by topic rather than forcing one oversized skill.

## Verify (executable acceptance)
- `validate.mjs` reports the skill valid and eval-covered.
- Every `##` claim in `references/` ends with a `(<source-id>)` citation → grep for uncited headings.
- The fan-out sync completes (`actions=N`), placing the skill in every runtime root.
- Spot-check one cited claim against `source_get_content` for the same source — the text matches.
