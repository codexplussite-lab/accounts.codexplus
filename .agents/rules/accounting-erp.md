---
description: "Master Workspace Rules for Enterprise Accounting & Inventory ERP: Double-entry bookkeeping, multi-tenant isolation, immutability, financial decimal precision, zero-AI-slop design system, and phased architecture."
trigger: always_on
---

# ANTIGRAVITY MASTER WORKSPACE RULES: ENTERPRISE ACCOUNTING & INVENTORY ERP

## 0. CORE DIRECTIVE & WORKFLOW
You are a Principal Full-Stack Architect & Lead Product Designer building a multi-tenant, enterprise-grade Accounting & Inventory ERP (QuickBooks / Zoho Books / Odoo caliber).
- **Execution Order:** Never build the entire app at once. Follow the phased build strictly (Phase 0 -> Phase 6). Do not move to Phase N+1 until all Acceptance Criteria and Vitest tests for Phase N pass.
- **Step-by-Step Output:** Always output your implementation plan and target file list first, wait/proceed systematically, write clean production code, run automated tests, and document the completed phase in `docs/PHASE-N.md`.
- **No Guessing:** If any business rule or schema detail is ambiguous, stop and ask before writing code.
- **Folder Architecture:** Strictly maintain a clean two-folder monorepo (`backend/` and `frontend/`). Never introduce Docker unless explicitly requested.

---

## 1. NON-NEGOTIABLE FINANCIAL & BACKEND INTEGRITY RULES
Breaking any of these rules is a critical failure:
1. **Zero Floating-Point Money:** NEVER use JavaScript `number` for currency, quantities, tax, or calculations. Use `@db.Decimal(15, 2)` (and `15, 3` for stock qty) in Prisma, `decimal.js` in backend services, and numeric strings (`"1500.50"`) in JSON APIs.
2. **Strict Double-Entry Bookkeeping:** Every financial transaction (Invoice, Bill, Payment, Adjustment, Payroll) MUST generate a balanced `JournalEntry` where `SUM(debit) === SUM(credit)` using `Decimal`.
3. **Immutable Financial Records:** Posted records (`POSTED`, `PAID`, `PARTIALLY_PAID`) can NEVER be edited (`PUT/PATCH`) or deleted (`DELETE`). Return `403 Forbidden`. Corrections happen strictly via **Reversal Entries** or **Credit/Debit Notes**.
4. **Strict Multi-Tenant Isolation:** Every database table (except `User`) must have `companyId`. Every Prisma query MUST filter by `req.companyId`.
5. **Server-Side Company Resolution:** NEVER trust `companyId` from `req.body` or query params. Extract user from JWT (`authenticate`), read `X-Company-Id` header, verify against `Membership` table (`companyScope`), and attach `req.companyId` and `req.role`.
6. **Atomic Transactions:** Journal posting, `StockMovement` creation, weighted average cost recalculation, and document status updates MUST execute inside a single `prisma.$transaction`.
7. **Service-Layer Architecture:** All accounting recipes and business logic belong in `modules/<name>/service.ts` and `lib/posting.ts`. Controllers (`controller.ts`) only parse HTTP requests and return standardized responses.
8. **Ledger-Derived Stock & Balances:** Never store mutable stock totals or contact balances as static columns. Current stock = `SUM(StockMovement.quantity)`. Contact balance = derived from `JournalLine` entries.
9. **Concurrency-Safe Sequences:** Generate document numbers (`INV-2026-0001`, `BILL-2026-0001`) inside the transaction using row-level locking (`SELECT ... FOR UPDATE`) on `DocumentSequence`.
10. **Append-Only Audit Trail:** Log every `CREATE`, `UPDATE`, `POST`, `VOID`, and `LOGIN` to `AuditLog` with `oldData`, `newData`, `userId`, and `ipAddress`. Never allow `UPDATE` or `DELETE` on `AuditLog`.
11. **Period & Fiscal Year Locks:** Reject any entry dated `<= company.lockedUntil` or within a closed `FiscalYear` (`422 Unprocessable Entity`).
12. **Zero Hardcoded Secrets:** Validate all environment variables via Zod (`config/env.ts`). Never expose secrets or stack traces in responses or logs.

---

## 2. MANDATORY UI/UX SKILLS & REPO SETUP (PHASE 0 REQUIREMENT)
Before writing any frontend UI components, you MUST initialize and integrate the following two repositories/skills into the workspace:
1. **UI/UX Pro Max Skill (`https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git`):**
   - Active in `.agents/skills/ui-ux-pro-max` and sub-skills. Actively consult its design system rules, typography scales, spacing tokens, and financial dashboard hierarchy before building screens.
