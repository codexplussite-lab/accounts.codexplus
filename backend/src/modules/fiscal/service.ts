import { Prisma, AccountType } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";
import { Decimal } from "decimal.js";
import { toDecimal, sumDecimals, equalsDecimal } from "../../lib/money.js";
import { createAuditLog } from "../../lib/audit.js";
import { getNextSequence } from "../../lib/sequence.js";
import { CreateFiscalYearInput, ReopenFiscalYearInput, SetPeriodLockInput } from "./schema.js";

export class FiscalService {
  /**
   * Sets or clears the company-wide period lock date.
   */
  static async setPeriodLock(
    companyId: string,
    input: SetPeriodLockInput,
    userId?: string,
    ipAddress?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { id: true, lockedUntil: true }
      });

      if (!company) {
        throw new AppError("Company not found.", 404, "COMPANY_NOT_FOUND");
      }

      const oldLockedUntil = company.lockedUntil ? company.lockedUntil.toISOString() : null;
      const newLockedUntil = input.lockedUntil ? new Date(input.lockedUntil) : null;

      const updated = await tx.company.update({
        where: { id: companyId },
        data: { lockedUntil: newLockedUntil },
        select: { id: true, name: true, lockedUntil: true }
      });

      await createAuditLog(tx, {
        companyId,
        userId,
        model: "Company",
        objectId: companyId,
        action: "UPDATE",
        oldData: { lockedUntil: oldLockedUntil },
        newData: { lockedUntil: newLockedUntil ? newLockedUntil.toISOString() : null },
        ipAddress
      });

      return updated;
    });
  }

  /**
   * Gets current period lock settings.
   */
  static async getPeriodLock(companyId: string) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, lockedUntil: true }
    });

    if (!company) {
      throw new AppError("Company not found.", 404, "COMPANY_NOT_FOUND");
    }

    return { lockedUntil: company.lockedUntil };
  }

  /**
   * Creates a new fiscal year ensuring non-overlapping ranges.
   */
  static async createFiscalYear(
    companyId: string,
    input: CreateFiscalYearInput,
    userId?: string,
    ipAddress?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const startDate = new Date(input.startDate);
      const endDate = new Date(input.endDate);

      // Check overlap with existing fiscal years
      const existing = await tx.fiscalYear.findMany({
        where: { companyId }
      });

      const hasOverlap = existing.some((fy) => {
        const fyStart = new Date(fy.startDate).getTime();
        const fyEnd = new Date(fy.endDate).getTime();
        const newStart = startDate.getTime();
        const newEnd = endDate.getTime();
        return newStart <= fyEnd && newEnd >= fyStart;
      });

      if (hasOverlap) {
        throw new AppError(
          "Fiscal year dates overlap with an existing fiscal period.",
          409,
          "FISCAL_YEAR_OVERLAP"
        );
      }

      const fiscalYear = await tx.fiscalYear.create({
        data: {
          companyId,
          name: input.name,
          startDate,
          endDate,
          isClosed: false
        }
      });

      await createAuditLog(tx, {
        companyId,
        userId,
        model: "FiscalYear",
        objectId: fiscalYear.id,
        action: "CREATE",
        newData: fiscalYear,
        ipAddress
      });

      return fiscalYear;
    });
  }

  /**
   * Lists all fiscal years for the company.
   */
  static async listFiscalYears(companyId: string) {
    return prisma.fiscalYear.findMany({
      where: { companyId },
      orderBy: { startDate: "desc" }
    });
  }

  /**
   * Year-End Closing Engine:
   * 1. Sweeps Income & Expense accounts to 0.00.
   * 2. Transfers net profit/loss to Retained Earnings (3100).
   * 3. Creates balanced closing journal entry.
   * 4. Marks FiscalYear.isClosed = true.
   * 5. Atomically logs audit record.
   */
  static async closeFiscalYear(
    companyId: string,
    fiscalYearId: string,
    userId?: string,
    ipAddress?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const fiscalYear = await tx.fiscalYear.findFirst({
        where: { id: fiscalYearId, companyId }
      });

      if (!fiscalYear) {
        throw new AppError("Fiscal year not found.", 404, "FISCAL_YEAR_NOT_FOUND");
      }

      if (fiscalYear.isClosed) {
        throw new AppError(
          `Fiscal year '${fiscalYear.name}' is already closed. Repeat closings are prohibited.`,
          422,
          "FISCAL_YEAR_ALREADY_CLOSED"
        );
      }

      // Fetch Retained Earnings account
      const retainedEarningsAccount = await tx.account.findFirst({
        where: {
          companyId,
          OR: [
            { systemKey: "RETAINED_EARNINGS" },
            { code: "3100" }
          ]
        }
      });

      if (!retainedEarningsAccount) {
        throw new AppError(
          "Retained Earnings account (3100) not found. Cannot proceed with year-end close.",
          422,
          "RETAINED_EARNINGS_ACCOUNT_NOT_FOUND"
        );
      }

      // Fetch all income & expense accounts
      const pnlAccounts = await tx.account.findMany({
        where: {
          companyId,
          type: { in: [AccountType.INCOME, AccountType.EXPENSE] }
        }
      });

      const pnlAccountIds = pnlAccounts.map((a) => a.id);

      // Fetch all posted journal lines in fiscal period for these accounts
      const lines = await tx.journalLine.findMany({
        where: {
          accountId: { in: pnlAccountIds },
          entry: {
            companyId,
            status: "POSTED",
            date: {
              gte: fiscalYear.startDate,
              lte: fiscalYear.endDate
            }
          }
        }
      });

      // Calculate account balances
      const accountBalances = new Map<string, { debit: Decimal; credit: Decimal }>();
      for (const line of lines) {
        const cur = accountBalances.get(line.accountId) || {
          debit: new Decimal(0),
          credit: new Decimal(0)
        };
        cur.debit = cur.debit.plus(toDecimal(line.debit));
        cur.credit = cur.credit.plus(toDecimal(line.credit));
        accountBalances.set(line.accountId, cur);
      }

      let totalIncome = new Decimal(0);
      let totalExpense = new Decimal(0);
      const closingLines: { accountId: string; debit: Decimal; credit: Decimal; memo: string }[] = [];

      for (const acc of pnlAccounts) {
        const bal = accountBalances.get(acc.id) || { debit: new Decimal(0), credit: new Decimal(0) };

        if (acc.type === AccountType.INCOME) {
          // Income normal balance is credit: Net Income = credit - debit
          const netIncome = bal.credit.minus(bal.debit);
          totalIncome = totalIncome.plus(netIncome);

          if (!netIncome.isZero()) {
            if (netIncome.greaterThan(0)) {
              // Debit Income to close to zero
              closingLines.push({
                accountId: acc.id,
                debit: netIncome,
                credit: new Decimal(0),
                memo: `Closing Income Account '${acc.name}' to Retained Earnings`
              });
            } else {
              // Negative income: credit to close to zero
              closingLines.push({
                accountId: acc.id,
                debit: new Decimal(0),
                credit: netIncome.abs(),
                memo: `Closing Income Account '${acc.name}' to Retained Earnings`
              });
            }
          }
        } else if (acc.type === AccountType.EXPENSE) {
          // Expense normal balance is debit: Net Expense = debit - credit
          const netExpense = bal.debit.minus(bal.credit);
          totalExpense = totalExpense.plus(netExpense);

          if (!netExpense.isZero()) {
            if (netExpense.greaterThan(0)) {
              // Credit Expense to close to zero
              closingLines.push({
                accountId: acc.id,
                debit: new Decimal(0),
                credit: netExpense,
                memo: `Closing Expense Account '${acc.name}' to Retained Earnings`
              });
            } else {
              // Negative expense: debit to close to zero
              closingLines.push({
                accountId: acc.id,
                debit: netExpense.abs(),
                credit: new Decimal(0),
                memo: `Closing Expense Account '${acc.name}' to Retained Earnings`
              });
            }
          }
        }
      }

      const netProfit = totalIncome.minus(totalExpense);

      // Add Retained Earnings balancing line
      if (netProfit.greaterThan(0)) {
        // Profit increases equity (Credit Retained Earnings)
        closingLines.push({
          accountId: retainedEarningsAccount.id,
          debit: new Decimal(0),
          credit: netProfit,
          memo: `Net Profit allocation to Retained Earnings for ${fiscalYear.name}`
        });
      } else if (netProfit.lessThan(0)) {
        // Loss decreases equity (Debit Retained Earnings)
        closingLines.push({
          accountId: retainedEarningsAccount.id,
          debit: netProfit.abs(),
          credit: new Decimal(0),
          memo: `Net Loss absorption from Retained Earnings for ${fiscalYear.name}`
        });
      }

      // Assert Double-Entry Invariant
      const totalDebits = sumDecimals(closingLines.map((l) => l.debit));
      const totalCredits = sumDecimals(closingLines.map((l) => l.credit));

      if (!equalsDecimal(totalDebits, totalCredits)) {
        throw new AppError(
          `Closing entry is unbalanced. Total Debits (${totalDebits.toFixed(2)}) must equal Total Credits (${totalCredits.toFixed(2)}).`,
          422,
          "UNBALANCED_CLOSING_ENTRY"
        );
      }

      const closingYear = new Date(fiscalYear.endDate).getFullYear();
      const sequenceNumber = await getNextSequence(tx, companyId, "JV", closingYear);

      // Create Closing Journal Entry
      const closingEntry = await tx.journalEntry.create({
        data: {
          companyId,
          number: sequenceNumber,
          date: fiscalYear.endDate,
          narration: `Year-End Closing Entry for Fiscal Year '${fiscalYear.name}'`,
          status: "POSTED",
          sourceType: "YEAR_END_CLOSING",
          sourceId: fiscalYear.id,
          createdById: userId || null,
          lines: {
            create: closingLines.map((l) => ({
              accountId: l.accountId,
              debit: l.debit,
              credit: l.credit,
              memo: l.memo
            }))
          }
        },
        include: { lines: true }
      });

      // Mark Fiscal Year Closed
      const updatedYear = await tx.fiscalYear.update({
        where: { id: fiscalYear.id },
        data: { isClosed: true }
      });

      await createAuditLog(tx, {
        companyId,
        userId,
        model: "FiscalYear",
        objectId: fiscalYear.id,
        action: "POST",
        oldData: { isClosed: false },
        newData: {
          isClosed: true,
          closingEntryId: closingEntry.id,
          netProfit: netProfit.toFixed(2)
        },
        ipAddress
      });

      return {
        fiscalYear: updatedYear,
        closingEntry,
        netProfit: netProfit.toFixed(2),
        totalIncome: totalIncome.toFixed(2),
        totalExpense: totalExpense.toFixed(2)
      };
    });
  }

  /**
   * Reopens a closed fiscal year. Strictly restricted to OWNER with mandatory audit justification.
   */
  static async reopenFiscalYear(
    companyId: string,
    fiscalYearId: string,
    input: ReopenFiscalYearInput,
    userId?: string,
    ipAddress?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const fiscalYear = await tx.fiscalYear.findFirst({
        where: { id: fiscalYearId, companyId }
      });

      if (!fiscalYear) {
        throw new AppError("Fiscal year not found.", 404, "FISCAL_YEAR_NOT_FOUND");
      }

      if (!fiscalYear.isClosed) {
        throw new AppError(
          `Fiscal year '${fiscalYear.name}' is already open.`,
          422,
          "FISCAL_YEAR_NOT_CLOSED"
        );
      }

      // Find the closing journal entry and reverse it
      const closingEntry = await tx.journalEntry.findFirst({
        where: {
          companyId,
          sourceType: "YEAR_END_CLOSING",
          sourceId: fiscalYear.id,
          status: "POSTED"
        }
      });

      if (closingEntry) {
        await tx.journalEntry.update({
          where: { id: closingEntry.id },
          data: { status: "REVERSED" }
        });
      }

      const reopened = await tx.fiscalYear.update({
        where: { id: fiscalYear.id },
        data: { isClosed: false }
      });

      await createAuditLog(tx, {
        companyId,
        userId,
        model: "FiscalYear",
        objectId: fiscalYear.id,
        action: "UPDATE",
        oldData: { isClosed: true },
        newData: {
          isClosed: false,
          reopenReason: input.reason,
          reversedClosingEntryId: closingEntry?.id || null
        },
        ipAddress
      });

      return {
        fiscalYear: reopened,
        message: `Fiscal year '${fiscalYear.name}' reopened successfully.`
      };
    });
  }
}
