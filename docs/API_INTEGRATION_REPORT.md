# API INTEGRATION & CLIENT CONTRACT REPORT

## 1. Executive Summary
This document reviews the API integration layer connecting the Next.js frontend to the Express backend across all 20 business workflows of the Enterprise Accounting & Inventory ERP.

---

## 2. API Contract Specification

All backend endpoints strictly follow the uniform JSON envelope standard:

### A. Success Envelope
```json
{
  "data": { ... } | [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

### B. Error Envelope
```json
{
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human readable descriptive message",
    "details": [ ... ]
  }
}
```

### C. HTTP Status Codes
- `200 OK`: Successful read or update.
- `201 Created`: Successful resource creation.
- `400 Bad Request`: Validation failure (Zod schema rejection).
- `401 Unauthorized`: Missing or invalid Bearer token / expired session.
- `403 Forbidden`: Role permission violation or mutation of immutable posted records.
- `404 Not Found`: Resource does not exist or belongs to another company.
- `409 Conflict`: Duplicate SKU, email, or concurrency conflict.
- `422 Unprocessable Entity`: Accounting invariant violation (e.g. unbalanced journal, locked fiscal period, insufficient stock).

---

## 3. Module-by-Module Integration Status

| Module | Endpoints | Auth & Tenant Header | Frontend Client | Status |
|---|---|---|---|---|
| **Auth** | `/api/auth/register`, `/login`, `/refresh`, `/logout`, `/me` | Public / Cookie-based | `useAuth()` hook | **VERIFIED** |
| **Accounts (COA)** | `/api/accounts`, `/api/accounts/:id` | `Bearer <JWT>`, `X-Company-Id` | `apiClient` | **VERIFIED** |
| **Journal** | `/api/journal`, `/api/journal/:id` | `Bearer <JWT>`, `X-Company-Id` | `apiClient` | **VERIFIED** |
| **Contacts** | `/api/contacts`, `/api/contacts/:id` | `Bearer <JWT>`, `X-Company-Id` | `apiClient` | **VERIFIED** |
| **Invoices** | `/api/sales/invoices`, `/:id/post`, `/:id/void`, `/:id/pdf` | `Bearer <JWT>`, `X-Company-Id` | `apiClient` & `apiDownload` | **VERIFIED** |
| **Bills** | `/api/purchases/bills`, `/:id/post`, `/:id/void`, `/:id/pdf` | `Bearer <JWT>`, `X-Company-Id` | `apiClient` & `apiDownload` | **VERIFIED** |
| **Payments** | `/api/payments`, `/api/payments/:id` | `Bearer <JWT>`, `X-Company-Id` | `apiClient` | **VERIFIED** |
| **Inventory** | `/api/inventory/products`, `/categories`, `/warehouses`, `/movements`, `/transfers`, `/adjustments` | `Bearer <JWT>`, `X-Company-Id` | `apiClient` | **VERIFIED** |
| **Reports** | `/api/reports/trial-balance`, `/balance-sheet`, `/profit-and-loss`, `/general-ledger`, `/ar-ageing`, `/ap-ageing`, `/cash-flow`, `/tax`, `/export/pdf`, `/export/excel` | `Bearer <JWT>`, `X-Company-Id` | `apiClient` & `apiDownload` | **VERIFIED** |
| **Banking** | `/api/banking/accounts`, `/reconciliation`, `/reconciliation/import` | `Bearer <JWT>`, `X-Company-Id` | `apiClient` | **VERIFIED** |
| **Fiscal Locks** | `/api/fiscal/period-lock`, `/api/fiscal/years`, `/api/fiscal/years/close` | `Bearer <JWT>`, `X-Company-Id` | `apiClient` | **VERIFIED** |
| **Audit Logs** | `/api/audit-logs` | `Bearer <JWT>`, `X-Company-Id` | `apiClient` | **VERIFIED** |
| **Dashboard** | `/api/dashboard/overview`, `/recurring`, `/approvals` | `Bearer <JWT>`, `X-Company-Id` | `apiClient` | **VERIFIED** |

---

## 4. Binary File Downloads & Exports
Previously, several frontend pages used raw `fetch("http://localhost:4000/api/...")` without authentication headers to retrieve PDFs or Excel files. 

**Solution Applied:**
Created `apiDownload(endpoint, defaultFilename, options)` in `frontend/src/lib/api.ts`.
- Automatically injects `Authorization: Bearer <token>` and `X-Company-Id`.
- Intercepts 401 and performs concurrency-safe silent token refresh before retrying the binary download.
- Creates temporary object URLs with proper browser trigger and cleanup (`window.URL.revokeObjectURL`).
- Tested and verified for:
  - Invoices PDF (`/api/sales/invoices/:id/pdf`)
  - Bills PDF (`/api/purchases/bills/:id/pdf`)
  - Financial Report PDF Export (`/api/reports/export/pdf`)
  - Financial Report Excel Export (`/api/reports/export/excel`)
