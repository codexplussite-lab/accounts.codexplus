# Phase 1: Authentication, Multi-Company, Chart of Accounts & Journal Engine

**Phase**: 1 — Core Accounting & Multi-Company Foundation  
**Date**: November 12, 2026  
**Status**: COMPLETED & VERIFIED  
**Source of Truth**: `All-in-One Accounting + Inventory ERP Master Build Document.pdf` (Sections 1 to 14)

---

## 1. Executive Summary

Phase 1 implements the security, multi-company isolation, chart of accounts hierarchy, and the double-entry journal posting engine that serves as the core foundation for all subsequent financial modules (Sales Invoices, Purchase Bills, Payments, Inventory, and Financial Statements).

All **15 Non-Negotiable Financial Rules** are enforced at the service and database transaction boundaries.

---

## 2. Completed Deliverables by Part

### PART 1: Authentication
- **Registration**:
  - `POST /api/auth/register` creates `User`, `Company`, `OWNER` `Membership`, 15 Default Chart of Accounts, and Default Warehouse in a **single atomic transaction** (`prisma.$transaction`).
  - Passwords hashed with `bcrypt` cost 12.
- **Login & Tokens**:
  - `POST /api/auth/login` verifies credentials and issues:
    - 15-minute JWT access token containing `userId`.
    - 7-day JWT refresh token stored in an `httpOnly`, `sameSite: "lax"` secure cookie.
- **Refresh & Me**:
  - `POST /api/auth/refresh` validates the refresh cookie and rotates access tokens.
  - `GET /api/auth/me` returns current user profile and authorized company memberships.
  - `POST /api/auth/logout` clears the refresh cookie.

---

