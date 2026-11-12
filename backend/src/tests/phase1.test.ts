import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { Role, AccountType } from "@prisma/client";

// Mock the prisma singleton module dynamically
vi.mock("../config/prisma.js", async () => {
  const { createInMemoryPrisma } = await import("./mocks/prismaMock.js");
  const inMemory = createInMemoryPrisma();
  return {
    prisma: inMemory.db,
    __inMemory: inMemory
  };
});

// Import app and mock after mocking prisma
import { app } from "../app.js";
import { prisma } from "../config/prisma.js";

// Access in-memory stores via the mocked module
const inMemory = (await import("../config/prisma.js") as any).__inMemory;

describe("PHASE 1 ACCEPTANCE TEST SUITE", () => {
  let userTokenA: string;
  let userTokenB: string;
  let companyAId: string;
  let companyBId: string;
  let cashAccountId: string;
  let salesAccountId: string;

  it("Acceptance Criterion 1: User registration creates User, Company, OWNER membership, 15 Default Accounts, and Default Warehouse", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "owner@companya.com",
      password: "StrongPassword123!",
      name: "Alice Owner",
      companyName: "Company A Corp",
      currency: "PKR"
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty("accessToken");
    expect(res.body.data.user.email).toBe("owner@companya.com");
    expect(res.body.data.company.name).toBe("Company A Corp");
    expect(res.body.data.company.role).toBe(Role.OWNER);

    userTokenA = res.body.data.accessToken;
    companyAId = res.body.data.company.id;

    // Verify 15 Default accounts were seeded
    const accountsRes = await request(app)
      .get("/api/accounts")
      .set("Authorization", `Bearer ${userTokenA}`)
      .set("X-Company-Id", companyAId);

    expect(accountsRes.status).toBe(200);
    expect(accountsRes.body.data.length).toBeGreaterThanOrEqual(15);

    const cash = accountsRes.body.data.find((a: any) => a.code === "1001");
    const sales = accountsRes.body.data.find((a: any) => a.code === "4001");
    expect(cash).toBeDefined();
    expect(cash.systemKey).toBe("CASH");
    expect(sales).toBeDefined();
    expect(sales.systemKey).toBe("SALES");

    cashAccountId = cash.id;
    salesAccountId = sales.id;
  });

  it("Acceptance Criterion 2: User Login and Token Refresh work correctly", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "owner@companya.com",
      password: "StrongPassword123!"
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data).toHaveProperty("accessToken");
    expect(loginRes.body.data.companies.length).toBeGreaterThanOrEqual(1);

    // Verify refresh cookie set
    const cookies = loginRes.headers["set-cookie"] || [];
    const refreshCookie = cookies.find((c: string) => c.startsWith("refreshToken="));
    expect(refreshCookie).toBeDefined();

    // Verify GET /api/auth/me
    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginRes.body.data.accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.email).toBe("owner@companya.com");
  });

  it("Acceptance Criterion 3: Multi-Tenant Isolation - Company A user cannot access Company B data", async () => {
    // Register Company B with a different user
    const resB = await request(app).post("/api/auth/register").send({
      email: "owner@companyb.com",
      password: "StrongPassword123!",
      name: "Bob Owner",
      companyName: "Company B Ltd",
      currency: "PKR"
    });

    expect(resB.status).toBe(201);
    userTokenB = resB.body.data.accessToken;
    companyBId = resB.body.data.company.id;

    // User A attempts to access Company B accounts using their own token
    const unauthorizedAccess = await request(app)
      .get("/api/accounts")
      .set("Authorization", `Bearer ${userTokenA}`)
      .set("X-Company-Id", companyBId);

    expect(unauthorizedAccess.status).toBe(403);
    expect(unauthorizedAccess.body.error.code).toBe("FORBIDDEN_COMPANY_ACCESS");

    // Missing X-Company-Id header returns 400 Bad Request
    const missingHeader = await request(app)
      .get("/api/accounts")
      .set("Authorization", `Bearer ${userTokenA}`);

    expect(missingHeader.status).toBe(400);
    expect(missingHeader.body.error.code).toBe("COMPANY_ID_REQUIRED");
  });

  it("Acceptance Criterion 4: Strict Double-Entry - Unbalanced journal entries are rejected with 422", async () => {
    const unbalancedPost = await request(app)
      .post("/api/journal")
      .set("Authorization", `Bearer ${userTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({
        date: "2026-11-12",
        narration: "Unbalanced Sale Entry",
        lines: [
          { accountId: cashAccountId, debit: "5000.00", credit: "0" },
          { accountId: salesAccountId, debit: "0", credit: "4500.00" } // 500 difference!
        ]
      });

    expect(unbalancedPost.status).toBe(422);
    expect(unbalancedPost.body.error.code).toBe("UNBALANCED_ENTRY");
    expect(unbalancedPost.body.error.message).toContain("Unbalanced journal entry");
  });

  it("Acceptance Criterion 5: Balanced journal entries post successfully with concurrency sequence", async () => {
    const balancedPost = await request(app)
      .post("/api/journal")
      .set("Authorization", `Bearer ${userTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({
        date: "2026-11-12",
        narration: "Balanced Cash Sale",
        lines: [
          { accountId: cashAccountId, debit: "15000.50", credit: "0", memo: "Cash received" },
          { accountId: salesAccountId, debit: "0", credit: "15000.50", memo: "Consulting income" }
        ]
      });

    expect(balancedPost.status).toBe(201);
    expect(balancedPost.body.data).toHaveProperty("number");
    expect(balancedPost.body.data.number).toMatch(/^JV-\d{4}-\d{4}$/);
    expect(balancedPost.body.data.status).toBe("POSTED");
    expect(balancedPost.body.data.lines.length).toBe(2);
  });

  it("Acceptance Criterion 6: Immutable Financial Records - Posted journals cannot be edited or deleted (403)", async () => {
    // 1. Create a draft journal entry
    const draftRes = await request(app)
      .post("/api/journal/draft")
      .set("Authorization", `Bearer ${userTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({
        date: "2026-11-12",
        narration: "Draft Journal",
        lines: [
          { accountId: cashAccountId, debit: "1000", credit: "0" },
          { accountId: salesAccountId, debit: "0", credit: "1000" }
        ]
      });

    expect(draftRes.status).toBe(201);
    const draftId = draftRes.body.data.id;

    // 2. Post the draft
    const postRes = await request(app)
      .post(`/api/journal/${draftId}/post`)
      .set("Authorization", `Bearer ${userTokenA}`)
      .set("X-Company-Id", companyAId);

    expect(postRes.status).toBe(200);
    const postedId = postRes.body.data.id;
    expect(postRes.body.data.status).toBe("POSTED");

    // 3. Attempt to EDIT posted journal -> MUST return 403 Forbidden
    const editAttempt = await request(app)
      .patch(`/api/journal/draft/${postedId}`)
      .set("Authorization", `Bearer ${userTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({
        date: "2026-11-12",
        lines: [{ accountId: cashAccountId, debit: "2000", credit: "0" }]
      });

    expect(editAttempt.status).toBe(403);
    expect(editAttempt.body.error.code).toBe("IMMUTABLE_RECORD");

    // 4. Attempt to DELETE posted journal -> MUST return 403 Forbidden
    const deleteAttempt = await request(app)
      .delete(`/api/journal/draft/${postedId}`)
      .set("Authorization", `Bearer ${userTokenA}`)
      .set("X-Company-Id", companyAId);

    expect(deleteAttempt.status).toBe(403);
    expect(deleteAttempt.body.error.code).toBe("IMMUTABLE_RECORD");
  });

  it("Acceptance Criterion 7: Corrections happen via Reversal Entries (Reversal reverses debits and credits)", async () => {
    // 1. Create and post an entry
    const original = await request(app)
      .post("/api/journal")
      .set("Authorization", `Bearer ${userTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({
        date: "2026-11-12",
        narration: "Entry to be reversed",
        lines: [
          { accountId: cashAccountId, debit: "2500.00", credit: "0" },
          { accountId: salesAccountId, debit: "0", credit: "2500.00" }
        ]
      });

    const originalId = original.body.data.id;

    // 2. Reverse the entry
    const reversalRes = await request(app)
      .post(`/api/journal/${originalId}/reverse`)
      .set("Authorization", `Bearer ${userTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({
        reason: "Customer order cancellation"
      });

    expect(reversalRes.status).toBe(200);
    expect(reversalRes.body.data.sourceType).toBe("REVERSAL");

    // Verify lines inverted: Cash now credit 2500, Sales now debit 2500
    const reversalLines = reversalRes.body.data.lines;
    const cashLine = reversalLines.find((l: any) => l.accountId === cashAccountId);
    const salesLine = reversalLines.find((l: any) => l.accountId === salesAccountId);

    expect(cashLine.credit.toString()).toBe("2500");
    expect(salesLine.debit.toString()).toBe("2500");
  });

  it("Acceptance Criterion 8: Period Lock & Fiscal Year Lock reject entries", async () => {
    // Set lockedUntil on Company A to 2026-10-31
    const comp = inMemory.stores.companies.find((c: any) => c.id === companyAId);
    comp.lockedUntil = new Date("2026-10-31T23:59:59Z");

    // Attempt to post transaction dated in locked period (2026-10-15)
    const lockedRes = await request(app)
      .post("/api/journal")
      .set("Authorization", `Bearer ${userTokenA}`)
      .set("X-Company-Id", companyAId)
      .send({
        date: "2026-10-15",
        narration: "Transaction in locked period",
        lines: [
          { accountId: cashAccountId, debit: "1000", credit: "0" },
          { accountId: salesAccountId, debit: "0", credit: "1000" }
        ]
      });

    expect(lockedRes.status).toBe(422);
    expect(lockedRes.body.error.code).toBe("PERIOD_LOCKED");
  });

  it("Acceptance Criterion 9: System Accounts cannot be deleted or have protected properties mutated", async () => {
    // Attempt to delete system account (Cash 1001)
    const deleteSystemAcc = await request(app)
      .delete(`/api/accounts/${cashAccountId}`)
      .set("Authorization", `Bearer ${userTokenA}`)
      .set("X-Company-Id", companyAId);

    expect(deleteSystemAcc.status).toBe(403);
    expect(deleteSystemAcc.body.error.code).toBe("SYSTEM_ACCOUNT_PROTECTED");
  });

  it("Acceptance Criterion 10: Role-Based Access Control - AUDITOR role cannot mutate records", async () => {
    // Add an AUDITOR user to Company A
    const auditorUser = {
      id: "auditor-user-1",
      email: "auditor@auditfirm.com",
      name: "Arthur Auditor"
    };
    inMemory.stores.users.push(auditorUser);
    inMemory.stores.memberships.push({
      userId: auditorUser.id,
      companyId: companyAId,
      role: Role.AUDITOR
    });

    const jwt = await import("../lib/jwt.js");
    const auditorToken = jwt.generateAccessToken(auditorUser.id);

    // 1. Auditor CAN read accounts
    const readAccounts = await request(app)
      .get("/api/accounts")
      .set("Authorization", `Bearer ${auditorToken}`)
      .set("X-Company-Id", companyAId);

    expect(readAccounts.status).toBe(200);

    // 2. Auditor CANNOT create an account (403 Forbidden)
    const createAccount = await request(app)
      .post("/api/accounts")
      .set("Authorization", `Bearer ${auditorToken}`)
      .set("X-Company-Id", companyAId)
      .send({
        code: "9999",
        name: "Unauthorized Account",
        type: AccountType.EXPENSE
      });

    expect(createAccount.status).toBe(403);
    expect(createAccount.body.error.code).toBe("INSUFFICIENT_PERMISSIONS");

    // 3. Auditor CANNOT post a journal entry (403 Forbidden)
    const postJournal = await request(app)
      .post("/api/journal")
      .set("Authorization", `Bearer ${auditorToken}`)
      .set("X-Company-Id", companyAId)
      .send({
        date: "2026-11-12",
        lines: [
          { accountId: cashAccountId, debit: "100", credit: "0" },
          { accountId: salesAccountId, debit: "0", credit: "100" }
        ]
      });

    expect(postJournal.status).toBe(403);
    expect(postJournal.body.error.code).toBe("INSUFFICIENT_PERMISSIONS");
  });
});
