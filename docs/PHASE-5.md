# PHASE 5: AUDIT TRAIL, ACCOUNTING PERIOD PROTECTION, YEAR-END CLOSING, BANK RECONCILIATION & RBAC

## 1. Executive Summary & Architecture
Phase 5 introduces enterprise-grade governance, immutable audit logging, accounting period locking, automated fiscal year-end closing, bank reconciliation, and multi-tenant Role-Based Access Control (RBAC).

All Phase 5 components strictly uphold the Master Financial Rules:
- **Zero Floating-Point Money**: All financial quantities and balances use Prisma `@db.Decimal(15, 2)`, `Decimal.js` calculations, and exact string representations in REST APIs.
- **Strict Double-Entry Invariant**: Year-end closing creates balanced closing entries where $\sum \text{Debit} \equiv \sum \text{Credit}$.
- **Immutable Financial & Compliance Records**: `AuditLog` records are strictly append-only. Modification (`PUT`/`PATCH`) or deletion (`DELETE`) is prohibited both in the application tier (returning `403 Forbidden: AUDIT_LOG_IMMUTABLE`) and at the PostgreSQL database level (`RULE ... DO INSTEAD NOTHING`).
- **Period & Fiscal Year Locks**: Transactions dated $\le \text{company.lockedUntil}$ or falling within closed fiscal periods (`FiscalYear.isClosed = true`) are blocked with `422 Unprocessable Entity`.
- **Bank Reconciliation Non-Duplication**: Bank statement CSV imports strictly populate statement comparison lines and **NEVER** create duplicate journal entries in the General Ledger.

---

## 2. Core Modules Implemented

### 2.1 Centralized Audit Service & Immutability (`backend/src/modules/audit/` & `src/lib/audit.ts`)
- **Recorded Attributes**: `companyId, userId, model, objectId, action, oldData, newData, ipAddress, timestamp`.
- **Supported Actions**: `CREATE, UPDATE, DELETE, POST, VOID, REVERSE, LOGIN, REGISTER`.
- **Database Immutability Enforcement**:
  ```sql
  CREATE OR REPLACE RULE audit_log_no_update AS ON UPDATE TO "AuditLog" DO INSTEAD NOTHING;
  CREATE OR REPLACE RULE audit_log_no_delete AS ON DELETE TO "AuditLog" DO INSTEAD NOTHING;
  ```
- **REST Endpoints** (Restricted to `OWNER` & `AUDITOR`):
  - `GET /api/audit-logs`: Multi-filter pagination by user, model, action, date range, and keyword search.
  - `GET /api/audit-logs/:id`: Individual event provenance and old vs new data JSON diff analysis.
  - `PUT/PATCH/DELETE /api/audit-logs/:id`: Rejection with `403 Forbidden: AUDIT_LOG_IMMUTABLE`.

### 2.2 Period Lock & Fiscal Year Management (`backend/src/modules/fiscal/`)
- **Period Locking**:
  - `PUT /api/fiscal/period-lock`: Configures `company.lockedUntil`. All financial postings on or before this date fail with `422 PERIOD_LOCKED`.
  - `GET /api/fiscal/period-lock`: Retrieves active lock date.
- **Fiscal Year Administration**:
  - `POST /api/fiscal/years`: Creates fiscal periods ensuring calendar ranges do not overlap (`409 FISCAL_YEAR_OVERLAP`).
  - `GET /api/fiscal/years`: Lists configured fiscal years and closing states.
  - Enforced globally across all journal entries, invoices, purchase bills, and inventory movements via `assertPeriodUnlocked()`.

### 2.3 Automated Year-End Closing Engine (`FiscalService.closeFiscalYear`)
1. Sweeps all `INCOME` accounts: zeroes out their net credit balances via offsetting Debit entries.
2. Sweeps all `EXPENSE` accounts: zeroes out their net debit balances via offsetting Credit entries.
3. Calculates exact Net Income / Loss: $\text{Net Income} = \sum \text{Income Credits} - \sum \text{Expense Debits}$.
4. Generates offsetting equity allocation line:
   - If Net Profit: `Credit: Retained Earnings (3100)`
   - If Net Loss: `Debit: Retained Earnings (3100)`
5. Enforces double-entry equality ($\sum \text{Debit} \equiv \sum \text{Credit}$).
6. Concurrency-safe closing entry created (`sourceType: "YEAR_END_CLOSING"`, status: `POSTED`).
7. Marks `FiscalYear.isClosed = true`.
8. Repeat closing attempts are rejected (`422 FISCAL_YEAR_ALREADY_CLOSED`).
9. Reopening closed years is restricted strictly to `OWNER` and requires mandatory audit justification (`reopenFiscalYear`).

