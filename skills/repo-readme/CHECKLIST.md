# repo-readme — Pre-merge Doc Gate

Run before declaring any repo's docs "done." Every box must be checked or explicitly N/A.

## Visual (the point of this standard)
- [ ] README carries an **Architecture** diagram near the top (Mermaid `flowchart` + subgraphs).
- [ ] README carries the **primary Flow** diagram (decision nodes as `{diamonds}`, branches labeled).
- [ ] A **Sequence** diagram exists for each networked/multi-actor flow (request lifecycle, auth, webhook).
- [ ] **ER** diagram present if the repo has a database/schema.
- [ ] **State** diagram present if any entity has a status/lifecycle field.
- [ ] Every Mermaid block **parses** (verify script #1 green) — no broken diagrams shipped.
- [ ] Each diagram ≤ ~15 nodes; bigger ones split into high-level + drill-down in `docs/`.
- [ ] Edges are labeled with verbs; node labels are 1–4 words.

## Readability
- [ ] Persona-routed **"Choose your path"** table is the first thing after the intro.
- [ ] Every 2+-attribute comparison is a **table**, not prose.
- [ ] **Quick-start** is numbered 1→2→3 with runnable, copy-paste commands.
- [ ] Section rhythm consistent: emoji anchors + `---` rules + `> 💡`/`> ⏱️` callouts.
- [ ] Stable `<a id="…">` anchors above any heading with inbound links.

## Repo home
- [ ] H1 plus first paragraph clearly states the repo category and one-sentence promise.
- [ ] Badges are truthful: each points to a real version, license, workflow, package, or live status source.
- [ ] README includes a proof/check table or validation section tied to runnable commands.
- [ ] Release posture is grounded in `VERSION`, `CHANGELOG`, releases, or another durable source.
- [ ] Social preview source lives in `docs/assets/` and is editable source, not only an exported bitmap.
- [ ] No adoption, security, production, performance, or status claim appears without a linked proof source.

## Structure
- [ ] README ≤ **250 lines** (verify script #2 green) — depth moved to `docs/`.
- [ ] Hub-and-spoke: README links to `docs/`, doesn't inline deep content.
- [ ] All relative links resolve (verify script #3 green) — no dead `.md` links.

## Safety
- [ ] **No secrets** in README or `docs/` (verify script #4 green).
- [ ] `.env.sample` documented; `.env` git-ignored.
- [ ] Diagrams reflect **real** code paths, not assumed ones (mapped from the tree, not guessed).

## Source hygiene
- [ ] Diagrams are **Mermaid source** in the `.md`, not committed PNG/canvas blobs.
- [ ] Mapped this repo from its own reality — not bulk-copied from another repo's README.
