---
name: repo-readme
description: Author or upgrade a repo's README/docs to the Apex standard — detailed, diagram-and-flowchart-driven, and easily readable. Use when the user asks to clean up, improve, document, diagram, or "make the README nice" for any repo. Produces Mermaid architecture + flow + sequence + data diagrams, a persona-routed README, and a hub-and-spoke docs/ tree. Also use when a repo has no diagrams, a wall-of-text README, or docs an outsider can't follow.
tools: Read, Write, Edit, Bash, Glob, Grep
---

# repo-readme — Apex Documentation Standard

Make a repo's docs **clean = detailed + visual + readable**. The bar: a developer who has never seen the repo understands what it is, how it's wired, and how to run it — in under 5 minutes — because the structure is *seen* (diagrams), not *read* (prose).

Canonical visual tool: **Mermaid**. It renders natively on GitHub/GitLab, diffs in git, and needs no binary blobs. Never commit hand-drawn PNGs or Obsidian `.canvas` as the source of truth — they rot and can't be reviewed in a diff. (Export a PNG *from* Mermaid only if a non-GitHub surface needs it.)

---

## The 4 diagrams every non-trivial repo MUST have

Pick the right Mermaid type per intent — don't force everything into one flowchart:

| You need to show… | Diagram | Mermaid type | Mandatory when |
|---|---|---|---|
| How components/services connect | **Architecture** | `flowchart` + `subgraph` | always |
| The main process / decision logic | **Flowchart** | `flowchart TD` w/ `{decision}` nodes | always |
| Who calls whom over time (request lifecycle, auth, webhook) | **Sequence** | `sequenceDiagram` | any networked/multi-actor flow |
| Lifecycle / status transitions | **State** | `stateDiagram-v2` | anything with a status field |
| Data model / tables | **ER** | `erDiagram` | any repo with a DB/schema |
| Branch/release strategy | **Git graph** | `gitGraph` | only if the workflow is non-obvious |

Minimum for a service/app repo: **Architecture + primary Flow + one Sequence + (ER if it has a DB).** A pure library can ship with Architecture + one Flow.

Avoid `C4Context`/`mindmap`/`timeline` as load-bearing diagrams — render support is inconsistent across hosts. Use `flowchart` with subgraphs for architecture instead.

---

## The 8 readability moves (fold all into the README)

1. **Persona-routed top table** — "You are… → Start here → Time." Reader self-routes in 5s.
2. **Decision tables, not prose** — any comparison with 2+ parallel attributes becomes a table.
3. **Hub-and-spoke** — README is a skimmable hub (≤250 lines); depth lives in `docs/`. The line cap *forces* this.
4. **Consistent visual rhythm** — section emoji anchors, `---` rules between sections, `> 💡`/`> ⏱️` callouts.
5. **Runnable examples** — real copy-paste commands in fenced blocks, never a description of a command.
6. **Stable anchors** — `<a id="…">` above headings that have inbound links, so reorganizing never 404s a bookmark.
7. **Quick-start contract** — a literal "⏱️ N-minute setup," numbered 1→2→3, and it actually takes N minutes.
8. **Documented conventions** — state the structural rule ("handlers live in `src/handlers/*`"), not just the feature.

---

## Procedure

1. **Map reality first (read-only).** `find`/`Glob` the tree, read entry points, `package.json`/`pyproject`, existing README, env-sample, CI config. Write a one-paragraph "what this repo actually is" before drawing anything. Never diagram from assumptions — diagram from the code.
2. **Draft the 4 diagrams** in Mermaid from the real component/flow map. Label nodes with real module/service names from the repo.
3. **Assemble the README** from `TEMPLATE.md` — persona table, architecture diagram near the top, quick-start, then link out.
4. **Move depth to `docs/`** — architecture deep-dive, per-flow sequence diagrams, data model, FAQ, reference. README links to them; it does not inline them.
5. **Validate** (see Verify). Fix anything that fails before declaring done.
6. **Apply per-repo** — this skill is the standard; run it once per repo. Don't bulk-rewrite many repos in one pass without per-repo reality mapping.

