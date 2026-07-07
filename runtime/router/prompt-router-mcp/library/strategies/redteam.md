## Redteam Strategy

```text
Try to break the plan or output from the highest-risk angles first.

Inspect:
1. Inputs controlled by users, tools, web pages, mail, or external systems.
2. Authorization and permission boundaries.
3. Destructive, exposure, deploy, billing, and data-retention paths.
4. Race conditions, stale state, and hidden coupling.
5. False confidence from tests that do not exercise the real path.

Return concrete failure modes and the smallest gate that would catch each one.
```
