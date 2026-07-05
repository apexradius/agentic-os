# Capability Index Standard

A system accrues capabilities faster than anyone's memory of them. This repo already ships well over a
hundred skills, dozens of agents, and a wall of MCP tools — and the number only grows. Past some size, a
capability that exists but cannot be *found* is, in practice, a capability that does not exist: it is
rebuilt, duplicated, or left idle because no one knew it was there. Discoverability is not a nicety; it is
the difference between a growing toolkit and a growing pile.

The answer is **not** a hand-maintained list. A hand-maintained index is a second source of truth that rots
the moment someone adds a skill and forgets the list — and then it is worse than nothing, because readers
trust it. The only honest catalog is one **generated from the capabilities themselves** and **proven not to
have drifted**.

## The law

- There is **one** browsable catalog of what the repo can do — `CAPABILITIES.md` at the repo root —
  covering every skill, agent, and MCP server/tool.
- It is **generated, never hand-edited.** Its single source is the live capability tree: the skills and
  agents corpora and the MCP server sources. Their frontmatter and registrations are the truth; the catalog
  is a projection.
- It **may not drift.** The committed catalog must byte-match a fresh render of the live tree, enforced
  mechanically — exactly the anti-drift contract the agent-emit pipeline holds for runtime interfaces.

## Why the root, not `framework/`

The catalog spans both zones (`framework/` generic + `apex/` instance) and embeds instance-zone
descriptions verbatim, which the zone-purity tripwire forbids inside `framework/`. So the *machinery* is
zone-pure generic and ships with the framework, while its *output* — the catalog that names instance
capabilities — lives at the repo root, like the root `README`. Reading the catalog requires no install and
no index lookup: it is one file.

## The contributor's side

Adding or changing a skill, agent, or MCP tool is incomplete until the catalog is regenerated in the same
change. The gate makes that mechanical rather than remembered: a stale catalog fails CI. Executable
enforcement lives in [`standards/capability-index/`](../../standards/capability-index/).

> Last reviewed: 2026-06-29
