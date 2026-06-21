---
name: security-scan
description: "Scan codebase for OWASP top 10, exposed secrets, dependency vulnerabilities, missing security headers. Use when checking security, scanning for vulnerabilities, or /security-scan."
user-invocable: true
argument-hint: "[optional-path-scope]"
---

# Security Scan

Audit codebase for security vulnerabilities.

## Scan Mode

Detect scan scope automatically:

- **Differential scan** (default when on a branch): `git diff $(git merge-base HEAD main)..HEAD --name-only` to get changed files only. Run all checks below scoped to those files. Faster, focused on what actually changed.
- **Full scan** (when on main, or when `$ARGUMENTS` includes `--full`): scan entire codebase.
- **Path scope**: if `$ARGUMENTS` is a directory/file path, scan only that path.

## Severity Calibration

Classify every finding using this scale:

| Severity | Criteria |
|----------|----------|
| **Critical** | Reachable from user input AND exploitable without authentication. Immediate risk. |
| **High** | Reachable from user input BUT requires authentication or specific conditions to exploit. |
| **Medium** | Internal-only code path. Exploitable only with existing system access. |
| **Low** | Theoretical risk. Defense-in-depth concern. No demonstrated reachability. |

## Checks

### 1. Exposed Secrets
```
Grep for: API_KEY=, SECRET=, PASSWORD=, token=, private_key, -----BEGIN
Scan: .env files committed, hardcoded credentials in source, AWS keys in config
```

### 2. Injection Vulnerabilities

**JavaScript/TypeScript:**
- **SQL Injection** — string concatenation in queries, missing parameterized queries
- **XSS** — `innerHTML`, `dangerouslySetInnerHTML`, `set:html` without sanitization, unescaped user input in templates
- **Command Injection** — `exec()`, `spawn()` with unsanitized input

**Python:**
- `subprocess.call(shell=True)` with f-strings or `.format()`
- `eval()`, `exec()` with external input
- Raw SQL via `cursor.execute()` with string formatting instead of parameterized queries
- `pickle.loads()` / `yaml.load()` without `Loader=SafeLoader` on untrusted data
- Jinja2 templates with `| safe` on user input

**Go:**
- `fmt.Sprintf` in SQL queries instead of parameterized queries
- `os/exec.Command` with unsanitized input
- `html/template` vs `text/template` misuse (text/template does not escape HTML)
- Unchecked `err` returns on security-critical operations (file I/O, crypto, auth)

### 3. Authentication & Authorization
- Missing auth checks on API routes
- JWT without expiration
- Weak password policies
- Missing CSRF protection on forms

### 4. Security Headers
Check `_headers` or middleware for: Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, Referrer-Policy

### 5. Dependencies

**Layer 1 — Package audit:**
```bash
npm audit --json          # Node
pip audit --format=json   # Python
govulncheck ./...         # Go
```

**Layer 2 — CVE lockfile check:**
- Parse `package-lock.json` / `requirements.txt` / `go.sum` for exact versions
- Cross-reference against known CVEs (check advisory URLs in audit output)
- Flag any dependency with a published CVE that the audit missed

**Layer 3 — Maintenance check:**
- Flag dependencies with no release in >12 months as unmaintained
- Check: `npm view [pkg] time --json` (last publish date) or PyPI release history
- Unmaintained + has known CVE = escalate to High severity

## False Positive Verification

After initial scan, run a verification pass on each finding:

1. **Reachability check** — does the flagged pattern actually receive user input? Trace the data flow. A hardcoded test API key in `__tests__/fixtures/` is not a real secret.
2. **Test fixture check** — is the file a test fixture, mock, or example? Files in `test/`, `__tests__/`, `fixtures/`, `examples/`, `__mocks__/` get downgraded unless they demonstrate a real vulnerability pattern.
3. **Dead code check** — is the function exported or called? Unreachable code gets downgraded to Low.
4. **Context check** — is the "secret" actually a public identifier (Stripe publishable key, Google Maps browser key)?

Mark verified false positives as `[FP]` and exclude from severity counts, but still list them in the report under a separate section for transparency.

## Output

Report each confirmed issue with:
- **Severity**: Critical / High / Medium / Low (using calibration above)
- **Location**: file:line
- **Description**: what the vulnerability is
- **Fix snippet**: specific code change to remediate

```
Example:
[CRITICAL] src/api/users.js:42
  SQL injection via string concatenation in user query
  Fix:
    - const result = db.query(`SELECT * FROM users WHERE id = '${req.params.id}'`);
    + const result = db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
```

### Report Sections
1. **Summary** — total findings by severity, scan mode used, files scanned
2. **Critical/High Findings** — each with location, description, fix snippet
3. **Medium/Low Findings** — each with location, description, fix snippet
4. **False Positives** — items flagged then verified as FP, with reasoning
5. **Dependency Health** — audit results, CVE findings, unmaintained packages
