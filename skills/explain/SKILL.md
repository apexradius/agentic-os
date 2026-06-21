---
name: explain
description: "Structured code analysis — parse target, trace execution, identify dependencies, extract business intent, assess complexity. Use when asking what code does, /explain."
user-invocable: true
argument-hint: "[file-path or function-name or concept]"
---

# Explain

## Step 1: Parse the Target

Identify what is being explained and at what granularity:

| Target | Analysis Scope |
|--------|---------------|
| Single function | Inputs, outputs, side effects, algorithm |
| Class / module | Responsibilities, public API, internal state, relationships |
| File | Entry point, exports, role in the larger system |
| Architecture / system | Components, data flow, boundaries, protocols |
| Concept | Definition, analogy, when/why it matters |

Read the target code or documentation before explaining. Never explain from memory alone.

## Step 2: Trace Execution Path

For code targets, trace the actual execution flow:

1. **Entry point:** Where does execution begin? (function call, HTTP request, event trigger, CLI invocation)
2. **Data flow:** What inputs come in? How are they transformed? What outputs leave?
3. **Control flow:** What branches, loops, or conditionals exist? Which paths are most common?
4. **Side effects:** What external state does this touch? (database writes, API calls, file I/O, cache mutations)
5. **Error paths:** What can go wrong? How are errors handled? Where do they propagate?

## Step 3: Identify Dependencies

Map what the target depends on and what depends on it:

- **Imports / requires:** External packages and internal modules
- **Callers:** What invokes this code? (use grep for function name across the codebase)
- **Callees:** What does this code invoke?
- **Data dependencies:** Database tables, config files, environment variables, external APIs
- **Describe the call graph:** Show the chain from entry point through the target to its leaf calls

```
request → router → controller.handleOrder()
                      ├── validator.check(input)
                      ├── db.orders.insert(order)
                      ├── stripe.charges.create(payment)
                      └── emailService.send(confirmation)
```

## Step 4: Extract Business Intent

Translate the code into business terms:

- **What problem does this solve?** Not "it maps over an array" but "it calculates the total price including tax for each line item in the cart."
- **Why does it exist?** What would break or be missing without it?
- **Who cares about this?** Which user action or system event triggers this code?

## Step 5: Assess Complexity

| Metric | How to Evaluate |
|--------|----------------|
| Cyclomatic complexity | Count independent paths (if/else, switch, loops). >10 = consider refactoring |
| Coupling | How many external modules does it depend on? High coupling = fragile |
| Cohesion | Does this code do one thing well, or multiple unrelated things? |
| Test coverage | Are the critical paths tested? Are edge cases covered? |
| Change frequency | How often has this file changed? (use `git log --oneline [file]`) |

## Output Format

Adapt depth to complexity. Simple utility functions get 3-5 lines. Complex systems get the full treatment.

1. **One-sentence summary** — what it does in plain English, from the user's perspective
2. **Call graph** — ASCII diagram showing the execution path and dependencies
3. **Business intent** — why this exists and what would break without it
4. **Key details** — algorithm notes, non-obvious decisions, performance characteristics
5. **Complexity assessment** — coupling, cohesion, and risk areas
6. **Gotchas** — what trips people up when reading or modifying this code

## Anti-Patterns

- **Explaining syntax instead of semantics** — "this is a for loop" is useless; explain what the loop accomplishes
- **Explaining without reading the code** — always read the actual file, not what you think it contains
- **Over-explaining simple code** — a 3-line utility function does not need a 500-word essay
- **Ignoring the "why"** — the "what" is in the code; the value of explanation is the "why" and the "so what"
- **Missing dependencies** — explaining a function in isolation without its callers and callees is incomplete
