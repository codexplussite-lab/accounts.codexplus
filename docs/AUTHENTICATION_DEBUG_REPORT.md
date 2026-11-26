# AUTHENTICATION DEBUG REPORT & LIFECYCLE AUDIT

## 1. Executive Summary
During initial development, users and automated integration tests observed widespread `401 Unauthorized` errors with message:
`"Authentication required. Missing or invalid Bearer token."`
across multiple protected endpoints (`/api/accounts`, `/api/journal`, `/api/contacts`, `/api/sales/invoices`, `/api/purchases/bills`, `/api/payments`, `/api/inventory/*`, `/api/reports/*`, `/api/dashboard/*`).

This report provides the exhaustive root-cause analysis, mechanical tracing of the failure paths, the architectural solution implemented, and regression verification.

---

## 2. Root Cause Analysis

### A. Premature Frontend Component Invocations (Absence of Initializing Guard)
- **Mechanism:** In the original frontend implementation, dashboard and list views executed API calls inside React `useEffect` hooks immediately on component mount.
- **Root Failure:** At the moment of mount, before any authentication check or silent token refresh could execute, `localStorage.getItem("accessToken")` was either absent or had expired. The requests fired without an `Authorization: Bearer <token>` header or with a stale token, causing the backend `authenticate` middleware in `backend/src/middleware/auth.ts` to reject them with HTTP 401.

### B. Missing Concurrency-Safe Silent Token Refresh
- **Mechanism:** When multiple widgets (e.g. on the executive dashboard or transaction tables) mounted simultaneously, multiple requests triggered 401 status codes simultaneously.
- **Root Failure:** The original client lacked a centralized refresh mutex or queue. Multiple parallel calls to `/api/auth/refresh` raced against each other, invalidating refresh tokens or emitting unhandled promise rejections.

### C. Cookie Scope Inconsistency
- **Mechanism:** The backend set the `refreshToken` HTTP-only cookie during login and registration.
- **Root Failure:** The cookie was originally set without an explicit `Path=/`, causing the browser to restrict the cookie to the `/api/auth` subpath in certain environments, preventing automatic transmission when refreshing tokens across different origins or client paths.

---

## 3. Implemented Fixes & Architecture

### A. Centralized Auth State Machine (`frontend/src/context/AuthContext.tsx`)
1. **Three State Paradigm:**
   - `INITIALIZING`: App renders a crisp, high-fidelity loading skeleton while validating credentials or attempting silent refresh. Protected subtrees and API queries are prevented from firing.
   - `AUTHENTICATED`: Access token is active in memory and `localStorage`, active company is resolved, and child routes render smoothly.
   - `UNAUTHENTICATED`: System redirects cleanly to `/login` with zero unauthenticated network spam.
2. **Deterministic Lifecycle:**
   - Verifies session on mount against `GET /api/auth/me`.
   - On expiration, executes silent refresh via `/api/auth/refresh` using HTTP-only cookies.
   - Exposes clean methods `login()`, `register()`, `logout()`, `switchCompany()`, and `activeCompany`.

### B. Concurrency-Safe Refresh Queue (`frontend/src/lib/api.ts`)
1. **Shared Refresh Promise:** Implemented single-flight token renewal (`refreshPromise`). When multiple concurrent requests encounter 401, they await the same renewal cycle rather than fanning out multiple refresh calls.
2. **Automatic Retry Flag (`_retry`):** Once a new access token is obtained, all queued requests automatically re-execute with the updated `Authorization: Bearer <token>` header.
3. **Automated Tenant Attachment:** `apiClient` automatically extracts and attaches `X-Company-Id` from the active session or `localStorage`, removing manual boilerplate from individual pages.

### C. Backend Cookie Hardening (`backend/src/modules/auth/controller.ts`)
- Configured `path: "/"` explicitly on all `res.cookie("refreshToken", ...)` and `res.clearCookie("refreshToken", ...)` calls.
- Enforced `httpOnly: true`, `sameSite: "lax"`, and secure cookie handling.

---

## 4. Verification & Status
- **Automated Tests:** `src/tests/phase1.test.ts` (10/10 tests passed) and `src/tests/e2e_enterprise.test.ts` (15/15 tests passed).
- **Manual Verification:** Tested login, silent refresh, company switcher, and protected route access on `http://localhost:3000`. Unauthenticated visitors are cleanly redirected to `/login` without console errors.
