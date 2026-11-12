# Implementation Roadmap: All-in-One Accounting + Inventory ERP

**Architect**: Principal Full-Stack Architect & Lead Product Designer  
**Source of Truth**: `All-in-One Accounting + Inventory ERP Master Build Document.pdf`  
**Execution Protocol**: Strictly phased execution (Phase 0 $\rightarrow$ Phase 6). No phase starts before all previous acceptance criteria and Vitest test suites pass.

---

## Architecture Overview

```
                      ┌───────────────────────────────────────┐
                      │    Next.js 14 App Router (Frontend)   │
                      │  Alabaster/Obsidian Bespoke Design    │
                      │  Tabular-nums | React Bits | Tailwind │
                      └──────────────────┬────────────────────┘
                                         │ JSON API (CORS/Cookie)
                                         │ Header: X-Company-Id
                                         ▼
                      ┌───────────────────────────────────────┐
                      │        Node.js + Express (API)        │
                      │  Helmet | Rate Limit | Cookie Parser  │
                      └──────────────────┬────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                       │                       │
                 ▼                       ▼                       ▼
      ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
      │   Authentication   │  │   companyScope     │  │  Zod Validation    │
      │  JWT Access (15m)  │  │ Membership Lookup  │  │ Strict Schema      │
      │  Refresh Cookie(7d)│  │ Attaches req.role  │  │ Fails Fast         │
      └────────────────────┘  └────────────────────┘  └────────────────────┘
                                         │
                                         ▼
                      ┌───────────────────────────────────────┐
                      │     Service Layer & Posting Engine    │
                      │       (modules/<name>/service.ts)     │
                      │        lib/posting.ts (Double-Entry)  │
                      │        lib/money.ts (Decimal.js)      │
                      │        lib/sequence.ts (Row Locks)    │
                      └──────────────────┬────────────────────┘
                                         │ Atomic prisma.$transaction
                                         ▼
                      ┌───────────────────────────────────────┐
                      │           Prisma ORM Client           │
                      └──────────────────┬────────────────────┘
                                         │ Pooled (App) / Direct (Migrate)
                                         ▼
                      ┌───────────────────────────────────────┐
                      │        Neon PostgreSQL Database       │
                      │       Multi-Tenant Scoped Tables      │
                      │        Immutable Posted Records       │
                      │        Append-Only AuditLog           │
                      └───────────────────────────────────────┘
```

---

## Phase-by-Phase Roadmap

### PHASE 0: Setup & Scaffolding (Current Status: COMPLETED & VERIFIED)
- **Scope**:
  - Two-folder monorepo (`backend/` & `frontend/`), Git repository, comprehensive `.gitignore`.
  - Backend: Express, Prisma v6, Zod environment validation, Pino logger, Vitest test suite, `/health` route.
  - Complete Section 6 database schema with 21 models, decimal financial precision, and multi-tenant keys.
  - Frontend: Next.js 14 App Router, bespoke financial theme (`#F8F9FA` canvas, `#FFFFFF` surfaces, `#E4E7EC` hairline borders, Obsidian `#0F172A`, Forest Emerald `#065F46`), `tabular-nums`.
  - Skill and tooling setup: `ui-ux-pro-max-skill` and `react-bits` components (`SpotlightCard`, `Counter`).
- **Acceptance Criteria**:
  - [x] `GET /health` returns `200 OK` (Automated Vitest test passing).
  - [x] Prisma schema validates and client compiles (`prisma generate`).
  - [x] Frontend builds cleanly with zero TypeScript errors (`npm run build`).
  - [x] Documented in `docs/PHASE-0.md`.

---

