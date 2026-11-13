import { prisma } from "../../config/prisma.js";
import { Decimal, toDecimal } from "../../lib/money.js";

export class TaxReportService {
  static async getReport(companyId: string, startDateStr?: string, endDateStr?: string) {
    const startDate = startDateStr ? new Date(startDateStr) : null;
    const endDate = endDateStr ? new Date(endDateStr) : null;

    // 1. Invoices for Sales Tax (Output Tax)
    const invWhere: any = {
      companyId,
      status: { notIn: ["DRAFT", "VOID"] }
    };
    if (startDate || endDate) {
      invWhere.date = {};
      if (startDate) invWhere.date.gte = startDate;
      if (endDate) invWhere.date.lte = endDate;
    }

    const invoices = await prisma.invoice.findMany({
      where: invWhere,
      include: { items: true }
    });

    // 2. Bills for Input Tax
    const billWhere: any = {
      companyId,
      status: { notIn: ["DRAFT", "VOID"] }
    };
    if (startDate || endDate) {
      billWhere.date = {};
      if (startDate) billWhere.date.gte = startDate;
      if (endDate) billWhere.date.lte = endDate;
    }

    const bills = await prisma.bill.findMany({
      where: billWhere,
      include: { items: true }
    });

    // 3. Tax Rates map
    const taxRates = await prisma.taxRate.findMany({
      where: { companyId }
    });
    const taxRateMap = new Map<string, { name: string; percentage: Decimal }>();
    (taxRates as any[]).forEach((t: any) => taxRateMap.set(t.id, { name: t.name, percentage: toDecimal(t.percentage) }));

    let totalOutputTax = new Decimal(0);
    let totalTaxableSales = new Decimal(0);
    const outputTaxByRate = new Map<string, { name: string; rate: Decimal; taxable: Decimal; tax: Decimal }>();

    for (const inv of invoices as any[]) {
      totalOutputTax = totalOutputTax.plus(toDecimal(inv.taxTotal));
      totalTaxableSales = totalTaxableSales.plus(toDecimal(inv.subtotal));

      if (inv.items) {
        for (const it of inv.items) {
          const taxAmt = toDecimal(it.taxAmount);
          if (taxAmt.isZero()) continue;

          const rateKey = it.taxRateId || "STANDARD";
          const rateInfo = it.taxRateId ? taxRateMap.get(it.taxRateId) : null;
          const name = rateInfo?.name || "Standard Sales Tax";
          const pct = rateInfo?.percentage || new Decimal(18);

          const cur = outputTaxByRate.get(rateKey) || {
            name,
            rate: pct,
            taxable: new Decimal(0),
            tax: new Decimal(0)
          };
          cur.taxable = cur.taxable.plus(toDecimal(it.lineTotal));
          cur.tax = cur.tax.plus(taxAmt);
          outputTaxByRate.set(rateKey, cur);
        }
      }
    }

    let totalInputTax = new Decimal(0);
    let totalTaxablePurchases = new Decimal(0);
    const inputTaxByRate = new Map<string, { name: string; rate: Decimal; taxable: Decimal; tax: Decimal }>();

    for (const bill of bills as any[]) {
      totalInputTax = totalInputTax.plus(toDecimal(bill.taxTotal));
      totalTaxablePurchases = totalTaxablePurchases.plus(toDecimal(bill.subtotal));

      if (bill.items) {
        for (const it of bill.items) {
          const taxAmt = toDecimal(it.taxAmount);
          if (taxAmt.isZero()) continue;

          const rateKey = it.taxRateId || "STANDARD";
          const rateInfo = it.taxRateId ? taxRateMap.get(it.taxRateId) : null;
          const name = rateInfo?.name || "Standard Input Tax";
          const pct = rateInfo?.percentage || new Decimal(18);

          const cur = inputTaxByRate.get(rateKey) || {
            name,
            rate: pct,
            taxable: new Decimal(0),
            tax: new Decimal(0)
          };
          cur.taxable = cur.taxable.plus(toDecimal(it.lineTotal));
          cur.tax = cur.tax.plus(taxAmt);
          inputTaxByRate.set(rateKey, cur);
        }
      }
    }

    const netTaxPosition = totalOutputTax.minus(totalInputTax);

    return {
      period: {
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null
      },
      summary: {
        totalTaxableSales: totalTaxableSales.toFixed(2),
        outputTaxPayable: totalOutputTax.toFixed(2),
        totalTaxablePurchases: totalTaxablePurchases.toFixed(2),
        inputTaxReceivable: totalInputTax.toFixed(2),
        netTaxPosition: netTaxPosition.toFixed(2),
        status: netTaxPosition.greaterThan(0) ? "PAYABLE" : netTaxPosition.isZero() ? "BALANCED" : "REFUNDABLE"
      },
      outputTaxRates: Array.from(outputTaxByRate.values()).map((r) => ({
        rateName: r.name,
        percentage: r.rate.toFixed(2),
        taxableAmount: r.taxable.toFixed(2),
        taxAmount: r.tax.toFixed(2)
      })),
      inputTaxRates: Array.from(inputTaxByRate.values()).map((r) => ({
        rateName: r.name,
        percentage: r.rate.toFixed(2),
        taxableAmount: r.taxable.toFixed(2),
        taxAmount: r.tax.toFixed(2)
      }))
    };
  }
}
