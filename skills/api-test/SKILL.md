---
name: api-test
description: "Test API endpoints — health checks, CRUD operations, auth flows, error handling, performance. Generates test report. Use when testing APIs, verifying endpoints, or /api-test."
user-invocable: true
argument-hint: "[base-url]"
---

# API Testing

Comprehensive API endpoint testing and validation.

## Test Categories

### 1. Health & Connectivity
- `GET /` or `GET /health` — responds with 200
- Response time under 500ms
- Correct Content-Type headers
- CORS headers present (if applicable)

### 2. Authentication
- Valid token → 200
- Missing token → 401
- Invalid token → 401
- Expired token → 401
- Wrong permissions → 403

### 3. CRUD Operations
For each resource endpoint:
- `POST /resource` — create (201)
- `GET /resource` — list (200)
- `GET /resource/:id` — read (200)
- `PUT /resource/:id` — update (200)
- `DELETE /resource/:id` — delete (200/204)
- `GET /resource/nonexistent` — 404

### 4. Validation
- Missing required fields → 400/422
- Invalid data types → 400/422
- Boundary values (min/max, empty strings, long strings)
- SQL injection attempts → rejected
- XSS payload → sanitized

### 5. Performance
- Response time per endpoint
- Concurrent request handling (10 parallel)
- Pagination working correctly
- Rate limiting headers present

## Execution
```bash
# Use curl for each test
curl -s -o /dev/null -w "%{http_code} %{time_total}s" [URL]
```

## Output
```markdown
# API Test Report: [Base URL]
**Date**: [date] | **Passed**: [X]/[Y] | **Avg Response**: [X]ms

| Endpoint | Method | Expected | Actual | Time | Status |
|----------|--------|----------|--------|------|--------|
| /health | GET | 200 | 200 | 45ms | ✅ |
```
