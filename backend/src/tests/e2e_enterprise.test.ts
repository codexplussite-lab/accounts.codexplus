import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { Decimal } from "decimal.js";
import { app } from "../app.js";
import { createInMemoryPrisma } from "./mocks/prismaMock.js";

const inMemory = createInMemoryPrisma();

vi.mock("../config/prisma.js", async () => {
  return {
    get prisma() {
      return inMemory.db;
    }
  };
});

describe("ENTERPRISE ERP END-TO-END AUDIT SUITE: 20 BUSINESS WORKFLOWS & INVARIANTS", () => {
  let ownerTokenA: string;
  let ownerTokenB: string;
  let accountantTokenA: string;
  let cashierTokenA: string;
  let auditorTokenA: string;

  let companyAId: string;
  let companyBId: string;

  let customerId: string;
  let vendorId: string;

  let productId: string;
  let warehouse1Id: string;
  let warehouse2Id: string;

  let purchaseBillId: string;
  let salesInvoiceId: string;

  let glBankAccountId: string;
  let bankAccountId: string;
  let inventoryAccountId: string;
  let salesAccountId: string;
  let cogsAccountId: string;
  let arAccountId: string;
  let apAccountId: string;

  // --------------------------------------------------------------------------
  // WORKFLOW 1 & 2: Register Company, Login, Logout & Token Security
  // --------------------------------------------------------------------------
  it("Workflow 1 & 2: User registration provisions Company, OWNER, default accounts, warehouse & handles auth tokens", async () => {
    // 1. Register Company A (Acme Corp)
    const regResA = await request(app).post("/api/auth/register").send({
      name: "Syed Moosa",
      email: "syed@acme-enterprise.com",
      password: "EnterprisePassword123!",
      companyName: "Acme Enterprise Corp",
      currency: "PKR"
    });

    expect(regResA.status).toBe(201);
    expect(regResA.body.data.accessToken).toBeDefined();
    ownerTokenA = regResA.body.data.accessToken;
    companyAId = regResA.body.data.company.id;

    // 2. Register Company B (Beta Logistics) for multi-tenant isolation testing
    const regResB = await request(app).post("/api/auth/register").send({
      name: "Zayn Malik",
      email: "zayn@beta-logistics.com",
      password: "BetaPassword123!",
      companyName: "Beta Logistics Ltd",
      currency: "PKR"
    });

    expect(regResB.status).toBe(201);
    ownerTokenB = regResB.body.data.accessToken;
    companyBId = regResB.body.data.company.id;

    // 3. User Login
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "syed@acme-enterprise.com",
      password: "EnterprisePassword123!"
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.accessToken).toBeDefined();

    // 4. GET /api/auth/me
    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.email).toBe("syed@acme-enterprise.com");

    // 5. User Logout
    const logoutRes = await request(app).post("/api/auth/logout");
    expect(logoutRes.status).toBe(200);
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 3: Multi-Company Data Isolation & Switching
  // --------------------------------------------------------------------------
  it("Workflow 3: Multi-Company Data Isolation strictly blocks cross-tenant access", async () => {
    // Company A user attempts to query Company B data
    const unauthorizedRes = await request(app)
      .get("/api/accounts")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyBId);

    // companyScope must reject with 403 Forbidden because User A is NOT a member of Company B
    expect(unauthorizedRes.status).toBe(403);
    expect(unauthorizedRes.body.error.code).toBe("FORBIDDEN_COMPANY_ACCESS");
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 4: Create Customers & Vendors
  // --------------------------------------------------------------------------
  it("Workflow 4: Create Customers and Vendors with FBR NTN and initial records", async () => {
    // 1. Create Customer
    const custRes = await request(app)
      .post("/api/contacts")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({
        name: "Metro Retail Distribution Ltd",
        type: "CUSTOMER",
        email: "billing@metroretail.pk",
        phone: "+923001112233",
        ntn: "1234567-8",
        address: "Industrial Area, Karachi",
        creditLimit: "500000.00"
      });

    expect(custRes.status).toBe(201);
    customerId = custRes.body.data.id;
    expect(custRes.body.data.name).toBe("Metro Retail Distribution Ltd");

    // 2. Create Vendor
    const vendRes = await request(app)
      .post("/api/contacts")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({
        name: "Apex Raw Materials Hub",
        type: "VENDOR",
        email: "sales@apexraw.com",
        phone: "+924235558888",
        ntn: "7654321-9",
        address: "Multan Road, Lahore"
      });

    expect(vendRes.status).toBe(201);
    vendorId = vendRes.body.data.id;
    expect(vendRes.body.data.name).toBe("Apex Raw Materials Hub");
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 5: Create Products & Multi-Warehouses
  // --------------------------------------------------------------------------
  it("Workflow 5: Create Products and Multiple Warehouses", async () => {
    // Retrieve default warehouse created on registration
    const whRes = await request(app)
      .get("/api/inventory/warehouses")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId);
    expect(whRes.status).toBe(200);
    warehouse1Id = whRes.body.data[0].id;

    // Create Second Warehouse
    const wh2Res = await request(app)
      .post("/api/inventory/warehouses")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({
        name: "Lahore Depot",
        location: "Quaid-e-Azam Industrial Estate"
      });
    expect(wh2Res.status).toBe(201);
    warehouse2Id = wh2Res.body.data.id;

    // Create Stock-Tracked Product
    const prodRes = await request(app)
      .post("/api/inventory/products")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({
        name: "Heavy Duty Turbine Filter 200X",
        sku: "TRB-FLT-200X",
        costPrice: "1500.00",
        salePrice: "2500.00",
        barcode: "8964000777112",
        trackStock: true,
        reorderLevel: "10.000"
      });

    expect(prodRes.status).toBe(201);
    productId = prodRes.body.data.id;

    // Resolve COA accounts for accounting invariants
    const accountsRes = await request(app)
      .get("/api/accounts")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId);
    expect(accountsRes.status).toBe(200);
    const accList = accountsRes.body.data;
    inventoryAccountId = accList.find((a: any) => a.code === "1200").id;
    salesAccountId = accList.find((a: any) => a.code === "4001").id;
    cogsAccountId = accList.find((a: any) => a.code === "5001").id;
    arAccountId = accList.find((a: any) => a.code === "1100").id;
    apAccountId = accList.find((a: any) => a.code === "2001").id;
    glBankAccountId = accList.find((a: any) => a.code === "1002").id;

    // Create BankAccount record linked to GL 1002
    const bAccRes = await request(app)
      .post("/api/banking/accounts")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({
        name: "Meezan Corporate Current",
        accountId: glBankAccountId,
        accountNo: "0101-123456789"
      });
    expect(bAccRes.status).toBe(201);
    bankAccountId = bAccRes.body.data.id;
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 6 & 7: Purchase Bills & Stock Increase Verification
  // --------------------------------------------------------------------------
  it("Workflow 6 & 7: Post Purchase Bill, increase stock, and generate balanced AP/Inventory journal", async () => {
    // 1. Create Purchase Bill for 100 units @ 1,500 = 150,000 PKR
    const billRes = await request(app)
      .post("/api/purchases/bills")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({
        contactId: vendorId,
        date: "2026-06-01",
        items: [
          {
            productId,
            description: "Turbine Filter Inflow",
            quantity: "100.000",
            unitCost: "1500.00"
          }
        ]
      });

    expect(billRes.status).toBe(201);
    purchaseBillId = billRes.body.data.id;
    expect(billRes.body.data.total).toBe("150000.00");

    // 2. Post Purchase Bill
    const postBillRes = await request(app)
      .post(`/api/purchases/bills/${purchaseBillId}/post`)
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId);

    expect(postBillRes.status).toBe(200);
    expect(postBillRes.body.data.status).toBe("POSTED");

    // 3. Verify Stock Increased to 100.000 units
    const prodStockRes = await request(app)
      .get(`/api/inventory/products/${productId}`)
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId);

    expect(prodStockRes.status).toBe(200);
    expect(prodStockRes.body.data.currentStock).toBe("100.000");

    // 4. Verify Vendor AP balance increased to 150,000 PKR
    const vendorBalRes = await request(app)
      .get(`/api/contacts/${vendorId}`)
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId);
    expect(vendorBalRes.status).toBe(200);
    expect(vendorBalRes.body.data.balances.payable).toBe("150000.00");
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 8 & 9: Sales Invoices & Stock Decrease Verification
  // --------------------------------------------------------------------------
  it("Workflow 8 & 9: Post Sales Invoice, decrease stock, and generate balanced AR/Sales/COGS journal", async () => {
    // 1. Create Sales Invoice for 40 units @ 2,500 = 100,000 PKR
    const invRes = await request(app)
      .post("/api/sales/invoices")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({
        contactId: customerId,
        date: "2026-06-05",
        items: [
          {
            productId,
            description: "Turbine Filter Sale",
            quantity: "40.000",
            unitPrice: "2500.00"
          }
        ]
      });

    expect(invRes.status).toBe(201);
    salesInvoiceId = invRes.body.data.id;
    expect(invRes.body.data.total).toBe("100000.00");

    // 2. Post Sales Invoice
    const postInvRes = await request(app)
      .post(`/api/sales/invoices/${salesInvoiceId}/post`)
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId);

    expect(postInvRes.status).toBe(200);
    expect(postInvRes.body.data.status).toBe("POSTED");

    // 3. Verify Stock Decreased from 100 to 60 units (100 - 40 = 60)
    const prodStockRes = await request(app)
      .get(`/api/inventory/products/${productId}`)
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId);

    expect(prodStockRes.status).toBe(200);
    expect(prodStockRes.body.data.currentStock).toBe("60.000");

    // 4. Verify Customer AR balance increased to 100,000 PKR
    const custBalRes = await request(app)
      .get(`/api/contacts/${customerId}`)
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId);
    expect(custBalRes.status).toBe(200);
    expect(custBalRes.body.data.balances.receivable).toBe("100000.00");
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 10 & 11: Receive Partial & Full Payments
  // --------------------------------------------------------------------------
  it("Workflow 10 & 11: Receive partial and full payments, transitioning document status", async () => {
    // 1. Receive Partial Payment of 40,000 PKR
    const partPayRes = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({
        contactId: customerId,
        invoiceId: salesInvoiceId,
        accountId: glBankAccountId,
        amount: "40000.00",
        date: "2026-06-10",
        type: "RECEIVED"
      });

    expect(partPayRes.status).toBe(201);

    // Verify invoice transitioned to PARTIALLY_PAID
    const invCheck1 = await request(app)
      .get(`/api/sales/invoices/${salesInvoiceId}`)
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId);
    expect(invCheck1.body.data.status).toBe("PARTIALLY_PAID");
    expect(invCheck1.body.data.paidAmount).toBe("40000.00");

    // 2. Receive Remaining Balance of 60,000 PKR
    const fullPayRes = await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({
        contactId: customerId,
        invoiceId: salesInvoiceId,
        accountId: glBankAccountId,
        amount: "60000.00",
        date: "2026-06-15",
        type: "RECEIVED"
      });

    expect(fullPayRes.status).toBe(201);

    // Verify invoice transitioned to PAID
    const invCheck2 = await request(app)
      .get(`/api/sales/invoices/${salesInvoiceId}`)
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId);
    expect(invCheck2.body.data.status).toBe("PAID");
    expect(invCheck2.body.data.paidAmount).toBe("100000.00");
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 12: Verify Customer and Vendor Balances
  // --------------------------------------------------------------------------
  it("Workflow 12: Customer balance settles to 0.00 while vendor balance reflects unpaid liability", async () => {
    // Customer fully paid 100,000 on 100,000 invoice -> receivable = 0.00
    const custRes = await request(app)
      .get(`/api/contacts/${customerId}`)
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId);
    expect(custRes.status).toBe(200);
    expect(custRes.body.data.balances.receivable).toBe("0.00");

    // Vendor purchase bill remains unpaid -> payable = 150,000.00
    const vendRes = await request(app)
      .get(`/api/contacts/${vendorId}`)
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId);
    expect(vendRes.status).toBe(200);
    expect(vendRes.body.data.balances.payable).toBe("150000.00");
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 13 & 14: Manual Journal Entries & Double-Entry Equality
  // --------------------------------------------------------------------------
  it("Workflow 13 & 14: Balanced manual journal succeeds; unbalanced journal is rejected (422)", async () => {
    // 1. Unbalanced Journal Entry -> Must be rejected with 422
    const unbalRes = await request(app)
      .post("/api/journal")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({
        date: "2026-06-16",
        narration: "Unbalanced fraudulent attempt",
        lines: [
          { accountId: cogsAccountId, debit: "5000.00", credit: "0.00" },
          { accountId: glBankAccountId, debit: "0.00", credit: "4000.00" } // 1,000 variance
        ]
      });

    expect(unbalRes.status).toBe(422);
    expect(unbalRes.body.error.code).toBe("UNBALANCED_ENTRY");

    // 2. Balanced Journal Entry -> Must succeed and post
    const balRes = await request(app)
      .post("/api/journal")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({
        date: "2026-06-16",
        narration: "Warehouse facility rental fee",
        lines: [
          { accountId: cogsAccountId, debit: "12000.00", credit: "0.00" },
          { accountId: glBankAccountId, debit: "0.00", credit: "12000.00" }
        ]
      });

    expect(balRes.status).toBe(201);
    expect(balRes.body.data.status).toBe("POSTED");
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 15: Financial Reports & Mathematical Invariants
  // --------------------------------------------------------------------------
  it("Workflow 15: Financial Reports uphold accounting invariants (Debit = Credit, Assets = Liabilities + Equity)", async () => {
    // 1. Trial Balance: Total Debit MUST equal Total Credit
    const tbRes = await request(app)
      .get("/api/reports/trial-balance")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId);

    expect(tbRes.status).toBe(200);
    const tb = tbRes.body.data;
    expect(tb.totalDebit).toBe(tb.totalCredit);
    expect(tb.isBalanced).toBe(true);

    // 2. Balance Sheet: Assets MUST equal Liabilities + Equity
    const bsRes = await request(app)
      .get("/api/reports/balance-sheet")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId);

    expect(bsRes.status).toBe(200);
    const bs = bsRes.body.data;
    expect(bs.isBalanced).toBe(true);
    expect(bs.assets.total).toBe(bs.totalLiabilitiesAndEquity);

    // 3. Profit & Loss: Revenue - COGS - Expenses = Net Profit
    const pnlRes = await request(app)
      .get("/api/reports/profit-and-loss")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId);

    expect(pnlRes.status).toBe(200);
    const pnl = pnlRes.body.data;
    const calcNetProfit = new Decimal(pnl.netProfit);
    const expectedYield = new Decimal(pnl.grossProfit).minus(new Decimal(pnl.operatingExpenses.total));
    expect(calcNetProfit.equals(expectedYield)).toBe(true);

    // 4. Accounts Payable Ageing: Sum matches AP outstanding balance (150,000)
    const apAgeingRes = await request(app)
      .get("/api/reports/ap-ageing")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId);

    expect(apAgeingRes.status).toBe(200);
    expect(apAgeingRes.body.data.totals.totalOutstanding).toBe("150000.00");
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 16: Export PDF and Excel Documents
  // --------------------------------------------------------------------------
  it("Workflow 16: Binary PDF and Excel report exports return valid headers", async () => {
    // 1. PDF Export
    const pdfRes = await request(app)
      .get("/api/reports/export")
      .query({ reportType: "trial-balance", format: "pdf" })
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId);

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers["content-type"]).toContain("application/pdf");
    expect(pdfRes.headers["content-disposition"]).toContain(".pdf");

    // 2. Excel Export
    const excelRes = await request(app)
      .get("/api/reports/export")
      .query({ reportType: "trial-balance", format: "excel" })
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId);

    expect(excelRes.status).toBe(200);
    expect(excelRes.headers["content-type"]).toContain("spreadsheetml");
    expect(excelRes.headers["content-disposition"]).toContain(".xlsx");
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 17: Period Locking Protection
  // --------------------------------------------------------------------------
  it("Workflow 17: Period locking blocks mutations dated on or before lock date", async () => {
    // Lock period until 2026-06-30
    const lockRes = await request(app)
      .put("/api/fiscal/period-lock")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({ lockedUntil: "2026-06-30" });

    expect(lockRes.status).toBe(200);

    // Attempt to post transaction dated inside locked period (2026-06-15)
    const blockedRes = await request(app)
      .post("/api/journal")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({
        date: "2026-06-15",
        narration: "Retroactive modification attempt",
        lines: [
          { accountId: cogsAccountId, debit: "100.00", credit: "0.00" },
          { accountId: glBankAccountId, debit: "0.00", credit: "100.00" }
        ]
      });

    expect(blockedRes.status).toBe(422);
    expect(blockedRes.body.error.code).toBe("PERIOD_LOCKED");
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 18: Immutable Audit Trail & Tampering Rejection
  // --------------------------------------------------------------------------
  it("Workflow 18: Audit trail records every action and strictly rejects mutation (403)", async () => {
    // 1. Query audit log
    const auditRes = await request(app)
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId);

    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.length).toBeGreaterThan(0);
    const firstLogId = auditRes.body.data[0].id;

    // 2. Attempt to update audit log record -> Must reject with 403 Forbidden
    const updateRes = await request(app)
      .put(`/api/audit-logs/${firstLogId}`)
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({ action: "FORGED_ACTION" });

    expect(updateRes.status).toBe(403);
    expect(updateRes.body.error.code).toBe("AUDIT_LOG_IMMUTABLE");

    // 3. Attempt to delete audit log record -> Must reject with 403 Forbidden
    const deleteRes = await request(app)
      .delete(`/api/audit-logs/${firstLogId}`)
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId);

    expect(deleteRes.status).toBe(403);
    expect(deleteRes.body.error.code).toBe("AUDIT_LOG_IMMUTABLE");
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 19: Bank Reconciliation Non-Duplication
  // --------------------------------------------------------------------------
  it("Workflow 19: Bank reconciliation imports CSV statement without generating duplicate GL entries", async () => {
    // Count GL bank lines before statement import
    const glBefore = await request(app)
      .get(`/api/banking/reconciliation/${bankAccountId}`)
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId);
    expect(glBefore.status).toBe(200);

    // Import external bank statement CSV
    const csvContent = [
      "Date,Description,Reference,Withdrawal,Deposit",
      "2026-06-10,Customer Online Payment,FT-991,,40000.00",
      "2026-06-15,Customer Settlement,FT-992,,60000.00"
    ].join("\n");

    const importRes = await request(app)
      .post("/api/banking/statements/import")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({
        bankAccountId,
        fileName: "meezan_bank_june2026.csv",
        csvContent
      });

    expect(importRes.status).toBe(201);
    expect(importRes.body.data.lines.length).toBe(2);
  });

  // --------------------------------------------------------------------------
  // WORKFLOW 20: Role-Based Access Control (RBAC) Boundaries
  // --------------------------------------------------------------------------
  it("Workflow 20: RBAC Matrix strictly bounds OWNER, ACCOUNTANT, CASHIER, and AUDITOR", async () => {
    // 1. Create team members with distinct roles
    const accUser = await request(app)
      .post("/api/users/invite")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({ name: "Accountant Bilal", email: "bilal@acme-enterprise.com", role: "ACCOUNTANT" });
    expect(accUser.status).toBe(201);

    const cashierUser = await request(app)
      .post("/api/users/invite")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({ name: "Cashier Tariq", email: "tariq@acme-enterprise.com", role: "CASHIER" });
    expect(cashierUser.status).toBe(201);

    const auditorUser = await request(app)
      .post("/api/users/invite")
      .set("Authorization", `Bearer ${ownerTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({ name: "Auditor Sarah", email: "sarah@kpmg-audit.com", role: "AUDITOR" });
    expect(auditorUser.status).toBe(201);

    // Login each with default invite password "ChangeMe2026!"
    const accLogin = await request(app).post("/api/auth/login").send({
      email: "bilal@acme-enterprise.com",
      password: "ChangeMe2026!"
    });
    expect(accLogin.status).toBe(200);
    accountantTokenA = accLogin.body.data.accessToken;

    const cashierLogin = await request(app).post("/api/auth/login").send({
      email: "tariq@acme-enterprise.com",
      password: "ChangeMe2026!"
    });
    expect(cashierLogin.status).toBe(200);
    cashierTokenA = cashierLogin.body.data.accessToken;

    const auditorLogin = await request(app).post("/api/auth/login").send({
      email: "sarah@kpmg-audit.com",
      password: "ChangeMe2026!"
    });
    expect(auditorLogin.status).toBe(200);
    auditorTokenA = auditorLogin.body.data.accessToken;

    // Boundary Test 1: CASHIER cannot post manual journals (403 Forbidden)
    const cashierJournalRes = await request(app)
      .post("/api/journal")
      .set("Authorization", `Bearer ${cashierTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({
        date: "2026-07-01",
        narration: "Unauthorized cashier journal",
        lines: [
          { accountId: cogsAccountId, debit: "500.00", credit: "0.00" },
          { accountId: glBankAccountId, debit: "0.00", credit: "500.00" }
        ]
      });
    expect(cashierJournalRes.status).toBe(403);

    // Boundary Test 2: AUDITOR is strictly read-only and blocked from posting sales invoices (403 Forbidden)
    const auditorInvRes = await request(app)
      .post("/api/sales/invoices")
      .set("Authorization", `Bearer ${auditorTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({
        contactId: customerId,
        date: "2026-07-01",
        items: [{ description: "Auditor sale", quantity: "1.000", unitPrice: "100.00" }]
      });
    expect(auditorInvRes.status).toBe(403);

    // Boundary Test 3: AUDITOR can read financial reports (200 OK)
    const auditorReportRes = await request(app)
      .get("/api/reports/trial-balance")
      .set("Authorization", `Bearer ${auditorTokenA}`)
      .set("X-Company-Id", companyAId);
    expect(auditorReportRes.status).toBe(200);

    // Boundary Test 4: ACCOUNTANT can view and post journals (201 Created)
    const accJournalRes = await request(app)
      .post("/api/journal")
      .set("Authorization", `Bearer ${accountantTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({
        date: "2026-07-05",
        narration: "Certified accountant adjustment",
        lines: [
          { accountId: cogsAccountId, debit: "1500.00", credit: "0.00" },
          { accountId: glBankAccountId, debit: "0.00", credit: "1500.00" }
        ]
      });
    expect(accJournalRes.status).toBe(201);
  });
});
