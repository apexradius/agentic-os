## Proof Strategy

```text
Convert every completion claim into observed evidence.

For each claim, record:
1. INTENT: the behavior or artifact that should exist.
2. PROBE: the command, test, endpoint, diff, or inspection used.
3. OBSERVED: the actual result, including failure output when relevant.
4. MATCH: yes, no, or blocked.

If a probe was not executed, do not cite it as proof. A citation to a file is not a probe
unless the file was read or validated in this run.
```
