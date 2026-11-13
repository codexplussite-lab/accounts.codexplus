import { prisma } from "../../config/prisma.js";
import { Decimal, toDecimal, isEqual } from "../../lib/money.js";

export class TrialBalanceService {
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

    // Map lines by accountId
    const debitMap = new Map<string, Decimal>();
    const creditMap = new Map<string, Decimal>();

    for (const line of lines as any[]) {
      const d = toDecimal(line.debit);
      const c = toDecimal(line.credit);

      const curD = debitMap.get(line.accountId) || new Decimal(0);
      debitMap.set(line.accountId, curD.plus(d));

      const curC = creditMap.get(line.accountId) || new Decimal(0);
      creditMap.set(line.accountId, curC.plus(c));
    }

    let grandTotalDebit = new Decimal(0);
    let grandTotalCredit = new Decimal(0);

    const rows = (accounts as any[])
      .map((acc: any) => {
        const totalD = debitMap.get(acc.id) || new Decimal(0);
        const totalC = creditMap.get(acc.id) || new Decimal(0);

        // Standard trial balance displays the net debit or net credit balance per account
        let debitBalance = new Decimal(0);
        let creditBalance = new Decimal(0);

        if (totalD.greaterThan(totalC)) {
          debitBalance = totalD.minus(totalC);
        } else if (totalC.greaterThan(totalD)) {
          creditBalance = totalC.minus(totalD);
        }

        grandTotalDebit = grandTotalDebit.plus(debitBalance);
        grandTotalCredit = grandTotalCredit.plus(creditBalance);

        const isDebitNormal = acc.type === "ASSET" || acc.type === "EXPENSE";
        const netClosingBalance = isDebitNormal ? totalD.minus(totalC) : totalC.minus(totalD);

        return {
          accountId: acc.id,
          code: acc.code,
          name: acc.name,
          type: acc.type,
          systemKey: acc.systemKey,
          grossDebit: totalD.toFixed(2),
          grossCredit: totalC.toFixed(2),
          debit: debitBalance.toFixed(2),
          credit: creditBalance.toFixed(2),
          closingBalance: netClosingBalance.toFixed(2)
        };
      })
      .filter((r: any) => parseFloat(r.grossDebit) > 0 || parseFloat(r.grossCredit) > 0);

    const isBalanced = isEqual(grandTotalDebit, grandTotalCredit);
    const variance = grandTotalDebit.minus(grandTotalCredit).abs();

    return {
      asOfDate: asOfDate.toISOString(),
      accounts: rows,
      totalDebit: grandTotalDebit.toFixed(2),
      totalCredit: grandTotalCredit.toFixed(2),
      variance: variance.toFixed(2),
      isBalanced
    };
  }
}