### PHASE 1: Auth, Company, Chart of Accounts, Journal Posting Engine
- **Objective**: Establish the core security boundary, multi-tenant resolution, automated ledger account seeding, and the non-negotiable double-entry posting engine.
- **Backend Deliverables**:
  - `src/modules/auth/`: Registration (atomic User + Company + OWNER Membership), login, refresh token rotation, logout, `GET /me`.
  - `src/middleware/authenticate.ts`: JWT verification with token expiry handling.
  - `src/middleware/companyScope.ts`: Server-side company resolution via `X-Company-Id` verified against `Membership` table.
  - `src/middleware/requireRole.ts`: RBAC permission gate (`OWNER`, `ACCOUNTANT`, `CASHIER`, `AUDITOR`).
  - `src/lib/seedAccounts.ts`: Default Chart of Accounts generator (Cash 1001, Bank 1002, AR 1100, Inventory 1200, Tax Receivable 1300, AP 2001, Sales Tax Payable 2100, Capital 3001, Retained Earnings 3100, Sales 4001, COGS 5001, Operating Expenses).
  - `src/lib/posting.ts`: Core `postJournal(tx, input)` validating $\sum \text{Debit} \equiv \sum \text{Credit}$ with `Decimal`, period lock verification, and row-locked sequence numbers.
  - `src/lib/sequence.ts`: Concurrency-safe document numbering via `SELECT ... FOR UPDATE` on `DocumentSequence`.
  - `src/modules/accounts/`: Hierarchical account tree API, protection preventing mutation of system accounts.
  - `src/modules/journal/`: Draft creation, posting, reversing, and immutable protection (`403 Forbidden` on PUT/DELETE of posted entries).
- **Frontend Deliverables**:
  - Authentication views: Login page, persistent token refresh handling.
  - Workspace layout: Collapsible left navigation rail (240px / 64px), Company Switcher dropdown, top breadcrumbs.
  - Chart of Accounts page: Tree view displaying parent-child relationships and system keys.
  - Journal Entry Form: Keyboard-navigable multi-line data table (Tab/Enter), live debit/credit total tally bar, disabled Post button if unbalanced.
- **Acceptance Criteria**:
  - [ ] Unbalanced journal entries are rejected with `422 Unprocessable Entity` (Vitest test).
  - [ ] Cross-tenant access is blocked: Company A user cannot read Company B records (Vitest test).
  - [ ] Posted journal entries reject PUT and DELETE requests with `403 Forbidden` (Vitest test).
  - [ ] Entries with dates falling in a locked period or closed fiscal year are rejected (Vitest test).
  - [ ] `AUDITOR` role is restricted to read-only access (Vitest test).
  - [ ] Creating a company automatically provisions standard system accounts.
  - [ ] Documented in `docs/PHASE-1.md`.

---

### PHASE 2: Contacts, Tax, Sales Invoices, Purchase Bills, Payments
- **Objective**: Implement customer/vendor management, tax rates, sales and purchase billing engines with automatic double-entry journal generation and payment allocations.
- **Backend Deliverables**:
  - `src/modules/contacts/`: Customer and Vendor CRUD with ledger-derived contact balance calculation.
  - `src/modules/taxes/`: TaxRate CRUD supporting Pakistan Sales Tax and configurable VAT percentages.
  - `src/modules/sales/`:
    - Draft invoice creation and line-item tax calculation.
    - Posting Recipe:
      - `Dr Accounts Receivable (total)`
      - `Cr Sales Income (subtotal)`
      - `Cr Sales Tax Payable (taxTotal)`
      - Stock items: `Dr COGS (qty × WAC)`, `Cr Inventory (qty × WAC)` + `StockMovement(SALE, -qty)`.
  - `src/modules/purchases/`:
    - Bill posting recipe:
      - `Dr Inventory / Expense (subtotal)`
      - `Dr Tax Receivable (taxTotal)`
      - `Cr Accounts Payable (total)`
      - `+ StockMovement(PURCHASE, +qty)` + recalculate weighted average cost.
  - `src/modules/payments/`: Payment receipt/disbursement allocating amounts to invoices/bills, updating `paidAmount` and status (`PARTIALLY_PAID` / `PAID`).
  - `src/modules/sales/creditNote.ts`: Reversal and credit note mechanics.
  - `src/lib/pdf.ts`: Invoice PDF rendering endpoint (`GET /api/invoices/:id/pdf`).
