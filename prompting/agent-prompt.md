# The `<Agent_Prompt>` house style

> How every agent body in this framework is written. The frontmatter says *what an
> agent is* (name, model, tools — see `framework/primitives/agents/spec.md`); the
> `<Agent_Prompt>` body says *how it thinks*. This file is the contract for the body.

The body is one root element — `<Agent_Prompt>` — wrapping a small, ordered set of
named tags. Tags are plain XML over markdown: an agent reads them as labelled
sections, and a validator can check they exist. Keep them in the order below; include
only the ones the role needs.

## The one hard rule

**`<Role>` is required.** An agent with no stated role is not an agent. Beyond that,
a body must satisfy **one** of two shapes (the validator enforces this):

- **Reasoning shape:** `<Role>` + `<Constraints>` — for analysis/review/judgment roles
  (architect, critic, reviewer). The constraints are the guardrails the reasoning runs
  inside.
- **Operating shape:** `<Role>` + `<Core_Context>` + `<Workflow>` — for roles that *do
  a job in a known system* (the apex-* domain agents). Context grounds them; the
  workflow is the procedure.

Everything else is optional and additive. Don't pad a role with tags it doesn't use.

## The tag vocabulary

Ordered as they should appear. *(R)* = required, *(C)* = common, *(S)* = situational.

| Tag | | What goes in it |
|---|---|---|
| `<Role>` | R | Who the agent is, what it owns, and — critically — **what it does NOT own** (the hand-off boundary). Three sentences, not three paragraphs. |
| `<Why_This_Matters>` | C | The cost of doing this badly. Anchors the agent to consequences, not procedure. |
| `<Core_Context>` | C | The facts the agent needs before it can act: systems, endpoints, invariants. (Operating shape.) In `framework/` roles this stays generic; concrete instance facts belong to `apex/agents/`. |
| `<Success_Criteria>` | C | The checklist that defines "done well" — each item observable, not aspirational. |
| `<Constraints>` | C | Hard limits and guardrails. What the agent must never do; where it hands off. (Reasoning shape.) |
| `<Workflow>` / `<Process>` | C | The numbered procedure. (Operating shape uses `<Workflow>`; lighter roles use `<Process>`.) |
| `<Investigation_Protocol>` | S | For diagnostic roles: how to gather evidence, form and test a hypothesis, before concluding. |
| `<Core_Principles>` | S | Durable principles when a role is governed by judgment more than a fixed procedure (e.g. code-simplifier). |
| `<Tool_Usage>` | S | Which tools, used how. May nest `<External_Consultation>` for second-opinion hand-offs. |
| `<Execution_Policy>` | S | Effort level and stop conditions — when to go deep, when to stop. |
| `<Output_Format>` | C | The exact shape of what the agent returns. A consumer (human or next agent) should know what to expect. |
| `<Failure_Modes_To_Avoid>` | S | Named anti-patterns with the corrective. The single highest-leverage section for steering behavior. |
| `<Examples>` | S | `<Good>` / `<Bad>` pairs. Show, don't just tell. |
| `<Final_Checklist>` | S | The self-audit an agent runs before returning. |

Roles may introduce their own tags (e.g. `<Severity_Definitions>`, `<OWASP_Top_10>`,
`<Evidence_Requirements>`) when the domain demands it. The vocabulary is open; the
**required `<Role>` and the two-shape rule are not.**

## Writing rules

- **Generic stays generic.** A `framework/roles/` body must name no hostname, client,
  product, or path. If it needs to reference "the runtime," say it neutrally — do not
  hardcode `Claude` or `Codex`. Runtime-specific or Apex-specific detail lives in
  `apex/agents/`. (The validator greps `framework/` for coupling.)
- **One source, two runtimes.** You write the body once in a canonical `.md`. The emit
  step (`framework/primitives/_lib/emit.mjs`) copies it to `.claude/agents/<name>.md`
  and projects it to `.codex/agents/<name>.toml`. Never hand-edit the emitted copies,
  and never let the two runtimes drift — that drift is exactly what this house style
  exists to kill.
- **Imperative, concrete, costed.** "Cite `file:line` for every claim," not "be
  rigorous." Every instruction should be checkable.
- **No `"""`.** The body is embedded in a TOML triple-quoted string on the Codex side;
  a literal `"""` breaks the emit and the emitter will refuse it. Use other emphasis.

See `framework/primitives/agents/` for the schema, validator, and creator that enforce
this house style; see real bodies in `framework/roles/` (generic) and `apex/agents/`
(instance).
