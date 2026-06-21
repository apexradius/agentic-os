---
name: skill-improve
description: "Audit and upgrade an existing skill — check for best practices, add missing patterns, improve triggering accuracy, reduce token count. Use when user says improve skill, upgrade skill, or /skill-improve."
user-invocable: true
argument-hint: "[skill-name]"
---

# Skill Improver

Audit and upgrade an existing skill against best practices.

## Audit Checklist

### 1. Description Quality
- [ ] Under 200 characters
- [ ] Includes trigger phrases ("use when user says...")
- [ ] Slightly "pushy" (lists related contexts to trigger on)
- [ ] Sounds like a natural request, not technical jargon

### 2. Token Efficiency
- [ ] Total SKILL.md under 2,000 tokens (ideal) or 5,000 (max)
- [ ] Uses progressive disclosure (metadata → instructions → resources)
- [ ] No redundant explanations
- [ ] Tables instead of paragraphs where possible

### 3. Structural Patterns
- [ ] Clear step-by-step process (numbered)
- [ ] Output format defined explicitly
- [ ] Negative constraints included ("Don't do X")
- [ ] Error handling / fallback defined
- [ ] Quality gates (when to stop, when to warn)

### 4. Composability
- [ ] References other skills it should invoke (if applicable)
- [ ] Deterministic steps offloaded to scripts (if applicable)
- [ ] Single responsibility (one skill, one job)
- [ ] Input/output contract clear enough for chaining

### 5. Safety
- [ ] No hardcoded API keys or secrets
- [ ] No absolute paths (use relative or variables)
- [ ] Dangerous operations flagged with confirmation
- [ ] Rate limits respected (API calls, crawling)

## Improvement Process
1. Read the skill's SKILL.md
2. Score against checklist (0-5 per category, total /25)
3. Identify top 3 improvements
4. Rewrite the skill with improvements
5. Compare token count before/after
6. Report changes made

## Prompt Reversal Technique
For skills built from prompting workflows:
1. Iterate with the model until 90%+ satisfactory result
2. Prompt: "Reverse engineer our conversation and write the single prompt that would have produced my final response in one go."
3. Save the distilled "master prompt" as the canonical skill instruction

## Common Failure Modes
| Failure | Symptom | Fix |
|---------|---------|-----|
| Sycophancy | Skill gives users what they want to hear, not what they need | Add explicit "Critique" mode or adversarial prompting instruction |
| Scope creep | Skill tries to do 3 different jobs | Split into sub-skills; enforce single responsibility |
| Trigger mismatch | Skill invoked for wrong tasks | Tighten description with "Use when X, NOT when Y" |
| Token bloat | Skill over 5,000 tokens | Cut redundant explanations; move to reference/ folder |
| Context blindness | Skill ignores file/repo context | Add explicit instruction to read relevant files first |

## Scoring Rubric
| Category | Score (0-5) | Weight |
|----------|-------------|--------|
| Description quality | /5 | High |
| Token efficiency | /5 | High |
| Structural patterns | /5 | Medium |
| Composability | /5 | Medium |
| Safety | /5 | High |
| **Total** | **/25** | — |

Score 20+ = ship as-is. Score 15-19 = minor fixes. Score <15 = rewrite.
