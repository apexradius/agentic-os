---
name: webhook-setup
description: "Set up webhook endpoints with signature validation, retry logic, and dead-letter handling. Use when connecting services, receiving events, /webhook-setup."
user-invocable: true
argument-hint: "[source-service] [event-type]"
---

# Webhook Setup

## Steps

### 1. Define Endpoint

Choose framework and generate route handler:

- **Express (Node):** `app.post('/webhooks/:source', rawBody, validateSignature, handleEvent)`
- **FastAPI (Python):** `@app.post("/webhooks/{source}")` with `Request` body + `X-Signature` header
- **n8n:** Webhook trigger node with custom path

Always use a dedicated route per source service. Never multiplex unrelated webhooks on one endpoint.

### 2. Signature Validation (HMAC-SHA256)

Every webhook endpoint must validate signatures before processing:

```
expected = HMAC-SHA256(webhook_secret, raw_request_body)
received = request.headers["X-Hub-Signature-256"]  # or X-Signature, etc.
if not hmac.compare_digest(expected, received): return 401
```

**Source-specific header names:**
| Source | Signature Header | Algorithm |
|--------|-----------------|-----------|
| GitHub | `X-Hub-Signature-256` | HMAC-SHA256 |
| Stripe | `Stripe-Signature` | HMAC-SHA256 (with timestamp) |
| Shopify | `X-Shopify-Hmac-Sha256` | HMAC-SHA256 (Base64) |
| Slack | `X-Slack-Signature` | HMAC-SHA256 (v0: prefix) |
| SendGrid | `X-Twilio-Email-Event-Webhook-Signature` | ECDSA |

### 3. Respond First, Process Later

Return `200 OK` immediately, then process asynchronously. Sources retry on timeout (typically 5-30s). Use a job queue (Bull, Celery, or n8n sub-workflow) for heavy processing.

### 4. Retry and Dead-Letter Handling

- **Idempotency:** Store `event_id` in a set; skip duplicates. Most sources send the same event on retry.
- **Retry policy:** If your handler fails, log to a dead-letter file/table: `{ event_id, payload, error, timestamp, retry_count }`.
- **Dead-letter replay:** Build a `/webhooks/replay` admin endpoint or cron job that retries dead-letter items with exponential backoff (1m, 5m, 30m, cap at 3 attempts).

### 5. Testing

```bash
# Test with curl — simulate a GitHub push event
curl -X POST http://localhost:3000/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$(echo -n '{"action":"push"}' | openssl dgst -sha256 -hmac 'your-secret' | awk '{print $2}')" \
  -d '{"action":"push"}'
```

Use `ngrok http 3000` or Cloudflare Tunnel for local testing with real source services.

## Decision Criteria

| Scenario | Approach |
|----------|----------|
| Simple event relay | Inline handler, no queue |
| Heavy processing (>5s) | Queue-based async processing |
| Multiple event types from one source | Event router with handler map |
| High volume (>100/min) | Rate-limit aware, batch processing |

## Anti-Patterns

- **Parsing body before validating signature** — always validate on raw bytes
- **Returning errors to the source** — most sources will retry, causing duplicate processing
- **Storing webhook secrets in code** — always use environment variables
- **No idempotency** — retries will cause duplicate side effects
- **Synchronous heavy processing** — sources timeout and retry, doubling the load
