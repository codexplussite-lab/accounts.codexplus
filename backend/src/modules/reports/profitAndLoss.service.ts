import { prisma } from "../../config/prisma.js";
import { Decimal, toDecimal } from "../../lib/money.js";

export class ProfitAndLossService {
  static async getReport(companyId: string, startDateStr?: string, endDateStr?: string) {
    const startDate = startDateStr ? new Date(startDateStr) : null;
    const endDate = endDateStr ? new Date(endDateStr) : null;

    const accounts = await prisma.account.findMany({
      where: {
        companyId,
        type: { in: ["INCOME", "EXPENSE"] }
      },
      orderBy: { code: "asc" }
    });

    const whereClause: any = {
      accountId: { in: accounts.map((a: any) => a.id) },
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
      where: whereClause
    });

    // Aggregate debit and credit per account
    const debitMap = new Map<string, Decimal>();
    const creditMap = new Map<string, Decimal>();

    for (const l of lines as any[]) {
      const d = toDecimal(l.debit);
      const c = toDecimal(l.credit);
      debitMap.set(l.accountId, (debitMap.get(l.accountId) || new Decimal(0)).plus(d));
      creditMap.set(l.accountId, (creditMap.get(l.accountId) || new Decimal(0)).plus(c));
    }

    const revenueRows: any[] = [];
    const cogsRows: any[] = [];
    const expenseRows: any[] = [];

    let totalRevenue = new Decimal(0);
    let totalCOGS = new Decimal(0);
    let totalExpenses = new Decimal(0);

    for (const acc of accounts as any[]) {
      const d = debitMap.get(acc.id) || new Decimal(0);
      const c = creditMap.get(acc.id) || new Decimal(0);

      if (acc.type === "INCOME") {
        const netRevenue = c.minus(d);
        if (!netRevenue.isZero()) {
          revenueRows.push({
            id: acc.id,
            code: acc.code,
            name: acc.name,
            amount: netRevenue.toFixed(2)
          });
          totalRevenue = totalRevenue.plus(netRevenue);
        }
      } else if (acc.type === "EXPENSE") {
        const netExpense = d.minus(c);
        if (!netExpense.isZero()) {
          const isCOGS = acc.systemKey === "COGS" || acc.code === "5001" || acc.name.toLowerCase().includes("cost of goods");
          if (isCOGS) {
            cogsRows.push({
              id: acc.id,
              code: acc.code,
              name: acc.name,
              amount: netExpense.toFixed(2)
            });
            totalCOGS = totalCOGS.plus(netExpense);
          } else {
            expenseRows.push({
              id: acc.id,
              code: acc.code,
              name: acc.name,
              amount: netExpense.toFixed(2)
            });
            totalExpenses = totalExpenses.plus(netExpense);
          }
        }
      }
    }

    const grossProfit = totalRevenue.minus(totalCOGS);
    const netProfit = grossProfit.minus(totalExpenses);

    return {
      period: {
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null
      },
      revenue: {
        accounts: revenueRows,
        total: totalRevenue.toFixed(2)
      },
      costOfGoodsSold: {
        accounts: cogsRows,
        total: totalCOGS.toFixed(2)
      },
      grossProfit: grossProfit.toFixed(2),
      operatingExpenses: {
        accounts: expenseRows,
        total: totalExpenses.toFixed(2)
      },
      netProfit: netProfit.toFixed(2)
    };
  }
}
