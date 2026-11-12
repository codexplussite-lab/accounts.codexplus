# PHASE 3: INVENTORY MANAGEMENT, WAREHOUSES, STOCK MOVEMENTS & WAC ENGINE

## 1. Executive Summary & Architecture
Phase 3 establishes an enterprise-grade Inventory Engine fully integrated with Double-Entry Accounting, Multi-Warehouse Logistics, and Concurrency-Safe Stock Tracking.

Following the core architecture of QuickBooks, Zoho Books, and Odoo, stock quantities and contact balances are **never stored as mutable columns** susceptible to drift. Instead, all inventory levels are dynamically derived from an append-only subledger of `StockMovement` records, while financial inventory assets are strictly reconciled against General Ledger Account `1200 · Inventory Asset`.

---

## 2. Strict Financial & Inventory Rules Implemented

| Rule | Specification | Implementation Verification |
|---|---|---|
| **Zero Floating-Point** | Quantities (`15, 3`) and Costs/Valuations (`15, 2`) | Evaluated via `Decimal.js` in services, `@db.Decimal` in Prisma, formatted as exact decimal strings in APIs. |
| **Ledger-Derived Stock** | No static `stock` counter in database | `currentStock = SUM(StockMovement.quantity)`. |
| **WAC Formula** | Exact Weighted Average Cost valuation | $\text{WAC} = \frac{(\text{Old Qty} \times \text{Old Cost}) + (\text{New Qty} \times \text{New Cost})}{\text{Old Qty} + \text{New Qty}}$ using `ROUND_HALF_UP(2)`. |
| **Double-Entry Accounting** | Atomic journal posting for inventory | Opening Stock: `Dr 1200 Inventory / Cr 3001 Capital`. Stock Adjustment: `Dr 1200 / Cr 5001 COGS` (Surplus) or `Dr 5001 / Cr 1200` (Deficit). |
| **Negative Stock Guard** | Configurable company-level stock policy | If `allowNegativeStock === false`, transactions causing negative balances fail immediately with `422 INSUFFICIENT_STOCK`. |
| **Subledger Reconciliation** | Subledger valuation matches General Ledger | Subledger $\sum (\text{Stock} \times \text{WAC})$ reconciled against `Dr - Cr` on GL Account `1200`. Zero variance enforced. |
| **Warehouse Transfers** | Net company stock conserved | Creates `TRANSFER_OUT` (-qty) and `TRANSFER_IN` (+qty) atomically. Net company delta is `0.000`. |
| **Background Alerts** | BullMQ + Redis with in-memory fallback | Evaluates safety thresholds and logs low/out-of-stock items. |

---

## 3. Implemented Modules & File Structure

### Backend Modules (`backend/src/`)
- `modules/inventory/schema.ts`: Strict Zod validation schemas for products, categories, warehouses, opening stock, adjustments, and warehouse transfers.
- `modules/inventory/product.service.ts`: Product CRUD, dynamic stock derivation (`SUM(quantity)`), stock status flags (`IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`), total valuation, and deletion protection for products with movement history.
- `modules/inventory/category.service.ts`: Category management.
- `modules/inventory/warehouse.service.ts`: Multi-warehouse management, default warehouse protection, and warehouse-wise stock breakdown.
- `modules/inventory/stockMovement.service.ts`:
  - `recordOpeningStock`: Balanced journal (`Dr Inventory, Cr Capital`) + `OPENING` stock movement.
  - `recordStockAdjustment`: Mandatory audit reason, negative stock guard, balanced journal (`Dr/Cr Inventory, Cr/Dr COGS`) + `ADJUSTMENT` movement.
  - `recordWarehouseTransfer`: Atomic source subtraction (`TRANSFER_OUT`) and destination addition (`TRANSFER_IN`).
- `modules/inventory/reports.service.ts`: Stock Summary, Stock Ledger with chronological running balance, Subledger-to-GL Valuation Reconciliation, and Warehouse Distribution.
- `jobs/stockAlerts.ts`: Resilient stock alert scheduler powered by BullMQ + Redis with in-process evaluation fallback.
- `modules/inventory/controller.ts`: Express controllers mapping HTTP requests to service recipes with standardized responses.
- `modules/inventory/routes.ts`: Secured and validated routes mounted at `/api/inventory`.

### Frontend Applications (`frontend/src/`)
- `app/(dashboard)/inventory/page.tsx`: Flagship Inventory Dashboard featuring active SKUs, total WAC asset valuation, status indicators (Emerald / Amber / Crimson), category & status filtering, search, and a "+ New Product" modal.
- `app/(dashboard)/inventory/adjustments/page.tsx`: Stock Adjustment form with product selector, delta quantity (+/-), mandatory audit reason input, and **Live Double-Entry Journal Preview** verifying $\sum \text{Dr} \equiv \sum \text{Cr}$.
- `app/(dashboard)/inventory/transfers/page.tsx`: Warehouse Transfer form with source/destination routing, stock conservation preview, and net company zero-impact verification.
- `app/(dashboard)/inventory/ledger/page.tsx`: Comprehensive Stock Ledger view displaying product snapshot, running quantities, historical unit costs, and audit trails wrapped in Next.js `<Suspense>`.
- `app/(dashboard)/inventory/reports/page.tsx`: Valuation & GL Reconciliation Dashboard featuring Subledger vs GL comparison card, 100% Reconciled status pill, Warehouse Distribution breakdown, and Reorder Level Alerts.

---

## 4. Verification & Automated Test Results

The automated test suite (`backend/src/tests/phase3.test.ts`) verifies all 8 Acceptance Criteria specified in Section 14 of the Master Build Document:

```text
 ✓ src/tests/phase3.test.ts (8 tests) 6255ms
   ✓ PHASE 3 ACCEPTANCE TEST SUITE: INVENTORY & STOCK ENGINE > Acceptance Criterion 1: Purchase increases stock  904ms
   ✓ PHASE 3 ACCEPTANCE TEST SUITE: INVENTORY & STOCK ENGINE > Acceptance Criterion 2: Sales decrease stock  690ms
   ✓ PHASE 3 ACCEPTANCE TEST SUITE: INVENTORY & STOCK ENGINE > Acceptance Criterion 3: Negative stock is rejected when allowNegativeStock is disabled  718ms
   ✓ PHASE 3 ACCEPTANCE TEST SUITE: INVENTORY & STOCK ENGINE > Acceptance Criterion 4: Weighted average cost is calculated correctly using Decimal formula  801ms
   ✓ PHASE 3 ACCEPTANCE TEST SUITE: INVENTORY & STOCK ENGINE > Acceptance Criterion 5: Stock ledger running balance matches current derived stock  971ms
   ✓ PHASE 3 ACCEPTANCE TEST SUITE: INVENTORY & STOCK ENGINE > Acceptance Criterion 6: Total stock valuation matches Inventory general ledger account  912ms
   ✓ PHASE 3 ACCEPTANCE TEST SUITE: INVENTORY & STOCK ENGINE > Acceptance Criterion 7: Warehouse transfers preserve total company stock quantity  717ms
   ✓ PHASE 3 ACCEPTANCE TEST SUITE: INVENTORY & STOCK ENGINE > Acceptance Criterion 8: Stock adjustment requires mandatory reason and atomic double-entry journal  539ms

 Test Files  4 passed (4)
      Tests  28 passed (28)
```

Both TypeScript compilers build cleanly:
- Backend: `npm --prefix backend run build` &rarr; `tsc` exited with code 0.
- Frontend: `npm --prefix frontend run build` &rarr; `next build` 19/19 routes statically prerendered with code 0.
