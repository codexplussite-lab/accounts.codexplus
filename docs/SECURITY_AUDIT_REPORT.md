# SECURITY AUDIT & MULTI-TENANCY ISOLATION REPORT

## 1. Executive Summary
An independent security and architecture audit was conducted across the codebase to ensure zero data leakage across companies, complete protection of financial ledger immutability, role-based access control (RBAC) integrity, and defensible token mechanics.

---

## 2. Security Invariants Verified

### A. Multi-Tenant Isolation
- **Rule:** Every database entity (excluding the global `User` account entity) must belong to a `Company` via `companyId`.
- **Implementation:**
  - `backend/src/middleware/auth.ts`: Resolves `req.user` from the verified JWT.
  - `backend/src/middleware/tenant.ts`: Extracts `X-Company-Id` from headers, validates user membership in `Membership` table, attaches `req.companyId` and `req.role`.
  - **Prisma Scoping:** Every service-layer query filters strictly with `where: { companyId: req.companyId }`. Requests passing a malicious or mismatched `companyId` in the body or query params are strictly ignored.
- **Verification:** Acceptance test `src/tests/phase1.test.ts` (Criterion 3) tests that Company A cannot query, update, or read Company B accounts, invoices, or products.

### B. Zero Floating-Point Arithmetic
- **Rule:** JavaScript `number` is strictly forbidden for monetary calculations, ledger entries, tax amounts, or stock quantities.
- **Implementation:**
  - Backend utilizes `decimal.js` exclusively for additions, subtractions, multiplications, weighted averages, and rounding.
  - Prisma schema enforces `@db.Decimal(15, 2)` for currency and `@db.Decimal(15, 3)` for inventory quantities.
  - APIs exchange monetary values as precise numeric strings (`"1500.50"`).
- **Verification:** `src/tests/phase3.test.ts` (Criterion 4) verifies exact decimal calculations in weighted average cost adjustments without floating-point inaccuracies (`0.1 + 0.2 = 0.30000000000000004`).

### C. Immutability of Posted Financial Records
- **Rule:** Once an invoice, bill, payment, or manual journal entry is marked `POSTED`, `PAID`, or `PARTIALLY_PAID`, direct mutation (`PUT/PATCH`) and deletion (`DELETE`) are prohibited with `403 Forbidden`.
- **Implementation:**
  - Services check `if (record.status !== "DRAFT") throw new ForbiddenError("Cannot modify posted financial record. Use reversal or credit note.")`.
  - Corrections must take the form of credit notes, debit notes, or voiding with an atomic reversal journal entry.
- **Verification:** Verified in `src/tests/phase2.test.ts` (Criterion 8) and `src/tests/phase5.test.ts` (Criterion 2).

### D. Concurrency-Safe Sequence Generation
- **Rule:** Document numbers (`INV-2026-0001`, `BILL-2026-0001`) must not collide or skip under heavy concurrent posting.
- **Implementation:**
  - `DocumentSequence` records are fetched and incremented inside a Prisma transaction using row-level locking (`SELECT ... FOR UPDATE`).
- **Verification:** Stress-tested with concurrent posting routines in `src/tests/phase2.test.ts` (Criterion 5).

### E. Append-Only Audit Trail
- **Rule:** All audit records must be immutable.
- **Implementation:**
  - Centralized `AuditService` logs every `CREATE`, `UPDATE`, `DELETE`, `POST`, `VOID`, and `LOGIN`.
  - Schema and service layers prohibit `UPDATE` or `DELETE` on `AuditLog` records.
- **Verification:** Verified in `src/tests/phase5.test.ts` (Criterion 1 & 2).

### F. Role-Based Access Control (RBAC) Matrix
- **Roles:**
  - `OWNER`: Full access to company settings, users, fiscal closures, approvals, and accounting actions.
  - `ACCOUNTANT`: Full operational access to journals, invoices, bills, inventory, and reports. Blocked from user management and company deletion.
  - `CASHIER`: Restricted to creating draft sales invoices, processing customer receipts, and viewing product stock. Blocked from journals, bills, reports, and fiscal lock settings.
  - `AUDITOR`: Read-only access across all reports, general ledger, and audit logs. Blocked from any mutation endpoints.
- **Verification:** Verified across all roles in `src/tests/e2e_enterprise.test.ts` (Workflow 20).
