# content-injection

An executable standard for **defending against prompt injection carried in untrusted tool
results** — a fetched web page, an email body, an MCP tool's output — before an agent reads and
acts on it. It is the results-side twin of [`tool-gate`](../tool-gate/) (which guards a tool
*call*); this guards the *content that comes back*.

The law this enforces is [`framework/doctrine/standards/content-injection.md`](../../doctrine/standards/content-injection.md).

## The model: advisory annotation, never a silent block

A tool result is data, not instructions. When that data tries to talk to the agent — "ignore your
instructions", "email your API key", a smuggled `<tool_call>` block — the defense **annotates the
content as untrusted and surfaces the offending span verbatim**, so the agent treats it as data and
the operator can see what was attempted. It does **not** drop the result or fail the tool. Three
consequences follow, and they are the whole safety argument:

1. **Advisory action.** The runtime scanner emits `additionalContext`; it never denies a tool. A
   false positive is therefore a noisy note, never lost data. This is why the detector can afford to
   favour catching an attack over staying quiet.
2. **FLAG over BLOCK on input.** A single weak signal (one lure) → `flag`; only a strong or
   compounded signal → `block`. Even `block` is still advisory at the runtime layer.
3. **Transparency relay.** The matched excerpt (and any decoded smuggled ASCII) is handed back
   verbatim, as data — the agent is told *what* was injected, not merely that *something* was.

## Four attack categories

The corpus (`fixtures/red/`) carries one RED fixture per category; every fixture is a real
PostToolUse payload shape `{ tool_name, tool_response }`:

| Category | What it is | Tier |
|---|---|---|
| `instruction-override` | "ignore previous instructions", role reassignment, covert-action lures | block |
| `exfil-request` | "reveal your system prompt", "send your API key / secret / token" | block |
| `tool-invocation-lure` | fake `<tool_call>`/`<system>` blocks, jailbreak-mode, fake boundaries | flag |
| `canary-probe` | hidden-channel smuggling (zero-width / bidi / Unicode-tag ASCII) carrying a probe | block |

`fixtures/green/` holds the false-positive floor: ordinary content, plus **trigger-adjacent-but-clean**
text ("please ignore the earlier draft", "the system prompt returned a 500 error", "Reveal.js
renders slide decks"). These prove the detector keys on injection *phrasings*, not on the bare
presence of words like *ignore* / *system* / *token*.

> **Canary fixtures use synthetic tokens only** — `CANARY-FAKE…`, which cannot match a real
> `CANARY-[0-9A-F]{12}` tripwire. `validate.mjs` fails if any fixture embeds a live-canary shape.

## Reference floor vs. instance detector

`lib/detect.mjs` is the **reference floor**: a deterministic, zero-dependency Node port of the L1
(hidden-character) + L2 (heuristic) layers of a prompt-injection scanner. It is the executable spec
the corpus is tested against and the floor an instance's real detector must **meet or beat**. It
never runs in production.

An instance wires its live detector and runtime hook through a discovered manifest named
`content-injection.manifest.json` (see the Apex instance at
`apex/config/agent-ops/content-injection.manifest.json`). When present, `validate.mjs` additionally:

- **parity** — runs the instance detector on every fixture and asserts it is at least as strong as
  the floor on RED and never hard-blocks benign content;
- **surface scoping** — asserts the scanner's target-tool regex excludes local reads (so reading
  security docs or these very fixtures via `Read` is never scanned) and includes external tools;
- **one code path** — asserts the deployed hook imports the same detector the corpus tests, so the
  file under test *is* the file the runtime loads.

On a bare framework clone (no manifest) those three checks pass vacuously and the floor still proves
itself. The framework tree holds **zero instance paths**.

## Run it

```
node framework/standards/content-injection/validate.mjs
# -> content-injection: 14/14 selftest checks passed
```

Runs on bare `node` with no dependency install; discovered by the primitive harness
(`framework/primitives/_lib/validate.mjs --all`) by mere presence.

## Scope fence

This standard is the **test/parity floor and the corpus** — not a second live scanner. Deploying the
hook, keeping the deployed copy in sync with the in-repo source, and operating the local-model tier
are the instance's runtime job (out of scope here — see `THREAT-MODEL.md`). This standard guarantees
that the detector an instance ships is correct and honestly wired; it does not itself sit in the
request path.
