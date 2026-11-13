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

describe("PHASE 5 ACCEPTANCE TEST SUITE: AUDIT, PERIOD LOCK, YEAR-END CLOSING, RECONCILIATION & RBAC", () => {
  let ownerToken: string;
  let companyId: string;
  let ownerId: string;
  let bankAccountId: string;
  let cashAccountId: string;
  let salesAccountId: string;
  let expenseAccountId: string;
  let retainedEarningsAccountId: string;

  beforeEach(async () => {
    inMemory = createInMemoryPrisma();

    // 1. Register Owner and Company
    const regRes = await request(app)
      .post("/api/auth/register")
      .send({
        email: "owner@enterprise-corp.com",
        password: "Password123!",
        name: "Enterprise Owner",
        companyName: "Enterprise Holding Corp"
      });

    ownerToken = regRes.body.data.accessToken;
    companyId = regRes.body.data.company.id;
    ownerId = regRes.body.data.user.id;

    // 2. Query default accounts
    const accRes = await request(app)
      .get("/api/accounts")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId);

    const accounts = accRes.body.data;
    cashAccountId = accounts.find((a: any) => a.code === "1001").id;
    salesAccountId = accounts.find((a: any) => a.code === "4001").id;
    expenseAccountId = accounts.find((a: any) => a.code === "5001").id;
    retainedEarningsAccountId = accounts.find((a: any) => a.code === "3100").id;

    // 3. Create a Bank Account linked to 1002 Bank
    const bankGlAcc = accounts.find((a: any) => a.code === "1002") || accounts.find((a: any) => a.code === "1001");
    const bankRes = await request(app)
      .post("/api/banking/accounts")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({
        name: "Standard Chartered Operating Account",
        accountId: bankGlAcc.id,
        accountNo: "SCB-99882211"
      });

    bankAccountId = bankRes.body.data.id;
  });

  // --------------------------------------------------------------------------
  // ACCEPTANCE CRITERION 1: Audit Log generation on all relevant operations
  // --------------------------------------------------------------------------
  it("Acceptance Criterion 1: Every relevant action creates an immutable AuditLog record with old/new data", async () => {
    // Action 1: Set Period Lock
    await request(app)
      .put("/api/fiscal/period-lock")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({ lockedUntil: "2026-06-30" });

    // Action 2: Create a customer contact
    const contactRes = await request(app)
      .post("/api/contacts")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({
        name: "Acme Industries",
        type: "CUSTOMER",
        email: "billing@acme.com"
      });

    expect(contactRes.status).toBe(201);

    // Query Audit Logs
    const auditRes = await request(app)
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId);

    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.length).toBeGreaterThan(0);

    // Verify Company period lock audit log entry
    const lockLog = auditRes.body.data.find(
      (l: any) => l.model === "Company" && l.action === "UPDATE"
    );
    expect(lockLog).toBeDefined();
    expect(lockLog.newData.lockedUntil).toContain("2026-06-30");

    // Inspect individual log detail via GET /api/audit-logs/:id
    const singleLogRes = await request(app)
      .get(`/api/audit-logs/${lockLog.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId);

    expect(singleLogRes.status).toBe(200);
    expect(singleLogRes.body.data.id).toBe(lockLog.id);
    expect(singleLogRes.body.data.model).toBe("Company");
  });

  // --------------------------------------------------------------------------
  // ACCEPTANCE CRITERION 2: AuditLog immutability (UPDATE and DELETE prohibited)
  // --------------------------------------------------------------------------
  it("Acceptance Criterion 2: AuditLog records are strictly immutable and reject UPDATE and DELETE with 403 Forbidden", async () => {
    // Generate an audit log
    await request(app)
      .put("/api/fiscal/period-lock")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({ lockedUntil: "2026-01-31" });

    const auditRes = await request(app)
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId);

    const logId = auditRes.body.data[0].id;

    // Attempt PUT update
    const putRes = await request(app)
      .put(`/api/audit-logs/${logId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({ action: "TAMPERED" });

    expect(putRes.status).toBe(403);
    expect(putRes.body.error.code).toBe("AUDIT_LOG_IMMUTABLE");

    // Attempt DELETE
    const deleteRes = await request(app)
      .delete(`/api/audit-logs/${logId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId);

    expect(deleteRes.status).toBe(403);
    expect(deleteRes.body.error.code).toBe("AUDIT_LOG_IMMUTABLE");
  });

  // --------------------------------------------------------------------------
  // ACCEPTANCE CRITERION 3: Period lock and closed fiscal year reject transactions
  // --------------------------------------------------------------------------
  it("Acceptance Criterion 3: Locked periods and closed fiscal years reject new or edited transactions", async () => {
    // Lock entries on or before 2026-03-31
    await request(app)
      .put("/api/fiscal/period-lock")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({ lockedUntil: "2026-03-31" });

    // Attempt to post a Journal Entry dated 2026-03-15 (within locked period)
    const lockedJournalRes = await request(app)
      .post("/api/journal")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({
        date: "2026-03-15",
        narration: "Attempted entry in locked period",
        lines: [
          { accountId: cashAccountId, debit: "1000.00", credit: "0.00" },
          { accountId: salesAccountId, debit: "0.00", credit: "1000.00" }
        ]
      });

    expect(lockedJournalRes.status).toBe(422);
    expect(lockedJournalRes.body.error.code).toBe("PERIOD_LOCKED");

    // Entry dated after period lock (2026-04-05) must succeed
    const validJournalRes = await request(app)
      .post("/api/journal")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({
        date: "2026-04-05",
        narration: "Valid entry after period lock",
        lines: [
          { accountId: cashAccountId, debit: "1000.00", credit: "0.00" },
          { accountId: salesAccountId, debit: "0.00", credit: "1000.00" }
        ]
      });

    expect(validJournalRes.status).toBe(201);

    // Unlock period before testing closed fiscal year
    await request(app)
      .put("/api/fiscal/period-lock")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({ lockedUntil: null });

    // Create a closed fiscal year for 2025
    const fyRes = await request(app)
      .post("/api/fiscal/years")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({
        name: "FY 2025",
        startDate: "2025-01-01",
        endDate: "2025-12-31"
      });

    const fyId = fyRes.body.data.id;

    // Close the 2025 fiscal year
    await request(app)
      .post(`/api/fiscal/years/${fyId}/close`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId);

    // Attempt to post entry inside closed fiscal year
    const closedFyRes = await request(app)
      .post("/api/journal")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({
        date: "2025-06-20",
        narration: "Entry inside closed fiscal year",
        lines: [
          { accountId: cashAccountId, debit: "500.00", credit: "0.00" },
          { accountId: salesAccountId, debit: "0.00", credit: "500.00" }
        ]
      });

    expect(closedFyRes.status).toBe(422);
    expect(closedFyRes.body.error.code).toBe("FISCAL_YEAR_CLOSED");
  });

  // --------------------------------------------------------------------------
  // ACCEPTANCE CRITERION 4: Year-End Closing Engine
  // --------------------------------------------------------------------------
  it("Acceptance Criterion 4: Year-end closing creates balanced closing entries, zeroes out P&L accounts, and marks fiscal year closed", async () => {
    // 1. Create a Fiscal Year for 2026
    const fyRes = await request(app)
      .post("/api/fiscal/years")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({
        name: "FY 2026",
        startDate: "2026-01-01",
        endDate: "2026-12-31"
      });

    const fyId = fyRes.body.data.id;

    // 2. Post Income (Sales: 50,000) and Expense (COGS: 20,000)
    await request(app)
      .post("/api/journal")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({
        date: "2026-05-10",
        narration: "Revenue transaction",
        lines: [
          { accountId: cashAccountId, debit: "50000.00", credit: "0.00" },
          { accountId: salesAccountId, debit: "0.00", credit: "50000.00" }
        ]
      });

    await request(app)
      .post("/api/journal")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({
        date: "2026-06-15",
        narration: "Operating expense transaction",
        lines: [
          { accountId: expenseAccountId, debit: "20000.00", credit: "0.00" },
          { accountId: cashAccountId, debit: "0.00", credit: "20000.00" }
        ]
      });

    // 3. Execute Year-End Close
    const closeRes = await request(app)
      .post(`/api/fiscal/years/${fyId}/close`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId);

    expect(closeRes.status).toBe(200);
    expect(closeRes.body.data.fiscalYear.isClosed).toBe(true);
    expect(closeRes.body.data.netProfit).toBe("30000.00"); // 50000 - 20000 = 30000 net profit

    // Closing Journal Entry must be balanced
    const closingEntry = closeRes.body.data.closingEntry;
    expect(closingEntry.sourceType).toBe("YEAR_END_CLOSING");

    const sumDebits = closingEntry.lines.reduce((s: number, l: any) => s + Number(l.debit), 0);
    const sumCredits = closingEntry.lines.reduce((s: number, l: any) => s + Number(l.credit), 0);
    expect(sumDebits).toBe(50000);
    expect(sumCredits).toBe(50000);

    // Verify Repeat-Safe / Idempotency: Attempting to close again must fail
    const repeatCloseRes = await request(app)
      .post(`/api/fiscal/years/${fyId}/close`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId);

    expect(repeatCloseRes.status).toBe(422);
    expect(repeatCloseRes.body.error.code).toBe("FISCAL_YEAR_ALREADY_CLOSED");

    // 4. Reopening Fiscal Year (Strictly requires OWNER and mandatory audit reason)
    const reopenRes = await request(app)
      .post(`/api/fiscal/years/${fyId}/reopen`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({ reason: "Auditor requested additional adjustments for Q4 depreciation." });

    expect(reopenRes.status).toBe(200);
    expect(reopenRes.body.data.fiscalYear.isClosed).toBe(false);
  });

  // --------------------------------------------------------------------------
  // ACCEPTANCE CRITERION 5: Bank Reconciliation without duplicate accounting entries
  // --------------------------------------------------------------------------
  it("Acceptance Criterion 5: Bank reconciliation imports CSV statement without creating duplicate journal entries and calculates difference", async () => {
    // 1. Count existing journal entries before import
    const initialJournalsRes = await request(app)
      .get("/api/journal")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId);

    const initialJournalCount = initialJournalsRes.body.data.length;

    // 2. Post a legitimate GL entry in the accounting system
    // Received payment: 15,000 into Bank on 2026-05-10
    const accounts = (await request(app).get("/api/accounts").set("Authorization", `Bearer ${ownerToken}`).set("X-Company-Id", companyId)).body.data;
    const bankAccountRecord = (await request(app).get("/api/banking/accounts").set("Authorization", `Bearer ${ownerToken}`).set("X-Company-Id", companyId)).body.data.find((b: any) => b.id === bankAccountId);
    const bankGlAccountId = bankAccountRecord.accountId;

    const glPostRes = await request(app)
      .post("/api/journal")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({
        date: "2026-05-10",
        narration: "Customer remittance to bank",
        lines: [
          { accountId: bankGlAccountId, debit: "15000.00", credit: "0.00" },
          { accountId: salesAccountId, debit: "0.00", credit: "15000.00" }
        ]
      });

    expect(glPostRes.status).toBe(201);

    // 3. Import Bank Statement CSV
    const csvContent = `Date,Description,Reference,Debit,Credit
2026-05-11,Customer Wire In,WIRE-881,0.00,15000.00
2026-05-12,Bank Maintenance Fee,FEE-01,250.00,0.00`;

    const importRes = await request(app)
      .post("/api/banking/statements/import")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId)
      .send({
        bankAccountId,
        fileName: "may-2026-statement.csv",
        csvContent,
        openingBalance: "0.00",
        closingBalance: "14750.00"
      });

    expect(importRes.status).toBe(201);
    const statement = importRes.body.data;
    expect(statement.lines.length).toBe(2);

    // CRITICAL INVARIANT: Importing bank statement MUST NEVER create duplicate journal entries
    const postImportJournalsRes = await request(app)
      .get("/api/journal")
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId);

    // Number of journal entries should only be initial + 1 (our manually posted GL entry)
    expect(postImportJournalsRes.body.data.length).toBe(initialJournalCount + 1);

    // 4. Run Auto-Match Engine
    const matchRes = await request(app)
      .post(`/api/banking/statements/${statement.id}/auto-match`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId);

    expect(matchRes.status).toBe(200);
    expect(matchRes.body.data.matchedCount).toBe(1); // 15,000 matches exactly (+1 day)

    // 5. Query Reconciliation Report
    const reconRes = await request(app)
      .get(`/api/banking/reconciliation/${bankAccountId}?statementId=${statement.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("X-Company-Id", companyId);

    expect(reconRes.status).toBe(200);
    expect(reconRes.body.data.statementBalance).toBe("14750.00");
    expect(reconRes.body.data.statementLines.find((l: any) => l.reference === "WIRE-881").isReconciled).toBe(true);
  });

  // --------------------------------------------------------------------------
  // ACCEPTANCE CRITERION 6: User roles enforce strict permission boundaries
  // --------------------------------------------------------------------------
  it("Acceptance Criterion 6: User roles enforce strict permission boundaries across OWNER, ACCOUNTANT, and CASHIER", async () => {
    // 1. Invite an Accountant
    const accountantUser = await inMemory.db.user.create({
      data: { email: "accountant@corp.com", name: "Staff Accountant", passwordHash: "dummy" }
    });
    await inMemory.db.membership.create({
      data: { userId: accountantUser.id, companyId, role: Role.ACCOUNTANT }
    });
    const accountantToken = generateAccessToken(accountantUser.id);

    // 2. Invite a Cashier
    const cashierUser = await inMemory.db.user.create({
      data: { email: "cashier@corp.com", name: "POS Cashier", passwordHash: "dummy" }
    });
    await inMemory.db.membership.create({
      data: { userId: cashierUser.id, companyId, role: Role.CASHIER }
    });
    const cashierToken = generateAccessToken(cashierUser.id);

    // Accountant CAN create journal entries
    const accJournalRes = await request(app)
      .post("/api/journal")
      .set("Authorization", `Bearer ${accountantToken}`)
      .set("X-Company-Id", companyId)
      .send({
        date: "2026-07-01",
        narration: "Accountant posted entry",
        lines: [
          { accountId: cashAccountId, debit: "200.00", credit: "0.00" },
          { accountId: salesAccountId, debit: "0.00", credit: "200.00" }
        ]
      });
    expect(accJournalRes.status).toBe(201);

    // Accountant CANNOT invite other team members (OWNER only)
    const accInviteRes = await request(app)
      .post("/api/users/invite")
      .set("Authorization", `Bearer ${accountantToken}`)
      .set("X-Company-Id", companyId)
      .send({
        email: "unauthorized@corp.com",
        name: "Unauthorized",
        role: Role.ACCOUNTANT
      });
    expect(accInviteRes.status).toBe(403);

    // Cashier CANNOT create journal entries (Forbidden)
    const cashierJournalRes = await request(app)
      .post("/api/journal")
      .set("Authorization", `Bearer ${cashierToken}`)
      .set("X-Company-Id", companyId)
      .send({
        date: "2026-07-01",
        narration: "Cashier unauthorized journal",
        lines: [
          { accountId: cashAccountId, debit: "100.00", credit: "0.00" },
          { accountId: salesAccountId, debit: "0.00", credit: "100.00" }
        ]
      });
    expect(cashierJournalRes.status).toBe(403);

    // Cashier CANNOT access audit logs
    const cashierAuditRes = await request(app)
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${cashierToken}`)
      .set("X-Company-Id", companyId);
    expect(cashierAuditRes.status).toBe(403);
  });

  // --------------------------------------------------------------------------
  // ACCEPTANCE CRITERION 7: Auditor role has read-only access
  // --------------------------------------------------------------------------
  it("Acceptance Criterion 7: Auditor role has read-only access to financial reports and audit logs, but is blocked from mutating records", async () => {
    // 1. Create Auditor User & Membership
    const auditorUser = await inMemory.db.user.create({
      data: { email: "auditor@ey-kpmg.com", name: "External Auditor", passwordHash: "dummy" }
    });
    await inMemory.db.membership.create({
      data: { userId: auditorUser.id, companyId, role: Role.AUDITOR }
    });
    const auditorToken = generateAccessToken(auditorUser.id);

    // 2. Auditor CAN read financial reports
    const reportRes = await request(app)
      .get("/api/reports/trial-balance")
      .set("Authorization", `Bearer ${auditorToken}`)
      .set("X-Company-Id", companyId);
    expect(reportRes.status).toBe(200);

    // 3. Auditor CAN read audit logs
    const auditRes = await request(app)
      .get("/api/audit-logs")
      .set("Authorization", `Bearer ${auditorToken}`)
      .set("X-Company-Id", companyId);
    expect(auditRes.status).toBe(200);

    // 4. Auditor CAN read Chart of Accounts
    const accRes = await request(app)
      .get("/api/accounts")
      .set("Authorization", `Bearer ${auditorToken}`)
      .set("X-Company-Id", companyId);
    expect(accRes.status).toBe(200);

    // 5. Auditor is STRICTLY BLOCKED from mutating data:
    // Blocked from creating journal entries
    const mutateJournalRes = await request(app)
      .post("/api/journal")
      .set("Authorization", `Bearer ${auditorToken}`)
      .set("X-Company-Id", companyId)
      .send({
        date: "2026-08-01",
        narration: "Auditor attempting entry",
        lines: [
          { accountId: cashAccountId, debit: "50.00", credit: "0.00" },
          { accountId: salesAccountId, debit: "0.00", credit: "50.00" }
        ]
      });
    expect(mutateJournalRes.status).toBe(403);

    // Blocked from setting period locks
    const mutateLockRes = await request(app)
      .put("/api/fiscal/period-lock")
      .set("Authorization", `Bearer ${auditorToken}`)
      .set("X-Company-Id", companyId)
      .send({ lockedUntil: "2026-12-31" });
    expect(mutateLockRes.status).toBe(403);

    // Blocked from creating sales invoices
    const mutateInvoiceRes = await request(app)
      .post("/api/sales/invoices")
      .set("Authorization", `Bearer ${auditorToken}`)
      .set("X-Company-Id", companyId)
      .send({
        contactId: "dummy-contact",
        date: "2026-08-01",
        items: []
      });
    expect(mutateInvoiceRes.status).toBe(403);
  });
});
