import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { createInMemoryPrisma } from "./mocks/prismaMock.js";
import { Decimal } from "decimal.js";

let inMemory: ReturnType<typeof createInMemoryPrisma>;

vi.mock("../config/prisma.js", async () => {
  return {
    get prisma() {
      return inMemory.db;
    }
  };
});

describe("PHASE 3 ACCEPTANCE TEST SUITE: INVENTORY & STOCK ENGINE", () => {
  let token: string;
  let companyId: string;
  let defaultWarehouseId: string;
  let secondaryWarehouseId: string;
  let customerId: string;
  let vendorId: string;
  let productId: string;

  beforeEach(async () => {
    inMemory = createInMemoryPrisma();

    // 1. Register test company & user (provisions default warehouse & default accounts)
    const regRes = await request(app).post("/api/auth/register").send({
      email: "inventory@enterprise.com",
      password: "EnterprisePassword123!",
      name: "Inventory Manager Bob",
      companyName: "Global Distribution Hub"
    });

    token = regRes.body.data.accessToken;
    companyId = regRes.body.data.company.id;

    // Get default warehouse
    const whRes = await request(app)
      .get("/api/inventory/warehouses")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    defaultWarehouseId = whRes.body.data[0]?.id || "default-wh";

    // Create a secondary warehouse
    const wh2Res = await request(app)
      .post("/api/inventory/warehouses")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        name: "North Logistics Depot",
        isDefault: false
      });
    secondaryWarehouseId = wh2Res.body.data.id;

    // Create Customer
    const custRes = await request(app)
      .post("/api/contacts")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        name: "Metro Retailers",
        type: "CUSTOMER"
      });
    customerId = custRes.body.data.id;

    // Create Vendor
    const vendRes = await request(app)
      .post("/api/contacts")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        name: "Steel Mills Ltd",
        type: "VENDOR"
      });
    vendorId = vendRes.body.data.id;

    // Create Product (trackStock: true, costPrice: 100.00, salePrice: 150.00, reorderLevel: 10.000)
    const prodRes = await request(app)
      .post("/api/inventory/products")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        sku: "STEEL-BAR-10MM",
        name: "Deformed Steel Bar 10mm",
        unit: "kg",
        costPrice: "100.00",
        salePrice: "150.00",
        reorderLevel: "10.000",
        trackStock: true
      });
    productId = prodRes.body.data.id;
  });

  it("Acceptance Criterion 1: Purchase increases stock", async () => {
    // Initial stock is 0
    const initialProd = await request(app)
      .get(`/api/inventory/products/${productId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);
    expect(initialProd.body.data.currentStock).toBe("0.000");

    // Post purchase bill of 50 units
    const billRes = await request(app)
      .post("/api/purchases/bills")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        contactId: vendorId,
        date: "2026-03-01",
        items: [{ productId, quantity: "50", unitCost: "100.00" }]
      });

    await request(app)
      .post(`/api/purchases/bills/${billRes.body.data.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    // Current stock should now be 50.000
    const updatedProd = await request(app)
      .get(`/api/inventory/products/${productId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(updatedProd.body.data.currentStock).toBe("50.000");
    expect(updatedProd.body.data.stockStatus).toBe("IN_STOCK");
  });

  it("Acceptance Criterion 2: Sales decrease stock", async () => {
    // 1. Purchase 40 units first
    const bill = await request(app)
      .post("/api/purchases/bills")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        contactId: vendorId,
        date: "2026-03-01",
        items: [{ productId, quantity: "40", unitCost: "100.00" }]
      });
    await request(app).post(`/api/purchases/bills/${bill.body.data.id}/post`).set("Authorization", `Bearer ${token}`).set("X-Company-Id", companyId);

    // 2. Sell 15 units
    const inv = await request(app)
      .post("/api/sales/invoices")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        contactId: customerId,
        date: "2026-03-02",
        items: [{ productId, quantity: "15", unitPrice: "150.00" }]
      });

    await request(app)
      .post(`/api/sales/invoices/${inv.body.data.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    // Stock should be 40 - 15 = 25.000
    const prodAfterSale = await request(app)
      .get(`/api/inventory/products/${productId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(prodAfterSale.body.data.currentStock).toBe("25.000");
  });

  it("Acceptance Criterion 3: Negative stock is rejected when allowNegativeStock is disabled", async () => {
    // Current stock is 0. Attempting to sell 5 units must fail with 422
    const inv = await request(app)
      .post("/api/sales/invoices")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        contactId: customerId,
        date: "2026-03-05",
        items: [{ productId, quantity: "5", unitPrice: "150.00" }]
      });

    const postRes = await request(app)
      .post(`/api/sales/invoices/${inv.body.data.id}/post`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(postRes.status).toBe(422);
    expect(postRes.body.error.code).toBe("INSUFFICIENT_STOCK");

    // Also verify negative stock adjustment rejection
    const adjRes = await request(app)
      .post("/api/inventory/adjustment")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        productId,
        warehouseId: defaultWarehouseId,
        quantity: "-10",
        reason: "Unauthorized shrinkage deduction"
      });

    expect(adjRes.status).toBe(422);
    expect(adjRes.body.error.code).toBe("INSUFFICIENT_STOCK");
  });

  it("Acceptance Criterion 4: Weighted average cost is calculated correctly using Decimal formula", async () => {
    // 1. Initial Purchase: 10 units @ 100.00 = 1000.00 valuation (WAC = 100.00)
    const bill1 = await request(app)
      .post("/api/purchases/bills")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        contactId: vendorId,
        date: "2026-03-01",
        items: [{ productId, quantity: "10", unitCost: "100.00" }]
      });
    await request(app).post(`/api/purchases/bills/${bill1.body.data.id}/post`).set("Authorization", `Bearer ${token}`).set("X-Company-Id", companyId);

    // 2. Second Purchase: 20 units @ 130.00 = 2600.00
    // Total stock = 10 + 20 = 30
    // Total valuation = 1000.00 + 2600.00 = 3600.00
    // New WAC = 3600 / 30 = 120.00
    const bill2 = await request(app)
      .post("/api/purchases/bills")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        contactId: vendorId,
        date: "2026-03-05",
        items: [{ productId, quantity: "20", unitCost: "130.00" }]
      });
    await request(app).post(`/api/purchases/bills/${bill2.body.data.id}/post`).set("Authorization", `Bearer ${token}`).set("X-Company-Id", companyId);

    const prod = await request(app)
      .get(`/api/inventory/products/${productId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(prod.body.data.costPrice).toBe("120.00");
    expect(prod.body.data.currentStock).toBe("30.000");
  });

  it("Acceptance Criterion 5: Stock ledger running balance matches current derived stock", async () => {
    // 1. Opening stock: 10 units @ 100.00
    await request(app)
      .post("/api/inventory/opening-stock")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        productId,
        warehouseId: defaultWarehouseId,
        quantity: "10",
        unitCost: "100.00",
        date: "2026-03-01"
      });

    // 2. Positive adjustment: +5 units
    await request(app)
      .post("/api/inventory/adjustment")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        productId,
        warehouseId: defaultWarehouseId,
        quantity: "5",
        reason: "Surplus stock found during audit"
      });

    // 3. Negative adjustment: -2 units
    await request(app)
      .post("/api/inventory/adjustment")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        productId,
        warehouseId: defaultWarehouseId,
        quantity: "-2",
        reason: "Damaged packaging write-off"
      });

    // Total expected stock: 10 + 5 - 2 = 13.000
    const ledgerRes = await request(app)
      .get(`/api/inventory/reports/ledger/${productId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(ledgerRes.status).toBe(200);
    expect(ledgerRes.body.data.product.currentStock).toBe("13.000");

    const entries = ledgerRes.body.data.ledger;
    expect(entries.length).toBe(3);
    expect(entries[entries.length - 1].runningQuantity).toBe("13.000");
  });

  it("Acceptance Criterion 6: Total stock valuation matches Inventory general ledger account", async () => {
    // 1. Record Opening Stock: 20 units @ 100.00 = 2000.00
    // Generates: Dr Inventory 2000.00, Cr Capital 2000.00
    await request(app)
      .post("/api/inventory/opening-stock")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        productId,
        warehouseId: defaultWarehouseId,
        quantity: "20",
        unitCost: "100.00",
        date: "2026-03-01"
      });

    // 2. Stock Adjustment: +5 units @ 100.00 = 500.00
    // Generates: Dr Inventory 500.00, Cr Stock Variance 500.00
    await request(app)
      .post("/api/inventory/adjustment")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        productId,
        warehouseId: defaultWarehouseId,
        quantity: "5",
        reason: "Cycle count surplus"
      });

    // Expected valuation: 25 units @ 100.00 = 2500.00
    const valRes = await request(app)
      .get("/api/inventory/reports/valuation")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(valRes.status).toBe(200);
    expect(valRes.body.data.valuationSummary.totalInventoryValuation).toBe("2500.00");
    expect(valRes.body.data.valuationSummary.glInventoryAccountBalance).toBe("2500.00");
    expect(valRes.body.data.valuationSummary.variance).toBe("0.00");
    expect(valRes.body.data.valuationSummary.isReconciled).toBe(true);
  });

  it("Acceptance Criterion 7: Warehouse transfers preserve total company stock quantity", async () => {
    // 1. Opening stock in default warehouse: 50 units
    await request(app)
      .post("/api/inventory/opening-stock")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        productId,
        warehouseId: defaultWarehouseId,
        quantity: "50",
        unitCost: "100.00"
      });

    // 2. Transfer 20 units from default warehouse to secondary warehouse
    const transferRes = await request(app)
      .post("/api/inventory/transfer")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        productId,
        fromWarehouseId: defaultWarehouseId,
        toWarehouseId: secondaryWarehouseId,
        quantity: "20",
        note: "Branch replenishment"
      });

    expect(transferRes.status).toBe(201);

    // Total company stock remains 50.000
    const prod = await request(app)
      .get(`/api/inventory/products/${productId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(prod.body.data.currentStock).toBe("50.000");

    // Breakdown check: Default WH = 30.000, Secondary WH = 20.000
    const defaultWhStock = prod.body.data.warehouseBreakdown.find((w: any) => w.warehouseId === defaultWarehouseId);
    const secondaryWhStock = prod.body.data.warehouseBreakdown.find((w: any) => w.warehouseId === secondaryWarehouseId);

    expect(defaultWhStock.quantity).toBe("30.000");
    expect(secondaryWhStock.quantity).toBe("20.000");
  });

  it("Acceptance Criterion 8: Stock adjustment requires mandatory reason and atomic double-entry journal", async () => {
    // Attempt stock adjustment without reason -> must fail 400 validation
    const badRes = await request(app)
      .post("/api/inventory/adjustment")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        productId,
        warehouseId: defaultWarehouseId,
        quantity: "5",
        reason: "" // Invalid
      });

    expect(badRes.status).toBe(400);

    // Valid adjustment creates balanced journal atomically
    const validRes = await request(app)
      .post("/api/inventory/adjustment")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        productId,
        warehouseId: defaultWarehouseId,
        quantity: "10",
        reason: "Valid audited adjustment"
      });

    expect(validRes.status).toBe(201);

    // Verify balanced journal created in store
    const journals = inMemory.stores.journalEntries.filter((j) => j.sourceType === "ADJUSTMENT");
    expect(journals.length).toBeGreaterThan(0);

    const latestJournal = journals[journals.length - 1];
    const lines = inMemory.stores.journalLines.filter((l) => l.entryId === latestJournal.id);

    let totalDr = new Decimal(0);
    let totalCr = new Decimal(0);
    for (const line of lines) {
      totalDr = totalDr.plus(new Decimal(line.debit.toString()));
      totalCr = totalCr.plus(new Decimal(line.credit.toString()));
    }

    expect(totalDr.equals(totalCr)).toBe(true);
    expect(totalDr.greaterThan(0)).toBe(true);
  });
});
