import { Decimal } from "decimal.js";
import { AccountType, DocStatus, EntryStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { toDecimal, sumDecimals } from "../../lib/money.js";

export class DashboardService {
  /**
   * Generates real-time financial telemetry calculated from actual company ledger records.
   * Zero fake numbers guaranteed.
   */
  static async getOverview(companyId: string) {
    // 1. Fetch Accounts for Key Balances (Cash: 1001, Bank: 1002, AR: 1100, AP: 2001)
    const keyAccounts = await prisma.account.findMany({
      where: {
        companyId,
        code: { in: ["1001", "1002", "1100", "2001"] }
      }
    });

    const accountMap = new Map(keyAccounts.map((a) => [a.code, a.id]));
    const keyAccountIds = keyAccounts.map((a) => a.id);

    // 2. Aggregate journal lines for key accounts
    const keyLines = await prisma.journalLine.findMany({
      where: {
        accountId: { in: keyAccountIds },
        entry: {
          companyId,
          status: EntryStatus.POSTED
        }
      },
      select: {
        accountId: true,
        debit: true,
        credit: true
      }
    });

    const balanceByAccId = new Map<string, Decimal>();
    for (const line of keyLines) {
      const cur = balanceByAccId.get(line.accountId) || new Decimal(0);
      balanceByAccId.set(line.accountId, cur.plus(toDecimal(line.debit)).minus(toDecimal(line.credit)));
    }

    const cashId = accountMap.get("1001");
    const bankId = accountMap.get("1002");
    const arId = accountMap.get("1100");
    const apId = accountMap.get("2001");

    const totalCash = cashId ? balanceByAccId.get(cashId) || new Decimal(0) : new Decimal(0);
    const totalBank = bankId ? balanceByAccId.get(bankId) || new Decimal(0) : new Decimal(0);
    const totalAR = arId ? balanceByAccId.get(arId) || new Decimal(0) : new Decimal(0);
    // Liability AP normal balance is Credit - Debit
    const apRaw = apId ? balanceByAccId.get(apId) || new Decimal(0) : new Decimal(0);
    const totalAP = apRaw.negated();

    // 3. Compute Total Revenue (Income) and Total Expenses
    const pnlAccounts = await prisma.account.findMany({
      where: {
        companyId,
        type: { in: [AccountType.INCOME, AccountType.EXPENSE] }
      },
      select: { id: true, type: true }
    });

    const pnlAccountIds = pnlAccounts.map((a) => a.id);
    const pnlLines = await prisma.journalLine.findMany({
      where: {
        accountId: { in: pnlAccountIds },
        entry: {
          companyId,
          status: EntryStatus.POSTED
        }
      },
      include: {
        entry: true
      }
    });

    const incomeAccountIds = new Set(pnlAccounts.filter((a) => a.type === AccountType.INCOME).map((a) => a.id));

    let totalSales = new Decimal(0);
    let totalExpenses = new Decimal(0);

    // Monthly breakdown map (key: YYYY-MM)
    const monthlyDataMap = new Map<string, { sales: Decimal; expenses: Decimal }>();

    for (const line of pnlLines) {
      const debit = toDecimal(line.debit);
      const credit = toDecimal(line.credit);
      const dateKey = line.entry?.date ? new Date(line.entry.date).toISOString().substring(0, 7) : "2026-01";

      const monthCur = monthlyDataMap.get(dateKey) || { sales: new Decimal(0), expenses: new Decimal(0) };

      if (incomeAccountIds.has(line.accountId)) {
        // Income = credit - debit
        const inc = credit.minus(debit);
        totalSales = totalSales.plus(inc);
        monthCur.sales = monthCur.sales.plus(inc);
      } else {
        // Expense = debit - credit
        const exp = debit.minus(credit);
        totalExpenses = totalExpenses.plus(exp);
        monthCur.expenses = monthCur.expenses.plus(exp);
      }

      monthlyDataMap.set(dateKey, monthCur);
    }

    const netProfit = totalSales.minus(totalExpenses);

    // Format monthly trend sorted chronologically
    const sortedMonths = Array.from(monthlyDataMap.keys()).sort();
    const monthlyTrends = sortedMonths.map((m) => {
      const item = monthlyDataMap.get(m)!;
      return {
        month: m,
        sales: item.sales.toFixed(2),
        expenses: item.expenses.toFixed(2),
        net: item.sales.minus(item.expenses).toFixed(2)
      };
    });

    // 4. Inventory Health (derived stock quantities from StockMovement)
    const products = await prisma.product.findMany({
      where: { companyId, trackStock: true }
    });

    const stockMovements = await prisma.stockMovement.findMany({
      where: { companyId }
    });

    const productStockMap = new Map<string, Decimal>();
    for (const mov of stockMovements) {
      const cur = productStockMap.get(mov.productId) || new Decimal(0);
      productStockMap.set(mov.productId, cur.plus(toDecimal(mov.quantity)));
    }

    let lowStockCount = 0;
    let outOfStockCount = 0;
    const deficitProducts: { id: string; name: string; sku: string; stock: string; reorderLevel: string }[] = [];

    for (const p of products) {
      const stock = productStockMap.get(p.id) || new Decimal(0);
      const reorderLevel = toDecimal(p.reorderLevel);

      if (stock.lessThanOrEqualTo(0)) {
        outOfStockCount++;
        deficitProducts.push({
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock: stock.toFixed(3),
          reorderLevel: reorderLevel.toFixed(3)
        });
      } else if (stock.lessThanOrEqualTo(reorderLevel)) {
        lowStockCount++;
        deficitProducts.push({
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock: stock.toFixed(3),
          reorderLevel: reorderLevel.toFixed(3)
        });
      }
    }

    // 5. Top 5 Customers by Billed Revenue
    const postedInvoices = await prisma.invoice.findMany({
      where: {
        companyId,
        status: { in: [DocStatus.POSTED, DocStatus.PARTIALLY_PAID, DocStatus.PAID] }
      }
    });

    const customerSpendMap = new Map<string, Decimal>();
    for (const inv of postedInvoices) {
      const cur = customerSpendMap.get(inv.contactId) || new Decimal(0);
      customerSpendMap.set(inv.contactId, cur.plus(toDecimal(inv.total)));
    }

    const customerIds = Array.from(customerSpendMap.keys());
    const contacts = customerIds.length > 0
      ? await prisma.contact.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, name: true, email: true }
        })
      : [];

    const contactNameMap = new Map(contacts.map((c) => [c.id, c.name]));

    const topCustomers = customerIds
      .map((cId) => ({
        id: cId,
        name: contactNameMap.get(cId) || "Customer",
        totalRevenue: customerSpendMap.get(cId)!.toFixed(2)
      }))
      .sort((a, b) => Number(b.totalRevenue) - Number(a.totalRevenue))
      .slice(0, 5);

    // 6. Recent Invoices (latest 5)
    const recentInvoices = await prisma.invoice.findMany({
      where: { companyId },
      orderBy: { date: "desc" },
      take: 5
    });

    // 7. Recent Payments (latest 5)
    const recentPayments = await prisma.payment.findMany({
      where: { companyId },
      orderBy: { date: "desc" },
      take: 5
    });

    // 8. Recent Journal Entries (latest 5)
    const recentEntries = await prisma.journalEntry.findMany({
      where: { companyId, status: EntryStatus.POSTED },
      orderBy: { date: "desc" },
      take: 5
    });

    return {
      balances: {
        cash: totalCash.toFixed(2),
        bank: totalBank.toFixed(2),
        accountsReceivable: totalAR.toFixed(2),
        accountsPayable: totalAP.toFixed(2)
      },
      pnl: {
        totalSales: totalSales.toFixed(2),
        totalExpenses: totalExpenses.toFixed(2),
        netProfit: netProfit.toFixed(2),
        profitMargin: totalSales.isZero() ? "0.0%" : `${netProfit.dividedBy(totalSales).times(100).toFixed(1)}%`
      },
      monthlyTrends: monthlyTrends.length > 0 ? monthlyTrends : [
        { month: "2026-01", sales: totalSales.toFixed(2), expenses: totalExpenses.toFixed(2), net: netProfit.toFixed(2) }
      ],
      inventoryHealth: {
        totalTrackedProducts: products.length,
        lowStockCount,
        outOfStockCount,
        deficitProducts: deficitProducts.slice(0, 5)
      },
      topCustomers,
      recentActivity: {
        invoices: recentInvoices.map((inv) => ({
          id: inv.id,
          number: inv.number,
          date: inv.date,
          total: toDecimal(inv.total).toFixed(2),
          status: inv.status
        })),
        payments: recentPayments.map((p) => ({
          id: p.id,
          number: p.number,
          date: p.date,
          amount: toDecimal(p.amount).toFixed(2),
          type: p.type
        })),
        transactions: recentEntries.map((e) => ({
          id: e.id,
          number: e.number,
          date: e.date,
          narration: e.narration,
          sourceType: e.sourceType
        }))
      }
    };
  }
}
