# Phase 0: Workspace Rules, Design Intelligence & Tooling Setup

## Status: Completed

### 1. Workspace Rules Locked
The master workspace rules for the Enterprise Accounting & Inventory ERP have been established and configured across:
- `GEMINI.md` (Workspace root)
- `AGENTS.md` (Workspace root)
- `.agents/rules/accounting-erp.md` (Hierarchical agent rule with `always_on` trigger)

### 2. Core Non-Negotiable Directives Enforced
- **Zero Floating-Point Money**: Strictly `@db.Decimal(15, 2)` / `(15, 3)` in Prisma, `decimal.js` in services, numeric strings in JSON APIs.
- **Double-Entry Bookkeeping**: Every transaction generates balanced `JournalEntry` (`SUM(debit) === SUM(credit)`).
- **Immutability**: Posted records return `403 Forbidden` on update/delete; adjustments via reversals/credit/debit notes only.
- **Multi-Tenant Isolation**: `companyId` on all tables (except `User`), resolved server-side from JWT + `X-Company-Id` against `Membership`.
- **Atomic Transactions**: Journal posting, stock movements, and status updates within `prisma.$transaction`.
- **Derived Balances**: Stock = `SUM(StockMovement.quantity)`, Contact balances = derived from `JournalLine`.
- **Concurrency-Safe Sequences**: `SELECT ... FOR UPDATE` on `DocumentSequence`.
- **Audit Trail**: Append-only `AuditLog` for create, update, post, void, login.
- **Period Locks**: Reject entries dated `<= company.lockedUntil` or within closed `FiscalYear`.

### 3. UI/UX & Design Repositories Integrated
- **UI/UX Pro Max Skill**:
  - Cloned and active at `.agents/skills/ui-ux-pro-max/`
  - Sub-skills installed: `ui-ux-pro-max`, `design`, `design-system`, `ui-styling`, `brand`, `banner-design`, `slides`
- **React Bits**:
  - Integrated into `.agents/tooling/react-bits/`
  - Ready for component adoption in `frontend/src/components/react-bits/` (number tickers, spotlight cards, animated tabs)
- **Anti-AI Fingerprint Standard**:
  - Bespoke Financial Slate & Obsidian/Alabaster palette (`#F8F9FA` canvas, `#FFFFFF` surfaces, `#E4E7EC` hairline borders, `#0F172A` ink, Forest Emerald / Cobalt accents).
  - Tabular figures (`tabular-nums`) on all monetary/quantity values.
  - High-density keyboard-first UX (Linear / Stripe / Mercury caliber).

### 4. Next Step
Proceed to **Phase 1: Architecture & Foundation (Two-Folder Monorepo, Database Schema & Authentication)** following the phased execution protocol.