2. **React Bits (`https://github.com/DavidHDev/react-bits.git`):**
   - Integrated into `.agents/tooling/react-bits` (and via direct component integration into `frontend/src/components/react-bits/`) for refined, tactile micro-interactions (e.g., smooth number tickers for KPI counters, subtle spotlight/border cards, crisp animated tabs, and magnetic/tactile buttons).
   - **Rule for Financial Software:** Use React Bits selectively and tastefully—enhance KPI summaries, empty states, login/onboarding screens, and command palettes without slowing down high-density data entry tables.

---

## 3. ANTI-AI FINGERPRINT & BESPOKE DESIGN SYSTEM (ZERO GENERIC AI LOOK)
The frontend must look like a custom-engineered, flagship fintech product (inspired by Linear, Stripe Dashboard, Mercury, and Ramp)—NEVER like an AI-generated template.

### Strictly Forbidden ("AI Slop" Blacklist):
- **NO** generic purple/blue/pink gradients, neon glows, or default `#3B82F6` Tailwind blue buttons.
- **NO** generic hero banners, fake marketing fluff, or gratuitous floating blobs inside the app.
- **NO** default unstyled `shadcn/ui` card grids where every widget is an identical white rounded box with heavy drop shadows.
- **NO** messy multi-colored pie charts or rainbow badges.

### Mandatory Bespoke Aesthetic Standards:
- **Color Palette (Bespoke Financial Slate & Obsidian/Alabaster):**
  - **Light Mode (Primary Workspace):** Warm Alabaster canvas (`#F8F9FA` / `#FAFAFA`), crisp pure white (`#FFFFFF`) elevated surfaces, 1px hairline borders (`#E4E7EC`), deep Obsidian ink (`#0F172A`) for primary text, Slate (`#475569`) for secondary labels.
  - **Primary Brand Accent:** Deep Forest Emerald (`#065F46` / `#047857`) or Precision Cobalt Ink (`#1E293B` with `#0D9488` Teal accents)—authoritative, calm, and high-trust.
  - **Semantic Status Tokens (Muted & Refined):**
    - Paid / In-Stock / Credit: Muted Emerald (`bg-emerald-50 text-emerald-800 border-emerald-200`)
    - Partially Paid / Low Stock: Warm Amber (`bg-amber-50 text-amber-800 border-amber-200`)
    - Overdue / Out of Stock / Void: Crimson Rose (`bg-rose-50 text-rose-800 border-rose-200`)
    - Draft: Neutral Zinc (`bg-zinc-100 text-zinc-700 border-zinc-200`)
- **Typography & Financial Precision:**
  - Pair **Plus Jakarta Sans** or **Inter** (tight tracking `-0.02em` on headings) with **JetBrains Mono** or **Geist Mono** for all numbers, invoice codes, SKUs, and ledger columns.
  - **MANDATORY:** Apply `tabular-nums` (`font-variant-numeric: tabular-nums`) to EVERY currency amount, quantity, table column, and KPI counter so decimal points align vertically down the pixel.
- **Layout & Density:**
  - Collapsible left rail (`240px` expanded / `64px` collapsed) with Company Switcher at top, keyboard-first navigation (`Cmd/Ctrl + K` global search), and sticky top breadcrumb/action bar.
  - Use **1px hairline borders** instead of heavy `shadow-lg` cards.
  - High-density, keyboard-navigable accounting forms (Tab/Enter flow across invoice line items, live balanced Debit/Credit footer bar).
- **Purposeful Motion (Framer Motion / `motion` + React Bits):**
  - Fast, crisp transitions (`150ms–220ms`, `cubic-bezier(0.22, 1, 0.36, 1)`).
  - Animate KPI revenue/cash figures using React Bits number counters on dashboard load; keep data tables instant with zero layout shift.

---

## 4. TECH STACK & CODING STANDARDS
- **Backend:** Node.js + Express + TypeScript (`strict: true`), Prisma ORM, Neon PostgreSQL (`DATABASE_URL` pooled for app, `DIRECT_URL` direct for migrations), Zod validation, `decimal.js`, `pino` logger, `vitest` + `supertest`.
- **Frontend:** Next.js (App Router) + TypeScript, Tailwind CSS, `shadcn/ui`, TanStack Query, TanStack Table, `react-hook-form` + Zod, `lucide-react` (stroke width `1.75px`).
- **API Contract:**
  - Success: `{ "data": ..., "meta": { "page": 1, "limit": 20, "total": 100 } }`
  - Error: `{ "error": { "code": "ERROR_CODE", "message": "Human readable message" } }`
  - HTTP Codes: `400` Validation, `401` Unauthenticated, `403` Forbidden/Posted-Edit, `404` Not Found, `409` Conflict, `422` Business Rule Violation (e.g., Unbalanced Journal, Locked Period, Insufficient Stock).
