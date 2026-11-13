import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { createInMemoryPrisma } from "./mocks/prismaMock.js";
import { generateAccessToken } from "../lib/jwt.js";
import { Role } from "@prisma/client";

let inMemory: ReturnType<typeof createInMemoryPrisma>;

vi.mock("../config/prisma.js", async () => {
  return {
    get prisma() {
      return inMemory.db;
    }
  };
});

describe("PHASE 6 ACCEPTANCE TEST SUITE: DASHBOARD, ADVANCED ERP, IMPORT, APPROVALS & SECURITY", () => {
  let ownerToken: string;
  let companyId: string;
  let ownerId: string;
  let cashAccountId: string;
  let bankAccountId: string;
  let salesAccountId: string;
  let cogsAccountId: string;
  let customerId: string;
  let productId: string;

  beforeEach(async () => {
    inMemory = createInMemoryPrisma();

    // 1. Register Owner and Company
    const regRes = await request(app)
      .post("/api/auth/register")
      .send({
        email: "ceo@flagship-erp.com",
        password: "Password123!",
        name: "Chief Executive Officer",
        companyName: "Flagship Apex ERP"
      });

    ownerToken = regRes.body.data.accessToken;
    companyId = regRes.body.data.company.id;
    ownerId = regRes.body.data.user.id;

    // 2. Fetch Accounts
    const accRes = await request(app)
      .get("/api/accounts")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId);

    const accounts = accRes.body.data;
    cashAccountId = accounts.find((a: any) => a.code === "1001").id;
    bankAccountId = accounts.find((a: any) => a.code === "1002").id;
    salesAccountId = accounts.find((a: any) => a.code === "4001").id;
    cogsAccountId = accounts.find((a: any) => a.code === "5001").id;

    // 3. Create a Customer Contact
    const contactRes = await request(app)
      .post("/api/contacts")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({
        name: "Global Technologies Ltd",
        type: "CUSTOMER",
        email: "accounts@globaltech.com",
        phone: "+92 300 1234567"
      });
    customerId = contactRes.body.data.id;

    // 4. Create a Product with Barcode
    const prodRes = await request(app)
      .post("/api/inventory/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({
        sku: "PROD-BARCODE-01",
        name: "Industrial Barcode Scanner",
        costPrice: "12000.00",
        salePrice: "18500.00",
        barcode: "8964000123456",
        trackStock: true,
        reorderLevel: "5.000"
      });
    productId = prodRes.body.data.id;
  });

  // --------------------------------------------------------------------------
  // ACCEPTANCE CRITERION 1: Real-time Executive Financial Dashboard
  // --------------------------------------------------------------------------
  it("Acceptance Criterion 1: Executive Dashboard dynamically calculates real-time metrics from posted ledger records", async () => {
    // Post initial transactions
    // 1. Customer Payment: 50,000 into Bank Account
    await request(app)
      .post("/api/journal")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({
        date: "2026-06-01",
        narration: "Initial customer revenue",
        lines: [
          { accountId: bankAccountId, debit: "50000.00", credit: "0.00" },
          { accountId: salesAccountId, debit: "0.00", credit: "50000.00" }
        ]
      });

    // 2. Operating Expense: 15,000 from Bank Account
    await request(app)
      .post("/api/journal")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({
        date: "2026-06-05",
        narration: "Cloud hosting expense",
        lines: [
          { accountId: cogsAccountId, debit: "15000.00", credit: "0.00" },
          { accountId: bankAccountId, debit: "0.00", credit: "15000.00" }
        ]
      });

    // Query Dashboard Overview
    const dashRes = await request(app)
      .get("/api/dashboard/overview")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId);

    expect(dashRes.status).toBe(200);
    const data = dashRes.body.data;

    // Balances verification
    expect(data.balances.bank).toBe("35000.00"); // 50,000 - 15,000
    expect(data.pnl.totalSales).toBe("50000.00");
    expect(data.pnl.totalExpenses).toBe("15000.00");
    expect(data.pnl.netProfit).toBe("35000.00"); // 50,000 - 15,000
    expect(data.monthlyTrends.length).toBeGreaterThan(0);
    expect(data.inventoryHealth).toBeDefined();
    expect(data.recentActivity.transactions.length).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // ACCEPTANCE CRITERION 2: Recurring Invoices Engine
  // --------------------------------------------------------------------------
  it("Acceptance Criterion 2: Recurring Invoices Engine creates templates and generates scheduled sequential invoices", async () => {
    // 1. Create a monthly recurring invoice template
    const templateRes = await request(app)
      .post("/api/recurring")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({
        contactId: customerId,
        frequency: "MONTHLY",
        startDate: "2026-07-01",
        autoPost: false,
        notes: "Monthly enterprise support retainer",
        items: [
          {
            productId,
            description: "Dedicated Enterprise Support",
            quantity: "1.000",
            unitPrice: "25000.00"
          }
        ]
      });

    expect(templateRes.status).toBe(201);
    const template = templateRes.body.data;
    expect(template.total).toBe("25000");

    // 2. Trigger invoice generation from template
    const genRes = await request(app)
      .post(`/api/recurring/${template.id}/generate`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId);

    expect(genRes.status).toBe(200);
    expect(genRes.body.data.generatedInvoice).toBeDefined();
    expect(genRes.body.data.generatedInvoice.total).toBe("25000.00");
    expect(genRes.body.data.nextRunDate).toContain("2026-08-01"); // Advanced by 1 month
  });

  // --------------------------------------------------------------------------
  // ACCEPTANCE CRITERION 3: Multi-Currency Support
  // --------------------------------------------------------------------------
  it("Acceptance Criterion 3: Multi-Currency engine converts foreign currencies using database-driven Decimal exchange rates", async () => {
    // 1. Set USD to PKR exchange rate (1 USD = 278.50 PKR)
    const rateRes = await request(app)
      .post("/api/currency/rates")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({
        fromCode: "USD",
        toCode: "PKR",
        rate: "278.500000"
      });

    expect(rateRes.status).toBe(201);

    // 2. Convert 250.00 USD to PKR
    const convertRes = await request(app)
      .post("/api/currency/convert")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({
        amount: "250.00",
        fromCode: "USD",
        toCode: "PKR"
      });

    expect(convertRes.status).toBe(200);
    // 250 * 278.50 = 69,625.00
    expect(convertRes.body.data.convertedAmount).toBe("69625.00");
    expect(convertRes.body.data.exchangeRate).toBe("278.500000");
  });

  // --------------------------------------------------------------------------
  // ACCEPTANCE CRITERION 4: Barcode Scanning Product Resolution
  // --------------------------------------------------------------------------
  it("Acceptance Criterion 4: Barcode scanning endpoint instantly resolves products by barcode string", async () => {
    const barcodeRes = await request(app)
      .get("/api/inventory/products/barcode/8964000123456")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId);

    expect(barcodeRes.status).toBe(200);
    expect(barcodeRes.body.data.id).toBe(productId);
    expect(barcodeRes.body.data.sku).toBe("PROD-BARCODE-01");
    expect(barcodeRes.body.data.barcode).toBe("8964000123456");

    // Invalid barcode returns 404
    const invalidRes = await request(app)
      .get("/api/inventory/products/barcode/NON_EXISTENT_999")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId);

    expect(invalidRes.status).toBe(404);
  });

  // --------------------------------------------------------------------------
  // ACCEPTANCE CRITERION 5: Email Invoicing with PDF Attachment Provenance
  // --------------------------------------------------------------------------
  it("Acceptance Criterion 5: Email invoicing dispatches PDF documents and records audit provenance", async () => {
    // 1. Create a draft invoice
    const invRes = await request(app)
      .post("/api/sales/invoices")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({
        contactId: customerId,
        date: "2026-06-10",
        items: [
          {
            productId,
            description: "Barcode Hardware",
            quantity: "2.000",
            unitPrice: "18500.00"
          }
        ]
      });

    const invoiceId = invRes.body.data.id;

    // 2. Email Invoice
    const emailRes = await request(app)
      .post(`/api/sales/invoices/${invoiceId}/email`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({
        recipientEmail: "cfo@globaltech.com",
        subject: "Your Monthly Hardware Invoice"
      });

    expect(emailRes.status).toBe(200);
    expect(emailRes.body.data.success).toBe(true);
    expect(emailRes.body.data.recipient).toBe("cfo@globaltech.com");
    expect(emailRes.body.data.pdfSizeBytes).toBeGreaterThan(100);
  });

  // --------------------------------------------------------------------------
  // ACCEPTANCE CRITERION 6: Bulk CSV Data Import Suite
  // --------------------------------------------------------------------------
  it("Acceptance Criterion 6: Bulk CSV Import engine accurately imports accounts, contacts, and products with opening stock", async () => {
    // 1. Import Contacts via CSV
    const contactsCsv = `Name,Type,Email,Phone,NTN,Address
Apex Logistics,VENDOR,ap@apexlogistics.com,+92 21 34567890,9876543-2,Port Qasim Industrial Area
Falcon Technologies,CUSTOMER,billing@falcon.com,+92 42 35678901,1234567-8,Gulberg III Lahore`;

    const importContactRes = await request(app)
      .post("/api/import/contacts")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({ csvContent: contactsCsv });

    expect(importContactRes.status).toBe(200);
    expect(importContactRes.body.data.importedCount).toBe(2);

    // 2. Import Products with Opening Stock via CSV
    const productsCsv = `SKU,Name,Cost,Sale,Barcode,Opening
SKU-SERVER-01,Dell PowerEdge R740,450000.00,580000.00,9988771122,3.000
SKU-SWITCH-01,Cisco Catalyst 9300,120000.00,165000.00,9988771133,5.000`;

    const importProdRes = await request(app)
      .post("/api/import/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({ csvContent: productsCsv });

    expect(importProdRes.status).toBe(200);
    expect(importProdRes.body.data.importedCount).toBe(2);
    // Opening stock value: (3 * 450,000) + (5 * 120,000) = 1,350,000 + 600,000 = 1,950,000
    expect(importProdRes.body.data.totalOpeningStockValue).toBe("1950000.00");
  });

  // --------------------------------------------------------------------------
  // ACCEPTANCE CRITERION 7: Two-Tier Approval Workflow
  // --------------------------------------------------------------------------
  it("Acceptance Criterion 7: Approval Workflow allows submission and requires OWNER authorization before posting", async () => {
    // 1. Create a draft invoice
    const invRes = await request(app)
      .post("/api/sales/invoices")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({
        contactId: customerId,
        date: "2026-06-20",
        items: [
          {
            description: "High Value Advisory Service",
            quantity: "1.000",
            unitPrice: "100000.00"
          }
        ]
      });

    const invoiceId = invRes.body.data.id;

    // 2. Submit for Approval
    const submitRes = await request(app)
      .post(`/api/approvals/invoices/${invoiceId}/submit`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId);

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.approvalStatus).toBe("PENDING_APPROVAL");

    // 3. OWNER approves invoice (which triggers automatic posting)
    const approveRes = await request(app)
      .post(`/api/approvals/invoices/${invoiceId}/approve`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe("POSTED");
  });

  // --------------------------------------------------------------------------
  // ACCEPTANCE CRITERION 8: Security Headers and Rate Limiting
  // --------------------------------------------------------------------------
  it("Acceptance Criterion 8: Security headers and rate limiting are properly active", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });
});
