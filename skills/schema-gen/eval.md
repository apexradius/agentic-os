---
skill: schema-gen
---
# Eval: schema-gen

A failing-baseline eval — without the skill the agent hand-writes plausible-looking JSON-LD that
doesn't validate; with the skill it emits correct, type-appropriate structured data.

## Baseline
Prompt the agent **without** the schema-gen skill loaded:

> "Add structured data for this local business page."

Observed baseline failure: the agent writes JSON-LD from memory with invented or wrong
properties, the incorrect `@type`, or missing required fields — markup that fails Rich Results
validation and earns no rich snippet.

## Pass
With the schema-gen skill loaded, the agent generates valid JSON-LD for the correct type
(LocalBusiness here), with the required properties populated and correct nesting.

Pass criterion: the output uses the right `@type`, includes the type's required properties, and
would pass schema validation. **Fail** if the markup uses a wrong type, invents properties, or
omits required fields.