### PART 2: Multi-Company Architecture & RBAC
- **Server-Side Company Resolution ([backend/src/middleware/companyScope.ts](file:///c:/Users/syedm/OneDrive/Desktop/codex%20account%20softwer/backend/src/middleware/companyScope.ts))**:
  - Reads `X-Company-Id` header.
  - Validates active membership against the `Membership` database table for `req.user.id`.
  - Attaches verified `req.companyId` and `req.role` to the request context.
  - Returns `400 Bad Request` if `X-Company-Id` is missing; returns `403 Forbidden` (`FORBIDDEN_COMPANY_ACCESS`) if a user attempts to access a company where they lack verified membership.
- **Role-Based Access Control ([backend/src/middleware/requireRole.ts](file:///c:/Users/syedm/OneDrive/Desktop/codex%20account%20softwer/backend/src/middleware/requireRole.ts))**:
  - Enforces permissions across roles: `OWNER`, `ACCOUNTANT`, `CASHIER`, `AUDITOR`.
  - Enforces that `AUDITOR` can inspect reports and accounts (`GET`), but is blocked (`403 Forbidden`) from executing any mutation (`POST`, `PATCH`, `DELETE`).

---

### PART 3: Chart of Accounts
- **Default Seed Accounts ([backend/src/lib/seedAccounts.ts](file:///c:/Users/syedm/OneDrive/Desktop/codex%20account%20softwer/backend/src/lib/seedAccounts.ts))**:
  - Assets: `1001 Cash` (`CASH`), `1002 Bank` (`BANK`), `1100 Accounts Receivable` (`AR`), `1200 Inventory` (`INVENTORY`), `1300 Tax Receivable` (`TAX_RECEIVABLE`).
  - Liabilities: `2001 Accounts Payable` (`AP`), `2100 Sales Tax Payable` (`SALES_TAX_PAYABLE`).
  - Equity: `3001 Capital` (`CAPITAL`), `3100 Retained Earnings` (`RETAINED_EARNINGS`).
  - Income: `4001 Sales` (`SALES`).
  - Expenses: `5001 Cost of Goods Sold` (`COGS`), `6001 Rent`, `6002 Salaries`, `6003 Utilities`, `6004 Miscellaneous Expense`.
- **System Account Protection**:
  - System accounts (`isSystem: true`) reject deletion requests with `403 Forbidden` (`SYSTEM_ACCOUNT_PROTECTED`).
  - Accounts with recorded transactions cannot be deleted (`422 ACCOUNT_IN_USE`).
- **APIs**:
  - `GET /api/accounts` (filter by type, search query, active status)
  - `GET /api/accounts/tree` (hierarchical parent-child nested tree)
  - `POST /api/accounts` (create account with code uniqueness)
  - `PATCH /api/accounts/:id` (update name/parent/active status)
  - `DELETE /api/accounts/:id` (protected delete)

---

### PART 4: Journal Entries & Posting Engine ([backend/src/lib/posting.ts](file:///c:/Users/syedm/OneDrive/Desktop/codex%20account%20softwer/backend/src/lib/posting.ts))
- **`postJournal(tx, input)` Core Service**:
  - Minimum 2 lines validation.
  - Strict mutual exclusivity: Line must have Debit > 0 OR Credit > 0, never both.
  - Zero floating-point arithmetic: Totals computed using `decimal.js` (`Decimal`).
  - Strict balance equality: $\sum \text{Debit} \equiv \sum \text{Credit}$. Rejects unbalanced entries with `422 Unprocessable Entity` (`UNBALANCED_ENTRY`).
  - Accounting period lock verification: Rejects if entry date $\le$ `company.lockedUntil` (`422 PERIOD_LOCKED`) or in a closed `FiscalYear` (`422 FISCAL_YEAR_CLOSED`).
  - Concurrency-safe sequence numbering: `getNextSequence` generates `JV-YYYY-XXXX` within the transaction.
  - Append-only audit log: Records `POST` action with metadata in `AuditLog`.
- **Immutability of Financial Records (Rule 3)**:
  - Posted entries reject `PATCH` or `DELETE` with `403 Forbidden` (`IMMUTABLE_RECORD`).
- **Reversal Entries**:
  - `POST /api/journal/:id/reverse` creates a balancing reversal entry swapping all debits and credits, marks the original as `REVERSED` with `reversedById`, and logs the audit event.

---

### PART 5: Frontend Interface
- **Authentication**:
  - [`/login`](file:///c:/Users/syedm/OneDrive/Desktop/codex%20account%20softwer/frontend/src/app/(auth)/login/page.tsx): Professional login card with error alerts and token persistence.
  - [`/register`](file:///c:/Users/syedm/OneDrive/Desktop/codex%20account%20softwer/frontend/src/app/(auth)/register/page.tsx): Multi-field registration provisioning company, accounts, and owner.
- **Chart of Accounts ([/accounts](file:///c:/Users/syedm/OneDrive/Desktop/codex%20account%20softwer/frontend/src/app/(dashboard)/accounts/page.tsx))**:
  - Filter tabs (`All`, `Asset`, `Liability`, `Equity`, `Income`, `Expense`), search filter, system lock badges, and "New Account" modal.
- **Journal Entries ([/journal](file:///c:/Users/syedm/OneDrive/Desktop/codex%20account%20softwer/frontend/src/app/(dashboard)/journal/page.tsx))**:
  - Status filters (`All`, `Posted`, `Draft`, `Reversed`), table with tabular debits/credits, lines detail modal.
- **New Journal Entry Form ([/journal/new](file:///c:/Users/syedm/OneDrive/Desktop/codex%20account%20softwer/frontend/src/app/(dashboard)/journal/new/page.tsx))**:
  - Account selector, memo, debit, credit inputs.
  - Add / remove rows (minimum 2 rows enforced).
  - Sticky bottom live balance bar: displays Total Debit, Total Credit, Difference ($\Delta$), and dynamic BALANCED / OUT OF BALANCE badges.
  - "Post Entry" button is disabled whenever the entry is unbalanced.

---

## 3. Acceptance Criteria Verification

| # | Acceptance Criteria | Target Condition | Result | Evidence |
| :- | :--- | :--- | :--- | :--- |
| **1** | **Unbalanced journal rejected** | $\sum \text{Dr} \neq \sum \text{Cr} \rightarrow 422$ | **PASSED** | Vitest test: `UNBALANCED_ENTRY` rejected with 422 |
| **2** | **Company A cannot access Company B** | Cross-tenant access $\rightarrow 403$ | **PASSED** | Vitest test: `FORBIDDEN_COMPANY_ACCESS` returned |
| **3** | **Posted journal cannot be edited/deleted** | PUT/PATCH/DELETE $\rightarrow 403$ | **PASSED** | Vitest test: `IMMUTABLE_RECORD` returned on edit/delete |
| **4** | **Closed period rejects journal** | Date $\le$ `lockedUntil` $\rightarrow 422$ | **PASSED** | Vitest test: `PERIOD_LOCKED` returned with 422 |
| **5** | **AUDITOR role cannot mutate** | Auditor write $\rightarrow 403$ | **PASSED** | Vitest test: `INSUFFICIENT_PERMISSIONS` on POST /accounts & /journal |
| **6** | **New company receives default accounts** | 15 accounts + warehouse | **PASSED** | Vitest test: Seeding verified (1001, 1002, 1100, 1200, 4001, etc.) |
| **7** | **Authentication & refresh token work** | Register, login, refresh | **PASSED** | Vitest test: Tokens generated, refresh cookie verified, `GET /me` 200 |

---

## 4. Actual Terminal Test Output

```bash
$ cd backend; npm test

> accounting-erp-backend@1.0.0 test
> vitest run

 RUN  v3.2.7 C:/Users/syedm/OneDrive/Desktop/codex account softwer/backend

 ✓ src/tests/health.test.ts (3 tests) 71ms
 ✓ src/tests/phase1.test.ts (10 tests) 1315ms
   ✓ Acceptance Criterion 1: User registration creates User, Company, OWNER membership, 15 Default Accounts, and Default Warehouse (473ms)
   ✓ Acceptance Criterion 2: User Login and Token Refresh work correctly (364ms)
   ✓ Acceptance Criterion 3: Multi-Tenant Isolation - Company A user cannot access Company B data (392ms)
   ✓ Acceptance Criterion 4: Strict Double-Entry - Unbalanced journal entries are rejected with 422
   ✓ Acceptance Criterion 5: Balanced journal entries post successfully with concurrency sequence
   ✓ Acceptance Criterion 6: Immutable Financial Records - Posted journals cannot be edited or deleted (403)
   ✓ Acceptance Criterion 7: Corrections happen via Reversal Entries (Reversal reverses debits and credits)
   ✓ Acceptance Criterion 8: Period Lock & Fiscal Year Lock reject entries
   ✓ Acceptance Criterion 9: System Accounts cannot be deleted or have protected properties mutated
   ✓ Acceptance Criterion 10: Role-Based Access Control - AUDITOR role cannot mutate records

 Test Files  2 passed (2)
      Tests  13 passed (13)
   Start at  15:08:41
   Duration  3.24s
```

---

## 5. Next Steps

Phase 1 is complete, verified, and documented. Per the master workflow protocol:
- **Phase 2 will NOT begin automatically.**
- Awaiting user instruction before proceeding to **Phase 2: Contacts, Tax, Sales Invoices, Purchase Bills & Payments**.

