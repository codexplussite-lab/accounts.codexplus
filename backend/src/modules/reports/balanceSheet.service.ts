import { prisma } from "../../config/prisma.js";
import { Decimal, toDecimal, isEqual } from "../../lib/money.js";

export class BalanceSheetService {
  static async getReport(companyId: string, asOfDateStr?: string) {
    const asOfDate = asOfDateStr ? new Date(asOfDateStr) : new Date();

    const accounts = await prisma.account.findMany({
      where: { companyId },
      orderBy: { code: "asc" }
    });

    const lines = await prisma.journalLine.findMany({
      where: {
        entry: {
          companyId,
          status: "POSTED",
          date: { lte: asOfDate }
        }
      }
    });

    const debitMap = new Map<string, Decimal>();
    const creditMap = new Map<string, Decimal>();

    for (const l of lines as any[]) {
      const d = toDecimal(l.debit);
      const c = toDecimal(l.credit);
      debitMap.set(l.accountId, (debitMap.get(l.accountId) || new Decimal(0)).plus(d));
      creditMap.set(l.accountId, (creditMap.get(l.accountId) || new Decimal(0)).plus(c));
    }

    const assetRows: any[] = [];
    const liabilityRows: any[] = [];
    const equityRows: any[] = [];

    let totalAssets = new Decimal(0);
    let totalLiabilities = new Decimal(0);
    let totalEquityAccounts = new Decimal(0);

    // Cumulative P&L calculation for current period net income
    let cumulativeRevenue = new Decimal(0);
    let cumulativeExpense = new Decimal(0);

    for (const acc of accounts as any[]) {
      const d = debitMap.get(acc.id) || new Decimal(0);
      const c = creditMap.get(acc.id) || new Decimal(0);

      if (acc.type === "ASSET") {
        const netAsset = d.minus(c);
        if (!netAsset.isZero()) {
          assetRows.push({
            id: acc.id,
            code: acc.code,
            name: acc.name,
            amount: netAsset.toFixed(2)
          });
          totalAssets = totalAssets.plus(netAsset);
        }
      } else if (acc.type === "LIABILITY") {
        const netLiability = c.minus(d);
        if (!netLiability.isZero()) {
          liabilityRows.push({
            id: acc.id,
            code: acc.code,
            name: acc.name,
            amount: netLiability.toFixed(2)
          });
          totalLiabilities = totalLiabilities.plus(netLiability);
        }
      } else if (acc.type === "EQUITY") {
        const netEquity = c.minus(d);
        if (!netEquity.isZero()) {
          equityRows.push({
            id: acc.id,
            code: acc.code,
            name: acc.name,
            amount: netEquity.toFixed(2)
          });
          totalEquityAccounts = totalEquityAccounts.plus(netEquity);
        }
      } else if (acc.type === "INCOME") {
        cumulativeRevenue = cumulativeRevenue.plus(c.minus(d));
      } else if (acc.type === "EXPENSE") {
        cumulativeExpense = cumulativeExpense.plus(d.minus(c));
      }
    }

    // Current period net income transferred to Equity
    const currentPeriodNetEarnings = cumulativeRevenue.minus(cumulativeExpense);
    const totalEquity = totalEquityAccounts.plus(currentPeriodNetEarnings);
    const totalLiabilitiesAndEquity = totalLiabilities.plus(totalEquity);

    const isBalanced = isEqual(totalAssets, totalLiabilitiesAndEquity);
    const variance = totalAssets.minus(totalLiabilitiesAndEquity).abs();

    return {
      asOfDate: asOfDate.toISOString(),
      assets: {
        accounts: assetRows,
        total: totalAssets.toFixed(2)
      },
      liabilities: {
        accounts: liabilityRows,
        total: totalLiabilities.toFixed(2)
      },
      equity: {
        accounts: equityRows,
        currentPeriodNetEarnings: currentPeriodNetEarnings.toFixed(2),
        total: totalEquity.toFixed(2)
      },
      totalLiabilitiesAndEquity: totalLiabilitiesAndEquity.toFixed(2),
      variance: variance.toFixed(2),
      isBalanced
    };
  }
}
