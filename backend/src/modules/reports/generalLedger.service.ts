import { prisma } from "../../config/prisma.js";
import { Decimal, toDecimal } from "../../lib/money.js";
import { AppError } from "../../middleware/errorHandler.js";

export class GeneralLedgerService {
  static async getReport(companyId: string, accountId: string, startDateStr?: string, endDateStr?: string) {
    const account = await prisma.account.findFirst({
      where: { id: accountId, companyId }
    });

    if (!account) {
      throw new AppError("Account not found in company", 404, "ACCOUNT_NOT_FOUND");
    }

    const isDebitNormal = account.type === "ASSET" || account.type === "EXPENSE";

    const startDate = startDateStr ? new Date(startDateStr) : null;
    const endDate = endDateStr ? new Date(endDateStr) : null;

    // 1. Calculate Opening Balance: Posted lines before startDate
    let openingBalance = new Decimal(0);

    if (startDate) {
      const priorLines = await prisma.journalLine.findMany({
        where: {
          accountId,
          entry: {
            companyId,
            status: "POSTED",
            date: { lt: startDate }
          }
        }
      });

      for (const line of priorLines as any[]) {
        const d = toDecimal(line.debit);
        const c = toDecimal(line.credit);
        openingBalance = isDebitNormal
          ? openingBalance.plus(d).minus(c)
          : openingBalance.plus(c).minus(d);
      }
    }

    // 2. Fetch Period Transactions
    const whereClause: any = {
      accountId,
      entry: {
        companyId,
        status: "POSTED"
      }
    };

    if (startDate || endDate) {
      whereClause.entry.date = {};
      if (startDate) whereClause.entry.date.gte = startDate;
      if (endDate) whereClause.entry.date.lte = endDate;
    }

    const lines = await prisma.journalLine.findMany({
      where: whereClause,
      include: {
        entry: true
      },
      orderBy: {
        entry: {
          date: "asc"
        }
      }
    });

    let runningBalance = new Decimal(openingBalance);
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    const transactionRows = lines.map((line: any) => {
      const debit = toDecimal(line.debit);
      const credit = toDecimal(line.credit);

      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);

      if (isDebitNormal) {
        runningBalance = runningBalance.plus(debit).minus(credit);
      } else {
        runningBalance = runningBalance.plus(credit).minus(debit);
      }

      return {
        id: line.id,
        date: line.entry.date.toISOString(),
        entryNumber: line.entry.number,
        entryId: line.entryId,
        sourceType: line.entry.sourceType || "MANUAL",
        sourceId: line.entry.sourceId || null,
        narration: line.entry.narration || null,
        memo: line.memo || null,
        debit: debit.toFixed(2),
        credit: credit.toFixed(2),
        runningBalance: runningBalance.toFixed(2)
      };
    });

    return {
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        systemKey: account.systemKey,
        isDebitNormal
      },
      period: {
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null
      },
      openingBalance: openingBalance.toFixed(2),
      totalDebit: totalDebit.toFixed(2),
      totalCredit: totalCredit.toFixed(2),
      closingBalance: runningBalance.toFixed(2),
      transactions: transactionRows
    };
  }
}
