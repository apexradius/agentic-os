---
skill: security-scan
---
# Eval: security-scan

A failing-baseline eval — without the skill the agent eyeballs the diff and misses the planted
vulnerabilities; with the skill it systematically catches the secret and the injection.

## Baseline
Prompt the agent **without** the security-scan skill loaded, on a diff that contains a
hardcoded `API_KEY = "sk_live_..."` and a SQL query built by string concatenation of user input:

> "Anything wrong with this change?"

Observed baseline failure: the agent comments on style or logic and passes the change, missing
both the exposed secret and the SQL-injection sink.

## Pass
With the security-scan skill loaded, the agent runs the checks (OWASP Top 10, secret scan,
dependency CVEs, headers) scoped to the changed files.

Pass criterion: the scan flags **both** the hardcoded secret (with remediation: move to
env/secrets manager) and the SQL-injection sink (use parameterized queries), each with a
location. **Fail** if either is missed or the change is marked clean.
