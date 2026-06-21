---
name: skill-forge
description: "Full skill lifecycle — create, improve, audit, reverse-engineer. Includes /25 rubric, overlap detection, prompt reversal, and batch audit. Use for /skill-forge or skill work."
user-invocable: true
---

# Skill Forge — Create, Test, Improve

## Scoring Rubric (/25)

| Dimension | 1 (Poor) | 3 (Adequate) | 5 (Excellent) |
|-----------|----------|--------------|----------------|
| **Description** | Vague, won't trigger | Sometimes triggers | Natural trigger, slightly pushy |
| **Token Efficiency** | >3000 tokens | 1000-2000 | <1000, progressive disclosure |
| **Structure** | Wall of text | Has steps | Clear phases, output format, constraints |
| **Routing** | No triggers | Some trigger words | Natural phrases + edge cases |
| **Composability** | Duplicates peers | Standalone | Single responsibility, references peers |

## Modes

### Create
1. **Intent**: What, when, expected output
2. **Overlap check**: Scan `~/.claude/skills/*/SKILL.md` descriptions. If >50% overlap, merge or differentiate.
3. **Write**: Frontmatter (description <200 chars, user-invocable) + body (steps, output, constraints, anti-patterns)
4. **Score**: Must hit 20+ on /25 rubric
5. **Test**: 3 sample prompts, verify trigger + output

### Improve
1. Read current SKILL.md
2. Score each /25 dimension
3. Identify top 3 improvements (highest impact first)
4. Rewrite — must improve by 3+ points
5. Compare token count before/after

### Batch Audit
1. Scan all `~/.claude/skills/*/SKILL.md`
2. Score each against /25 rubric, rank worst-first
3. Report: total skills, average score, bottom 10, top concerns
4. Flag: missing descriptions, >5000 tokens, duplicate descriptions, missing anti-patterns

### Overlap Detection
1. Extract all skill descriptions
2. Group by similar intent (>50% keyword overlap or same triggers)
3. Recommend: merge, differentiate, or keep both

### Prompt Reversal
After iterating a skill to 90%+ satisfaction:
1. Reverse-engineer: "What single prompt produces this exact skill?"
2. Save as `FORGE_PROMPT.md` in the skill directory
3. This is the reproducible seed — one prompt recreates the skill if lost

## Best Practices

- Description: natural language, <200 chars
- One skill = one job. Two jobs = two skills.
- Anti-patterns section prevents known failures
- Output format produces consistent results
- Under 2000 tokens ideal, 5000 max

## Anti-Patterns

- Creating skills without checking for duplicates
- Skills over 3000 tokens that could be 800
- Descriptions only triggering on exact slash command
- Shipping skills scoring under 20/25
