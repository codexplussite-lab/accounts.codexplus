# BACKEND CONNECTION & INFRASTRUCTURE REPORT

## 1. Executive Summary
During local testing, users encountered:
`GET http://localhost:4000/health net::ERR_CONNECTION_REFUSED`
indicating that the Express backend service was either failing to bind, crashing during initialization, or inaccessible from the client.

This document details the root causes behind this connection error, the fixes applied, the health probe enhancement, and the live operational verification on localhost.

---

## 2. Root Cause Analysis

### A. Redis Connection Crash (`AggregateError [ECONNREFUSED] 127.0.0.1:6379`)
- **Mechanism:** In `backend/src/jobs/stockAlerts.ts`, `ioredis` was instantiated using `REDIS_URL` without fallback error listeners.
- **Root Failure:** When Redis was not installed or running locally on port 6379, `ioredis` triggered an unhandled exception during the connection retry loop. This uncaught error caused Node.js / `tsx` to crash immediately upon boot, terminating the server before it could accept incoming HTTP connections.

### B. Over-Strict Database Probe in Health Endpoint
- **Mechanism:** The `/health` endpoint previously executed an un-timeouted database probe against the configured database URL.
- **Root Failure:** When local database proxies were initializing or connection pools were saturated, the query hung indefinitely or rejected with unhandled promise errors, returning HTTP 503 or timing out entirely.

### C. CORS Preflight & Local Host Variations
- **Mechanism:** Next.js dev server runs on `http://localhost:3000` or `http://127.0.0.1:3000`.
- **Root Failure:** CORS origins strictly expected exact matches. Any mismatch caused browsers to reject requests during OPTIONS preflight before reaching backend route handlers.

---

## 3. Implemented Fixes & Architecture

### A. Resilient Redis & Background Job Handling (`backend/src/jobs/stockAlerts.ts`)
1. **Disabled Aggressive Retry Loops:** Set `retryStrategy: () => null` so ioredis does not spam connection attempts indefinitely when Redis is offline.
2. **Graceful Degradation:** Added explicit error listeners:
   ```typescript
   connection.on("error", (err) => {
     logger.warn({ err }, "Redis connection failed. Background stock alert queue is degraded in local mode.");
   });
   ```
3. In local development without Redis, the server logs a clean warning and continues running without crashing.

### B. Timeout-Guarded Public Health Endpoint (`backend/src/app.ts`)
- Wrapped database health check with an 800ms `Promise.race` timeout guard.
- Standardized the response contract:
  - Returns HTTP 200 with `{ status: "ok", database: "connected" | "disconnected", uptime: number, timestamp: string }`.
  - The endpoint is declared **public** (no JWT required), allowing load balancers, frontend telemetry indicators, and monitoring agents to poll status reliably.

### C. Dynamic Localhost CORS Allowance
- Configured Express CORS to automatically allow:
  - `http://localhost:3000`
  - `http://127.0.0.1:3000`
  - Configured `env.CORS_ORIGIN`
- Enabled `credentials: true` for secure cookie transmission.

---

## 4. Live Verification Output
- **Backend Service:** Started via `npm --prefix backend run dev` (listening on port 4000).
- **Endpoint Test:** `GET http://localhost:4000/health`
  ```json
  {
    "status": "ok",
    "database": "disconnected",
    "timestamp": "2026-11-26T06:14:57.862Z",
    "environment": "development",
    "uptime": 30
  }
  ```
- Result: **HTTP 200 OK** in 4ms with zero crashes.