---

## Diagram authoring rules (readability)

- **One direction per diagram** — `TD` (top-down) for architecture/flow, `LR` only for short pipelines. Don't mix.
- **Group with `subgraph`** — cluster by layer/service/boundary; it's the difference between a hairball and a map.
- **Short node labels** — 1–4 words. Detail goes in prose under the diagram, not inside nodes.
- **≤ ~15 nodes per diagram** — if it's bigger, split into a high-level diagram + a drill-down in `docs/`.
- **Label the edges** — `-->|publishes event|` beats a bare arrow. The verbs are where the understanding lives.
- **Decision nodes are `{diamonds}`** in flowcharts; every branch labeled (`-->|yes|`, `-->|429|`).
- **Don't rely on color/theme directives** for meaning — GitHub may strip `%%{init}%%`. Encode meaning in shape, grouping, and labels.

---

## Verify (executable — "done" means these pass)

```bash
# 1. Every mermaid block parses (catches syntax errors before they hit GitHub).
#    mermaid-cli needs a headless browser — install the shell ONCE, then point -p at it.
#    (Skipping this is why a bare `npx mmdc` fails with "Could not find Chrome".)
npx -y puppeteer browsers install chrome-headless-shell >/dev/null 2>&1
CHS=$(ls -d "$HOME"/.cache/puppeteer/chrome-headless-shell/*/chrome-headless-shell-*/chrome-headless-shell 2>/dev/null | head -1)
printf '{ "executablePath": "%s", "args": ["--no-sandbox"] }\n' "$CHS" > /tmp/pptr.json
python3 - "$PWD/README.md" <<'PY'
import re, sys, pathlib
for i,b in enumerate(re.findall(r"```mermaid\n(.*?)```", pathlib.Path(sys.argv[1]).read_text(), re.S),1):
    pathlib.Path(f"/tmp/mmd_{i}.mmd").write_text(b)
PY
for b in /tmp/mmd_*.mmd; do npx -y @mermaid-js/mermaid-cli -p /tmp/pptr.json -i "$b" -o "${b}.svg" >/dev/null 2>&1 \
  && echo "OK   $(basename "$b")" || echo "FAIL $(basename "$b")"; rm -f "${b}.svg"; done; rm -f /tmp/mmd_*.mmd /tmp/pptr.json

# 2. README line-count gate (hub stays skimmable):
[ "$(wc -l < README.md)" -le 250 ] && echo "OK ≤250 lines" || echo "FAIL: README too long → move depth to docs/"

# 3. No dead relative links:
grep -oE '\]\(([^)]+\.md)\)' README.md | sed -E 's/.*\(([^)]+)\)/\1/' | while read -r f; do
  [ -f "$f" ] && echo "OK  $f" || echo "DEAD $f"; done

# 4. Secret scan (docs must never carry live secrets):
grep -nEi '(api[_-]?key|secret|password|token)\s*[=:]\s*["'"'"'][A-Za-z0-9_\-]{12,}' README.md docs/ -r && echo "REVIEW above" || echo "OK no secrets"
```

All four must pass. A diagram that doesn't render is worse than no diagram — it signals broken docs.

---

## Constraints (what NOT to do)

- Don't invent architecture — if the code doesn't show how two things connect, read more or mark it "TODO: verify," never guess on the diagram.
- Don't inline 800 lines into the README. The cap is real; depth goes to `docs/`.
- Don't commit PNG/canvas as the diagram source. Mermaid is the source.
- Don't add diagrams that just restate a 3-item list. A diagram earns its place by showing **relationships**, not enumerating items.
- Don't bulk-apply across repos blind. One repo, mapped from its own reality, at a time.
- Don't leave a Mermaid block unvalidated. Run the parse check.

---

## Output

A repo with: a persona-routed `README.md` (≤250 lines) carrying ≥2 rendered Mermaid diagrams, a `docs/` tree holding the deep-dive diagrams + reference, and all four verify checks green. See `TEMPLATE.md` for the drop-in skeleton and `CHECKLIST.md` for the pre-merge gate.
