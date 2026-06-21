---
name: skill-create
description: "Create a new Claude Code skill — frontmatter, instructions, context engineering, prompt patterns, Cockpit Rule. Use when building new skills, creating skill files, or /skill-create."
user-invocable: true
disable-model-invocation: true
argument-hint: "[skill-name] [description]"
---

# Skill Create

Create a new Claude Code skill.

## Steps
1. **Create directory** — `mkdir -p ~/.claude/skills/$ARGUMENTS[0]/`
2. **Generate SKILL.md** with:
   ```yaml
   ---
   name: $ARGUMENTS[0]
   description: $ARGUMENTS[1]
   disable-model-invocation: false
   argument-hint: "[args]"
   ---
   ```
3. **Write instructions** — clear steps, expected inputs/outputs, rules
4. **Create supporting files** if needed (templates, references)
5. **Test** — invoke `/skill-name test-input` and verify behavior

## Best Practices
- Keep SKILL.md under 200 lines
- Front-load the most important information
- Use `$ARGUMENTS` for inputs, `$ARGUMENTS[0]` for positional
- Include expected output format
- Set `disable-model-invocation: true` for skills with side effects
- Use `context: fork` + `agent: Explore` for research-heavy skills

## Context Engineering Principle
In 2026, model understanding of vague instructions is strong — the real bottleneck is the **fact gap**: the model lacks your specific goals, constraints, and internal context. Success depends on providing "AI DNA" files:
- `soul.md` — agent philosophy and personality
- `user.md` — user preferences and writing style
- `memory.md` — long-term distilled operational facts
- `agents.md` — highest-level rules and security protocols

## Prompt Patterns
- **XML Sandwich**: `<task>Do X</task> <context>Background</context> <format>Table</format>` — label every component
- **Blueprint Scaffolding**: "First, outline the standard sections of this [document] and give me a one-sentence description for each. Do not execute yet." — prevents hallucinated structure
- **Perfection Loop**: Append to prompts: "Before you begin, create an internal rubric for excellence. Grade your draft against it, and keep iterating until you score 10/10."
- **Pull Prompting**: Instead of prescribing how, give the desired outcome and ask: "What questions do you need answered to complete this?"

## Cockpit Rule (when to use AI vs manual)
| Mode | Use When |
|------|----------|
| **Autopilot** | High human time cost + high AI success probability |
| **Collaboration** | Iterative work where neither alone succeeds |
| **Manual** | Risk of AI failure too high, or task too short to justify prompting |
