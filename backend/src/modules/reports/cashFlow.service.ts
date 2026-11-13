import { prisma } from "../../config/prisma.js";
import { Decimal, toDecimal } from "../../lib/money.js";

export class CashFlowService {
  static async getReport(companyId: string, startDateStr?: string, endDateStr?: string) {
    const startDate = startDateStr ? new Date(startDateStr) : null;
    const endDate = endDateStr ? new Date(endDateStr) : null;

    // Find Cash & Bank accounts
    const cashAccounts = await prisma.account.findMany({
      where: {
        companyId,
        type: "ASSET",
        OR: [
          { systemKey: { in: ["CASH", "BANK"] } },
          { code: { in: ["1001", "1002"] } }
        ]
      }
    });

    const cashAccountIds = (cashAccounts as any[]).map((a: any) => a.id);

    // 1. Opening Balance: Lines before startDate
    let openingBalance = new Decimal(0);
    if (startDate) {
      const priorLines = await prisma.journalLine.findMany({
        where: {
          accountId: { in: cashAccountIds },
          entry: {
            companyId,
            status: "POSTED",
            date: { lt: startDate }
          }
        }
      });

      for (const line of priorLines as any[]) {
        openingBalance = openingBalance.plus(toDecimal(line.debit)).minus(toDecimal(line.credit));
      }
    }

    // 2. Period Transactions on Cash & Bank
    const whereClause: any = {
      accountId: { in: cashAccountIds },
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
        entry: true,
        account: true
      },
      orderBy: {
        entry: {
          date: "asc"
        }
      }
    });

    let totalInflow = new Decimal(0);
    let totalOutflow = new Decimal(0);

    const inflowsBySource = new Map<string, Decimal>();
    const outflowsBySource = new Map<string, Decimal>();

    const transactions = (lines as any[]).map((l: any) => {
      const debit = toDecimal(l.debit);
      const credit = toDecimal(l.credit);
      const source = l.entry.sourceType || "MANUAL";

      if (debit.greaterThan(0)) {
        totalInflow = totalInflow.plus(debit);
        inflowsBySource.set(source, (inflowsBySource.get(source) || new Decimal(0)).plus(debit));
      }

      if (credit.greaterThan(0)) {
        totalOutflow = totalOutflow.plus(credit);
        outflowsBySource.set(source, (outflowsBySource.get(source) || new Decimal(0)).plus(credit));
      }

      return {
        id: l.id,
        date: l.entry.date.toISOString(),
        accountCode: l.account?.code,
        accountName: l.account?.name,
        entryNumber: l.entry.number,
        sourceType: source,
        sourceId: l.entry.sourceId || null,
        memo: l.memo || l.entry.narration,
        inflow: debit.toFixed(2),
        outflow: credit.toFixed(2)
      };
    });

    const netMovement = totalInflow.minus(totalOutflow);
    const closingBalance = openingBalance.plus(netMovement);

    return {
      period: {
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null
      },
      cashAccounts: (cashAccounts as any[]).map((a: any) => ({ id: a.id, code: a.code, name: a.name })),
      openingBalance: openingBalance.toFixed(2),
      inflows: {
        total: totalInflow.toFixed(2),
        bySource: Array.from(inflowsBySource.entries()).map(([source, amount]) => ({
          source,
          amount: amount.toFixed(2)
        }))
      },
      outflows: {
        total: totalOutflow.toFixed(2),
        bySource: Array.from(outflowsBySource.entries()).map(([source, amount]) => ({
          source,
          amount: amount.toFixed(2)
        }))
      },
      netMovement: netMovement.toFixed(2),
      closingBalance: closingBalance.toFixed(2),
      transactions
    };
  }
}
