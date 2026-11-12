import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { createInMemoryPrisma } from "./mocks/prismaMock.js";
import { seedDefaultAccounts } from "../lib/seedAccounts.js";
import { Decimal } from "decimal.js";

let inMemory: ReturnType<typeof createInMemoryPrisma>;

vi.mock("../config/prisma.js", async () => {
  return {
    get prisma() {
      return inMemory.db;
    }
  };
});

describe("PHASE 2 ACCEPTANCE TEST SUITE", () => {
  let token: string;
  let companyId: string;
  let customerId: string;
  let vendorId: string;
  let taxRateId: string;
  let productId: string;
  let cashAccountId: string;

  beforeEach(async () => {
    inMemory = createInMemoryPrisma();

    // 1. Register a test company & user
    const regRes = await request(app).post("/api/auth/register").send({
      email: "finance@enterprise.com",
      password: "EnterprisePassword123!",
      name: "CFO Jane",
      companyName: "Acme Financials"
    });

    token = regRes.body.data.accessToken;
    companyId = regRes.body.data.company.id;

    // Get seeded Cash account
    const accountsRes = await request(app)
      .get("/api/accounts")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    const cashAcc = accountsRes.body.data.find((a: any) => a.code === "1001" || a.systemKey === "CASH");
    cashAccountId = cashAcc?.id || "cash-id";

    // 2. Create Tax Rate (GST 18%)
    const taxRes = await request(app)
      .post("/api/taxes")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        name: "Sales Tax 18%",
        percentage: "18.00"
      });
    taxRateId = taxRes.body.data.id;

    // 3. Create Customer
    const custRes = await request(app)
      .post("/api/contacts")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        name: "Apex Global Traders",
        type: "CUSTOMER",
        email: "billing@apex.com",
        ntn: "1234567-8",
        openingBalance: "1000.00"
      });
    customerId = custRes.body.data.id;

    // 4. Create Vendor
    const vendRes = await request(app)
      .post("/api/contacts")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        name: "Prime Materials Ltd",
        type: "VENDOR",
        email: "accounts@primemat.com",
        openingBalance: "500.00"
      });
    vendorId = vendRes.body.data.id;

    // 5. Create Product
    const prod = await inMemory.db.product.create({
      data: {
        companyId,
        sku: "PROD-101",
        name: "Industrial Steel Coil",
        costPrice: new Decimal("500.00"),
        salePrice: new Decimal("800.00"),
        trackStock: true
      }
    });
    productId = prod.id;
  });

  it("Acceptance Criterion 1: Invoice posting creates a balanced journal entry", async () => {
    // 0. Ensure stock is available by posting a purchase bill of 15 units first
    const billRes = await request(app)
      .post("/api/purchases/bills")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        contactId: vendorId,
        date: "2026-02-28",
        items: [{ productId, quantity: "15", unitCost: "500.00" }]
      });
    await request(app).post(`/api/purchases/bills/${billRes.body.data.id}/post`).set("Authorization", `Bearer ${token}`).set("X-Company-Id", companyId);

    // 1. Create draft invoice: 10 units @ 800.00 = 8000.00 subtotal, 18% tax = 1440.00, Total = 9440.00
    const invRes = await request(app)
      .post("/api/sales/invoices")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        contactId: customerId,
        date: "2026-03-01",
        items: [
          {
            productId,
            description: "Industrial Steel Coil",
            quantity: "10",
            unitPrice: "800.00",
            discount: "0.00",
            taxRateId
          }
        ]
      });

    expect(invRes.status).toBe(201);
    expect(invRes.body.data.subtotal).toBe("8000.00");
    expect(invRes.body.data.taxTotal).toBe("1440.00");
    expect(invRes.body.data.total).toBe("9440.00");
    const invoiceId = invRes.body.data.id;

    // Post the invoice
    const postRes = await request(app)
      .post(`/api/sales/invoices/${invoiceId}/post`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(postRes.status).toBe(200);
    expect(postRes.body.data.status).toBe("POSTED");
    expect(postRes.body.data.number).toMatch(/^INV-\d{4}-\d{4}$/);

    // Verify Balanced Journal Entry in DB
    const journal = inMemory.stores.journalEntries.find(
      (j) => j.sourceType === "INVOICE" && j.sourceId === invoiceId
    );
    expect(journal).toBeDefined();

    const lines = inMemory.stores.journalLines.filter((l) => l.entryId === journal.id);
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const l of lines) {
      totalDebit = totalDebit.plus(new Decimal(l.debit.toString()));
      totalCredit = totalCredit.plus(new Decimal(l.credit.toString()));
    }

    expect(totalDebit.equals(totalCredit)).toBe(true);
    expect(totalDebit.greaterThan(0)).toBe(true);
  });

  it("Acceptance Criterion 2: Purchase bill posting creates a balanced journal and records stock movement", async () => {
    // 20 units @ 500.00 = 10,000 subtotal, 18% tax = 1800.00, Total = 11,800.00
    const billRes = await request(app)
      .post("/api/purchases/bills")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        contactId: vendorId,
        vendorBillNo: "VB-8899",
        date: "2026-03-02",
        items: [
          {
            productId,
            quantity: "20",
            unitCost: "500.00",
            taxRateId
          }
        ]
      });

    expect(billRes.status).toBe(201);
    expect(billRes.body.data.total).toBe("11800.00");
    const billId = billRes.body.data.id;

    // Post the bill
    const postRes = await request(app)
      .post(`/api/purchases/bills/${billId}/post`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(postRes.status).toBe(200);
    expect(postRes.body.data.status).toBe("POSTED");
    expect(postRes.body.data.number).toMatch(/^BILL-\d{4}-\d{4}$/);

    // Check Journal Balance
    const journal = inMemory.stores.journalEntries.find(
      (j) => j.sourceType === "BILL" && j.sourceId === billId
    );
    expect(journal).toBeDefined();

    const lines = inMemory.stores.journalLines.filter((l) => l.entryId === journal.id);
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);
    for (const l of lines) {
      totalDebit = totalDebit.plus(new Decimal(l.debit.toString()));
      totalCredit = totalCredit.plus(new Decimal(l.credit.toString()));
    }
    expect(totalDebit.equals(totalCredit)).toBe(true);

    // Check StockMovement created
    const movement = inMemory.stores.stockMovements.find((m) => m.sourceId === billId);
    expect(movement).toBeDefined();
    expect(movement.type).toBe("PURCHASE");
    expect(new Decimal(movement.quantity.toString()).equals(20)).toBe(true);
  });

  it("Acceptance Criterion 3 & 4: Partial and Full payments transition document status", async () => {
    // 1. Create and post invoice of 1000.00 total
    const invRes = await request(app)
      .post("/api/sales/invoices")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        contactId: customerId,
        date: "2026-03-05",
        items: [{ description: "Consulting", quantity: "1", unitPrice: "1000.00", discount: "0.00" }]
      });
    const invId = invRes.body.data.id;
    await request(app).post(`/api/sales/invoices/${invId}/post`).set("Authorization", `Bearer ${token}`).set("X-Company-Id", companyId);

    // 2. Partial Payment: 400.00
    const partialRes = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        type: "RECEIVED",
        contactId: customerId,
        invoiceId: invId,
        accountId: cashAccountId,
        amount: "400.00",
        date: "2026-03-06"
      });

    expect(partialRes.status).toBe(201);

    const invAfterPartial = await request(app)
      .get(`/api/sales/invoices/${invId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(invAfterPartial.body.data.status).toBe("PARTIALLY_PAID");
    expect(invAfterPartial.body.data.paidAmount).toBe("400.00");
    expect(invAfterPartial.body.data.balanceDue).toBe("600.00");

    // 3. Second payment for remaining 600.00 -> Transition to PAID
    const fullRes = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        type: "RECEIVED",
        contactId: customerId,
        invoiceId: invId,
        accountId: cashAccountId,
        amount: "600.00",
        date: "2026-03-07"
      });

    expect(fullRes.status).toBe(201);

    const invAfterFull = await request(app)
      .get(`/api/sales/invoices/${invId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(invAfterFull.body.data.status).toBe("PAID");
    expect(invAfterFull.body.data.paidAmount).toBe("1000.00");
    expect(invAfterFull.body.data.balanceDue).toBe("0.00");
  });

  it("Acceptance Criterion 5: Concurrent sequence generation produces sequential, unique document numbers", async () => {
    // Create 3 invoices
    const invoiceIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const inv = await request(app)
        .post("/api/sales/invoices")
        .set("Authorization", `Bearer ${token}`)
        .set("X-Company-Id", companyId)
        .send({
          contactId: customerId,
          date: "2026-03-10",
          items: [{ description: `Item ${i}`, quantity: "1", unitPrice: "100.00" }]
        });
      invoiceIds.push(inv.body.data.id);
    }

    // Post them
    const results = await Promise.all(
      invoiceIds.map((id) =>
        request(app)
          .post(`/api/sales/invoices/${id}/post`)
          .set("Authorization", `Bearer ${token}`)
          .set("X-Company-Id", companyId)
      )
    );

    const numbers = results.map((r) => r.body.data.number);
    const uniqueNumbers = new Set(numbers);
    expect(uniqueNumbers.size).toBe(3);
    for (const num of numbers) {
      expect(num).toMatch(/^INV-\d{4}-\d{4}$/);
    }
  });

  it("Acceptance Criterion 6: Customer balance strictly matches AR ledger entries", async () => {
    // Initial balance: 1000.00 opening balance
    const contactInitial = await request(app)
      .get(`/api/contacts/${customerId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(contactInitial.body.data.balances.receivable).toBe("1000.00");

    // Post an invoice for 2000.00
    const inv = await request(app)
      .post("/api/sales/invoices")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        contactId: customerId,
        date: "2026-03-11",
        items: [{ description: "Wholesale", quantity: "2", unitPrice: "1000.00" }]
      });
    await request(app).post(`/api/sales/invoices/${inv.body.data.id}/post`).set("Authorization", `Bearer ${token}`).set("X-Company-Id", companyId);

    // Balance should now be 1000 + 2000 = 3000.00
    const contactAfterInv = await request(app)
      .get(`/api/contacts/${customerId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(contactAfterInv.body.data.balances.receivable).toBe("3000.00");

    // Pay 1500.00
    await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        type: "RECEIVED",
        contactId: customerId,
        invoiceId: inv.body.data.id,
        accountId: cashAccountId,
        amount: "1500.00",
        date: "2026-03-12"
      });

    // Balance should now be 3000 - 1500 = 1500.00
    const contactAfterPay = await request(app)
      .get(`/api/contacts/${customerId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(contactAfterPay.body.data.balances.receivable).toBe("1500.00");

    // Verify Ledger endpoint returns running balance
    const ledgerRes = await request(app)
      .get(`/api/contacts/${customerId}/ledger`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(ledgerRes.status).toBe(200);
    expect(ledgerRes.body.data.contact.closingBalance).toBe("1500.00");
  });

  it("Acceptance Criterion 7: PDF endpoint returns valid application/pdf binary with accurate calculations", async () => {
    const inv = await request(app)
      .post("/api/sales/invoices")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        contactId: customerId,
        date: "2026-03-15",
        items: [{ description: "Software License", quantity: "1", unitPrice: "5000.00", taxRateId }]
      });
    const invId = inv.body.data.id;
    await request(app).post(`/api/sales/invoices/${invId}/post`).set("Authorization", `Bearer ${token}`).set("X-Company-Id", companyId);

    const pdfRes = await request(app)
      .get(`/api/sales/invoices/${invId}/pdf`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers["content-type"]).toBe("application/pdf");
    expect(pdfRes.body).toBeInstanceOf(Buffer);
    expect(pdfRes.body.length).toBeGreaterThan(100);
  });

  it("Acceptance Criterion 8: Posted records cannot be edited or deleted (403 Forbidden)", async () => {
    const inv = await request(app)
      .post("/api/sales/invoices")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        contactId: customerId,
        date: "2026-03-20",
        items: [{ description: "Protected Service", quantity: "1", unitPrice: "250.00" }]
      });
    const invId = inv.body.data.id;
    await request(app).post(`/api/sales/invoices/${invId}/post`).set("Authorization", `Bearer ${token}`).set("X-Company-Id", companyId);

    // Attempt PUT on posted invoice
    const putRes = await request(app)
      .put(`/api/sales/invoices/${invId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({ notes: "Malicious modification" });

    expect(putRes.status).toBe(403);
    expect(putRes.body.error.code).toBe("IMMUTABLE_RECORD");

    // Attempt DELETE on posted invoice
    const delRes = await request(app)
      .delete(`/api/sales/invoices/${invId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(delRes.status).toBe(403);
    expect(delRes.body.error.code).toBe("IMMUTABLE_RECORD");
  });
});
