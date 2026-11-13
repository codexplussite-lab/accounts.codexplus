import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { createInMemoryPrisma } from "./mocks/prismaMock.js";

let inMemory: ReturnType<typeof createInMemoryPrisma>;

vi.mock("../config/prisma.js", async () => {
  return {
    get prisma() {
      return inMemory.db;
    }
  };
});

describe("PHASE 4 ACCEPTANCE TEST SUITE: FINANCIAL REPORTING MODULE", () => {
  let token: string;
  let companyId: string;
  let customerId: string;
  let vendorId: string;
  let cashAccountId: string;
  let arAccountId: string;
  let apAccountId: string;
  let salesAccountId: string;
  let cogsAccountId: string;

  beforeEach(async () => {
    inMemory = createInMemoryPrisma();

    // 1. Register user and company (creates default accounts: 1001 Cash, 1100 AR, 2001 AP, 4001 Sales, 5001 COGS, etc.)
    const regRes = await request(app)
      .post("/api/auth/register")
      .send({
        email: "cfo@reporting-erp.com",
        password: "Password123!",
        name: "Enterprise CFO",
        companyName: "Global Capital Corp"
      });

    token = regRes.body.data.accessToken;
    companyId = regRes.body.data.company.id;

    // 2. Fetch Accounts
    const accRes = await request(app)
      .get("/api/accounts")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    const accounts = accRes.body.data;
    cashAccountId = accounts.find((a: any) => a.code === "1001").id;
    arAccountId = accounts.find((a: any) => a.code === "1100").id;
    apAccountId = accounts.find((a: any) => a.code === "2001").id;
    salesAccountId = accounts.find((a: any) => a.code === "4001").id;
    cogsAccountId = accounts.find((a: any) => a.code === "5001").id;

    // 3. Create a Customer and Vendor
    const custRes = await request(app)
      .post("/api/contacts")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        name: "Prime Distribution Ltd",
        type: "CUSTOMER",
        email: "billing@primedist.com"
      });
    customerId = custRes.body.data.id;

    const vendRes = await request(app)
      .post("/api/contacts")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        name: "Apex Raw Materials Co",
        type: "VENDOR",
        email: "sales@apexraw.com"
      });
    vendorId = vendRes.body.data.id;

    // 4. Post an Invoice (Sales: 10,000.00)
    // Dr AR 11,800, Cr Sales 10,000, Cr Sales Tax 1,800
    const invRes = await request(app)
      .post("/api/sales/invoices")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        contactId: customerId,
        date: "2026-03-01",
        dueDate: "2026-03-15",
        items: [
          {
            description: "Industrial Machine Parts",
            quantity: "10",
            unitPrice: "1000.00"
          }
        ]
      });
    const invoiceId = invRes.body.data.id;
    await request(app)
      .post(`/api/sales/invoices/${invoiceId}/post`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    // 5. Post a Vendor Bill (Purchases / Expenses: 4,000.00)
    // Dr COGS/Expense 4,000, Cr AP 4,000
    const billRes = await request(app)
      .post("/api/purchases/bills")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        contactId: vendorId,
        date: "2026-03-02",
        dueDate: "2026-03-20",
        items: [
          {
            description: "Steel Plate Batch",
            accountId: cogsAccountId,
            quantity: "4",
            unitCost: "1000.00"
          }
        ]
      });
    const billId = billRes.body.data.id;
    await request(app)
      .post(`/api/purchases/bills/${billId}/post`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    // 6. Record Customer Partial Payment of 5,000.00
    // Dr Cash 5,000, Cr AR 5,000
    await request(app)
      .post("/api/payments")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        type: "RECEIVED",
        contactId: customerId,
        invoiceId,
        accountId: cashAccountId,
        amount: "5000.00",
        date: "2026-03-05"
      });
  });

  it("Acceptance Criterion 1: Trial Balance debit equals credit", async () => {
    const res = await request(app)
      .get("/api/reports/trial-balance")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("totalDebit");
    expect(res.body.data).toHaveProperty("totalCredit");
    expect(res.body.data.totalDebit).toBe(res.body.data.totalCredit);
    expect(res.body.data.variance).toBe("0.00");
    expect(res.body.data.isBalanced).toBe(true);
  });

  it("Acceptance Criterion 2: Balance Sheet balances (Assets = Liabilities + Equity)", async () => {
    const res = await request(app)
      .get("/api/reports/balance-sheet")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(res.status).toBe(200);
    const { assets, liabilities, equity, totalLiabilitiesAndEquity, variance, isBalanced } = res.body.data;

    expect(isBalanced).toBe(true);
    expect(variance).toBe("0.00");
    expect(assets.total).toBe(totalLiabilitiesAndEquity);
    // Net profit (10,000 sales - 4,000 COGS = 6,000) is included under currentPeriodNetEarnings
    expect(equity.currentPeriodNetEarnings).toBe("6000.00");
  });

  it("Acceptance Criterion 3: General Ledger closing balance matches Trial Balance", async () => {
    // 1. Query General Ledger for Accounts Receivable (1100)
    const glRes = await request(app)
      .get(`/api/reports/general-ledger?accountId=${arAccountId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(glRes.status).toBe(200);
    const glClosing = glRes.body.data.closingBalance;

    // AR had Dr 10,000 from invoice, Cr 5,000 from payment = 5,000 closing balance
    expect(glClosing).toBe("5000.00");

    // 2. Query Trial Balance
    const tbRes = await request(app)
      .get("/api/reports/trial-balance")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    const arRow = tbRes.body.data.accounts.find((a: any) => a.code === "1100");
    expect(arRow).toBeDefined();
    expect(arRow.debit).toBe(glClosing);
    expect(arRow.closingBalance).toBe(glClosing);
  });

  it("Acceptance Criterion 4: Reports strictly exclude draft and reversed entries", async () => {
    // Create an unposted draft journal entry
    await request(app)
      .post("/api/journal/draft")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId)
      .send({
        date: "2026-03-10",
        narration: "Unposted draft manual journal",
        lines: [
          { accountId: cashAccountId, debit: "999999.00", credit: "0.00" },
          { accountId: salesAccountId, debit: "0.00", credit: "999999.00" }
        ]
      });

    // Trial balance should completely ignore the draft
    const tbRes = await request(app)
      .get("/api/reports/trial-balance")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(tbRes.status).toBe(200);
    expect(tbRes.body.data.isBalanced).toBe(true);
    const cashRow = tbRes.body.data.accounts.find((a: any) => a.code === "1001");
    // Cash should remain 5000.00 from the posted receipt, not 1,004,999.00
    expect(cashRow.debit).toBe("5000.00");
  });

  it("Acceptance Criterion 5: Reports match underlying database records (P&L, AR Ageing, Cash Flow)", async () => {
    // 1. Profit & Loss: Sales 10,000, COGS 4,000, Gross & Net Profit 6,000
    const plRes = await request(app)
      .get("/api/reports/profit-and-loss")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(plRes.status).toBe(200);
    expect(plRes.body.data.revenue.total).toBe("10000.00");
    expect(plRes.body.data.costOfGoodsSold.total).toBe("4000.00");
    expect(plRes.body.data.grossProfit).toBe("6000.00");
    expect(plRes.body.data.netProfit).toBe("6000.00");

    // 2. AR Ageing: Outstanding 5,000.00 on Customer
    const arAgeingRes = await request(app)
      .get("/api/reports/ar-ageing?asOfDate=2026-03-20")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(arAgeingRes.status).toBe(200);
    expect(arAgeingRes.body.data.totals.totalOutstanding).toBe("5000.00");

    // 3. Cash Flow: Inflow 5,000.00, Outflow 0.00, Net 5,000.00
    const cfRes = await request(app)
      .get("/api/reports/cash-flow")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(cfRes.status).toBe(200);
    expect(cfRes.body.data.inflows.total).toBe("5000.00");
    expect(cfRes.body.data.outflows.total).toBe("0.00");
    expect(cfRes.body.data.netMovement).toBe("5000.00");
    expect(cfRes.body.data.closingBalance).toBe("5000.00");
  });

  it("Acceptance Criterion 6: PDF and Excel exports return valid binary documents with headers", async () => {
    // 1. Excel Export of Trial Balance
    const excelRes = await request(app)
      .get("/api/reports/export?reportType=trial-balance&format=excel")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(excelRes.status).toBe(200);
    expect(excelRes.headers["content-type"]).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(excelRes.headers["content-disposition"]).toContain(".xlsx");

    // 2. PDF Export of Balance Sheet
    const pdfRes = await request(app)
      .get("/api/reports/export?reportType=balance-sheet&format=pdf")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Company-Id", companyId);

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers["content-type"]).toBe("application/pdf");
    expect(pdfRes.headers["content-disposition"]).toContain(".pdf");
  });
});
