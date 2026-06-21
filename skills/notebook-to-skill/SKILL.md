---
name: notebook-to-skill
description: "Convert NotebookLM research output into a Claude Code skill — extract findings, rules, procedures into SKILL.md format. Use when converting notebook research into skills."
disable-model-invocation: true
argument-hint: "[notebook-content-or-path] [skill-name]"
---

# Notebook to Skill

Convert research from Google NotebookLM into an executable Claude Code skill.

## Steps

1. **Read notebook content** — accept file path (markdown, PDF) or pasted content from NotebookLM export

2. **Extract structured knowledge:**
   - Key findings and rules
   - Step-by-step procedures
   - Decision criteria and thresholds
   - Templates and patterns
   - Anti-patterns and warnings
   - Sources and references

3. **Classify content:**
   - **Skill instructions** → goes in SKILL.md (actionable steps, decision logic)
   - **Reference material** → goes in supporting files (detailed data, examples, sources)
   - **Templates** → goes in template files (reusable output formats)

4. **Generate skill structure:**
   ```
   ~/.claude/skills/$ARGUMENTS[1]/
     SKILL.md          # Core instructions (<200 lines)
     reference.md      # Detailed findings and data
     templates/        # Output templates if needed
   ```

5. **Write SKILL.md** with:
   - Proper frontmatter (name, description, argument-hint)
   - Clear when-to-use triggers
   - Step-by-step workflow derived from notebook findings
   - Decision criteria as actionable rules
   - Links to reference files for detailed content

6. **Verify** — invoke the new skill with a test input

## Tips
- NotebookLM audio summaries → transcribe key points manually before converting
- NotebookLM source citations → preserve as references in reference.md
- If notebook covers multiple topics → split into multiple skills