- **Frontend Deliverables**:
  - Contacts directory with live ledger balance display.
  - High-density Invoice & Bill creation screens with auto-completing item selectors, automatic line calculations, and live subtotal/tax summary.
  - Payment collection modal.
  - PDF invoice preview dialog and download trigger.
- **Acceptance Criteria**:
  - [ ] Invoice posting creates a balanced journal entry in the same transaction (Vitest test).
  - [ ] Partial payments update status to `PARTIALLY_PAID`; full payment transitions to `PAID` (Vitest test).
  - [ ] Concurrent invoice creation generates strictly sequential, non-colliding numbers (Concurrency test).
  - [ ] Customer contact balance strictly matches the sum of unsettled AR journal lines.
  - [ ] PDF generates with accurate company header, NTN, items, tax breakdown, and balance due.
  - [ ] Documented in `docs/PHASE-2.md`.

---

### PHASE 3: Inventory Engine, Warehouses, Stock Tracking, WAC Valuation
- **Objective**: Multi-warehouse stock tracking, opening stock journalization, stock adjustments, weighted average cost recalculation, and stock valuation reports.
- **Backend Deliverables**:
  - `src/modules/inventory/`: Products, Categories, and Warehouses CRUD. Default warehouse provisioned per company.
  - `src/modules/inventory/openingStock.ts`: Opening stock entry generating `StockMovement(OPENING)` and `Dr Inventory, Cr Capital`.
  - `src/modules/inventory/adjustment.ts`: Stock adjustments (`ADJUSTMENT`) with mandatory audit reason and automated balancing journal.
  - `src/modules/inventory/transfers.ts`: Inter-warehouse stock transfers (`TRANSFER_OUT` + `TRANSFER_IN`).
  - WAC recalculation formula executed atomically on purchase bill posting:
    $$\text{newCost} = \frac{(\text{oldQty} \times \text{oldCost}) + (\text{newQty} \times \text{newCost})}{\text{oldQty} + \text{newQty}}$$
  - Out-of-stock guard: Rejects sales invoice posting if `allowNegativeStock === false` and available quantity is insufficient.
  - High-performance groupBy inventory aggregations without N+1 query overhead.
  - `src/jobs/lowStockAlert.ts`: BullMQ worker running daily stock evaluation.
- **Frontend Deliverables**:
  - Products catalog with semantic stock status badges (Emerald: in-stock, Amber: low-stock, Crimson: out-of-stock).
  - Stock adjustment and warehouse transfer modals.
  - Stock Summary and Stock Ledger report views.
- **Acceptance Criteria**:
  - [ ] Purchase bills increment stock; sales invoices decrement stock (Vitest test).
  - [ ] Invoice posting is rejected if available stock is insufficient and negative stock is disabled (Vitest test).
  - [ ] Total inventory valuation matches the balance of the Inventory asset account in the general ledger (Invariant test).
  - [ ] Ending balance on the stock ledger equals current derived stock quantity.
  - [ ] Documented in `docs/PHASE-3.md`.

---

### PHASE 4: Financial Statements & Financial Reporting
- **Objective**: Generate enterprise-grade financial statements derived exclusively from `POSTED` journal entries using database-level aggregation.
- **Deliverables**:
  - **General Ledger**: Account-level transactional details with running balances.
  - **Trial Balance**: Account debit and credit aggregates verifying $\sum \text{Debit} \equiv \sum \text{Credit}$.
  - **Profit & Loss (Income Statement)**: Net income derived from Revenue minus Operating Expenses for any user-defined date range.
  - **Balance Sheet**: Assets = Liabilities + Equity (incorporating net profit into equity for the period).
  - **AR / AP Ageing Report**: Categorized into 0-30, 31-60, 61-90, and 90+ day aging buckets.
  - **Cash Flow Statement**: Inflows and outflows across Cash and Bank accounts.
  - **Export Engine**: Excel spreadsheet generation (ExcelJS) and formatted PDF reports.
  - **Frontend**: Date-range filtering, tabular reports with monospace aligned numbers, and instant export buttons.
