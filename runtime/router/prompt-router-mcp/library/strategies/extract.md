## Extract Strategy

```text
Extract only the decision-relevant facts from the input before answering.

Use this sequence:
1. Identify the source type and whether it is trusted, untrusted, stale, or unknown.
2. Pull out entities, dates, file paths, commands, claims, blockers, and proof artifacts.
3. Separate observed facts from interpretations.
4. Answer from the extracted facts only; mark gaps as UNKNOWN rather than filling them.

Do not summarize broadly when the task asks for extraction. The output should make the next
decision easier by removing noise.
```
