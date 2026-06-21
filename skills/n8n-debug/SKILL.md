---
name: n8n-debug
description: "Debug n8n workflow failures — error classification, diagnosis steps, common gotchas, log reading. Use when n8n workflows fail, automations break, /n8n-debug."
user-invocable: true
argument-hint: "[workflow-json-path or error-description]"
---

# n8n Debug

## Step 1: Classify the Error

Every n8n failure falls into one of four categories. Identify the class first, then follow the diagnosis path for that class.

### Connection Errors
**Symptoms:** "ECONNREFUSED", "ETIMEDOUT", "getaddrinfo ENOTFOUND", SSL errors.
**Diagnosis:**
1. Verify target service is reachable: `curl -v [url]` from the n8n host
2. Check DNS resolution: `nslookup [hostname]`
3. Check firewall/security group rules on VPS
4. If self-signed cert: set `NODE_TLS_REJECT_UNAUTHORIZED=0` in n8n env (dev only)

### Authentication Errors
**Symptoms:** 401/403, "Invalid credentials", "Token expired", "Unauthorized".
**Diagnosis:**
1. Open n8n credentials panel — check if credential is still linked to the node
2. Test credential manually: copy token, `curl -H "Authorization: Bearer [token]" [url]`
3. Check token expiry — OAuth tokens expire (typical: 1hr access, 30-day refresh)
4. Re-authenticate: delete credential, recreate from scratch
5. **Gotcha:** n8n stores credentials encrypted; after a migration or restore, they may be invalid

### Data/Mapping Errors
**Symptoms:** "Cannot read property of undefined", "Value is not valid", empty output, wrong values.
**Diagnosis:**
1. Open the failed execution — click on the red node
2. Check **Input** tab: is the data structure what you expect?
3. Check expressions: `{{ $json.fieldName }}` — is `fieldName` spelled correctly? Is it nested?
4. Use **Pin Data** to freeze known-good input on upstream nodes, then re-run
5. **Gotcha:** n8n flattens arrays unexpectedly; use `$json["items"][0]` not `$json.items.0`

### Logic/Flow Errors
**Symptoms:** Wrong branch taken, infinite loops, nodes skipped, unexpected output.
**Diagnosis:**
1. Check IF/Switch node conditions — are comparisons type-safe? (`"5" !== 5`)
2. Check loop nodes — is there an exit condition?
3. Check Error Trigger node — is one present? Does it cover the failing path?
4. Trace execution order: n8n executes breadth-first from the trigger; verify connections

## Step 2: Read Execution Logs

```bash
# On VPS (Docker)
docker logs n8n --tail 200 --since 1h
# Filter for errors
docker logs n8n --tail 500 2>&1 | grep -i "error\|fail\|exception"
```

In the n8n UI: **Executions** tab > filter by "Error" status > click to inspect node-by-node.

## Step 3: Common n8n Gotchas

| Gotcha | Fix |
|--------|-----|
| Webhook URL changes after restart | Use fixed webhook path, not auto-generated test URL |
| Credential expiry after VPS reboot | Re-authenticate OAuth credentials post-restart |
| Expression returns `[Object object]` | Use `JSON.stringify()` or access specific property |
| Workflow works in test but fails in production | Test mode uses different webhook URL; activate workflow |
| Node output is `undefined` | Previous node returned empty; add IF node to guard |
| Rate limiting from external API | Add Wait node (1-2s) between API calls |

## Step 4: Fix and Verify

1. Apply fix to the identified node
2. Use **Test Workflow** with pinned data to verify
3. Check that error handling covers the failure path (add Error Trigger if missing)
4. Activate workflow and monitor first 3 live executions

## Anti-Patterns

- **Disabling error-throwing nodes instead of fixing them** — hides failures
- **Using test webhook URLs in production** — they change on every restart
- **No Error Trigger in the workflow** — silent failures with no notification
- **Hardcoded credentials in HTTP Request nodes** — use n8n credential store