### 2.4 Bank Reconciliation Engine (`backend/src/modules/banking/`)
- **Bank Account Setup**: Links bank accounts to GL asset accounts (e.g., `1002 Bank`).
- **CSV Statement Parser**: Robust parser supporting diverse statement headers (`Date, Description/Reference, Debit/Withdrawal, Credit/Deposit`).
- **Zero-Duplication Assurance**: Imports statement lines as external comparison records; never generates journal entries upon import.
- **Automated Matching Engine**:
  - Matches statement transactions to General Ledger journal lines where amount matches exactly and date is within $\pm 3$ days.
  - Direction alignment: Statement deposits match GL bank debits; statement withdrawals match GL bank credits.
- **Manual Reconciliation**: Allows manual 1-click linking or unlinking of statement records and ledger lines.
- **Reconciliation Status**: Computes Statement Balance vs GL Book Balance adjusted for uncleared deposits and withdrawals. Returns `RECONCILED` when variance is 0.00.

### 2.5 Role-Based Access Control & User Management (`backend/src/modules/users/`)
- **Permission Matrix**:
  | Role | Permissions & Boundaries |
  |---|---|
  | **OWNER** | Full administrative and financial control. User invites, role updates, period locks, year-end closings, reopening. Protected from sole-owner lockout. |
  | **ACCOUNTANT** | Full operational accounting: journal drafts & direct posting, purchase bills, sales invoices, stock movements, and financial reports. Cannot manage team or reopen closed fiscal periods. |
  | **CASHIER** | Invoicing and payments only. Blocked from manual journals, audit logs, and fiscal settings. |
  | **AUDITOR** | Strictly read-only compliance access: financial reports, Chart of Accounts, and Audit Trail. Cannot mutate any financial records (`403 Forbidden`). |

---

## 3. Frontend Compliance & Management Screens

| Route | Feature Description | Visual Standards |
|---|---|---|
| `/audit-log` | Comprehensive Audit Dashboard with multi-filter query bar, action badges, and Old vs New data JSON diff viewer. | Hairline 1px borders, Plus Jakarta Sans headers, JetBrains Mono IDs, timestamps, and JSON formatting. Muted emerald/rose badges. |
| `/settings/fiscal` | Period Lock card with date selector and Fiscal Years table with Year-End Close wizard and Owner Reopen dialog. | Status badges (`OPEN` / `CLOSED`), financial calendar validation, clear visual feedback. |
| `/banking/reconciliation` | Bank Account selector, CSV statement drag-and-drop upload, Reconciliation Difference summary banner, and side-by-side matching interface. | Monospace tabular figures, live difference calculation, 1-click Auto-Match, and manual link/unlink triggers. |
| `/settings/team` | Team directory with Role badges (`OWNER`, `ACCOUNTANT`, `CASHIER`, `AUDITOR`), Invite Member modal, and Role update dropdowns with lockout protection. | RBAC guidance banner, responsive grid, clean dialog overlays. |

---

## 4. Verification & Automated Test Results

All 7 Phase 5 Acceptance Criteria were verified via automated tests in `backend/src/tests/phase5.test.ts`:

```text
 ✓ src/tests/phase5.test.ts (7 tests)
   ✓ Acceptance Criterion 1: Every relevant action creates an immutable AuditLog record with old/new data
   ✓ Acceptance Criterion 2: AuditLog records are strictly immutable and reject UPDATE and DELETE with 403 Forbidden
   ✓ Acceptance Criterion 3: Locked periods and closed fiscal years reject new or edited transactions
   ✓ Acceptance Criterion 4: Year-end closing creates balanced closing entries, zeroes out P&L accounts, and marks fiscal year closed
   ✓ Acceptance Criterion 5: Bank reconciliation imports CSV statement without creating duplicate journal entries and calculates difference
   ✓ Acceptance Criterion 6: User roles enforce strict permission boundaries across OWNER, ACCOUNTANT, and CASHIER
   ✓ Acceptance Criterion 7: Auditor role has read-only access to financial reports and audit logs, but is blocked from mutating records

 Test Files: 6 passed (6)
 Tests:      41 passed (41)
 Duration:   10.23s
```

### Full Monorepo Build Verification:
- **Backend build:** `npm --prefix backend run build` &rarr; `tsc` exit code 0.
- **Backend test suite:** `npm --prefix backend test` &rarr; 6/6 test files, 41/41 tests passing.
- **Frontend build:** `npm --prefix frontend run build` &rarr; 24/24 App Router static routes prerendered with exit code 0.