- **Acceptance Criteria**:
  - [ ] Trial balance totals are equal across multiple simulated complex transactions (Vitest test).
  - [ ] Balance Sheet equation $\text{Assets} = \text{Liabilities} + \text{Equity}$ balances to the penny (Vitest test).
  - [ ] General Ledger closing balance precisely matches the corresponding Trial Balance account row.
  - [ ] Unbalanced reporting states fail automated validation.
  - [ ] Documented in `docs/PHASE-4.md`.

---

### PHASE 5: Audit Trail, Period Lock, Bank Reconciliation, User Management
- **Objective**: Enforce enterprise compliance, immutable audit logging, fiscal year-end closings, and bank reconciliation.
- **Deliverables**:
  - `src/lib/audit.ts`: Interceptor creating immutable `AuditLog` rows (`oldData` vs `newData` snapshots) on every mutate action.
  - PostgreSQL trigger preventing `UPDATE` and `DELETE` queries on the `AuditLog` table.
  - Period Lock UI & Year-End Closing Engine: Automates closing of revenue and expense accounts into Retained Earnings (3100) and marks `FiscalYear.isClosed = true`.
  - Bank Reconciliation Module: CSV bank statement parser, automated transaction matching by date/amount, difference calculation, and reconciled state toggles.
  - Team Management: Invite members, assign roles (`OWNER`, `ACCOUNTANT`, `CASHIER`, `AUDITOR`), and deactivate access.
- **Acceptance Criteria**:
  - [ ] Every create, update, post, and void action writes an `AuditLog` record (Vitest test).
  - [ ] No transactions can be posted within a locked date range or closed fiscal period (Vitest test).
  - [ ] Direct database `UPDATE` or `DELETE` statements on `AuditLog` are blocked by database constraints.
  - [ ] Auditor role can inspect reports and logs but cannot mutate data.
  - [ ] Documented in `docs/PHASE-5.md`.

---

### PHASE 6: Polish, Dashboard Analytics, Multi-Currency & Production Deployment
- **Objective**: Finalize executive KPI dashboards, recurring transaction automations, multi-currency support, and production deployment scripts.
- **Deliverables**:
  - Real-time financial dashboard with cash runway, receivables/payables aging, revenue vs expense curves, and low-stock alerts.
  - Recurring invoices powered by BullMQ cron workers.
  - Production deployment configurations: Vercel for frontend, Railway/Render for backend, and Neon PostgreSQL connection branching (`main` vs `dev`).
  - Production security verification: Rate-limiting, strict CORS, HTTPS, secret sanitization, and Sentry error telemetry.
- **Acceptance Criteria**:
  - [ ] All automated tests pass across backend and frontend suites.
  - [ ] Zero ESLint and TypeScript compilation warnings or errors.
  - [ ] Production build succeeds and deploys to target environments without secrets leakage.
  - [ ] Documented in `docs/PHASE-6.md`.

---

## Quality & Governance Gates

1. **Zero Floating-Point Money**: Any use of JS native `+`, `-`, `*`, `/` on currency or stock quantities will fail code review. Only `Decimal` is permitted.
2. **Immutable Posted Records**: Any controller endpoint attempting to execute a Prisma `update` or `delete` on an invoice, bill, or journal entry with status `POSTED` will be rejected.
3. **Double-Entry Balance Invariant**: All posting functions must assert $\sum \text{Debit} - \sum \text{Credit} === 0$ before commit.
4. **Tenant Scoping**: All Prisma calls must include `companyId: req.companyId`. Direct trust of client-provided IDs is strictly forbidden.

