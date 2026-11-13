import { prisma } from "../../config/prisma.js";
import { Decimal, toDecimal } from "../../lib/money.js";

export class AgeingService {
  /**
   * Accounts Receivable (AR) Ageing Breakdown
   */
  static async getARAgeing(companyId: string, asOfDateStr?: string) {
    const asOfDate = asOfDateStr ? new Date(asOfDateStr) : new Date();

    const customers = await prisma.contact.findMany({
      where: { companyId, type: "CUSTOMER" },
      orderBy: { name: "asc" }
    });

    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        status: { in: ["POSTED", "PARTIALLY_PAID"] }
      }
    });

    let grandTotal = new Decimal(0);
    let grandCurrent = new Decimal(0);
    let grand0_30 = new Decimal(0);
    let grand31_60 = new Decimal(0);
    let grand61_90 = new Decimal(0);
    let grand90Plus = new Decimal(0);

    const customerRows: any[] = [];

    for (const customer of customers as any[]) {
      const custInvoices = (invoices as any[]).filter((i: any) => i.contactId === customer.id);

      let custTotal = new Decimal(0);
      let custCurrent = new Decimal(0);
      let cust0_30 = new Decimal(0);
      let cust31_60 = new Decimal(0);
      let cust61_90 = new Decimal(0);
      let cust90Plus = new Decimal(0);

      for (const inv of custInvoices) {
        const balanceDue = toDecimal(inv.total).minus(toDecimal(inv.paidAmount));
        if (balanceDue.isZero() || balanceDue.isNegative()) continue;

        const effectiveDate = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.date);
        const diffMs = asOfDate.getTime() - effectiveDate.getTime();
        const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        custTotal = custTotal.plus(balanceDue);

        if (daysOverdue <= 0) {
          custCurrent = custCurrent.plus(balanceDue);
        } else if (daysOverdue <= 30) {
          cust0_30 = cust0_30.plus(balanceDue);
        } else if (daysOverdue <= 60) {
          cust31_60 = cust31_60.plus(balanceDue);
        } else if (daysOverdue <= 90) {
          cust61_90 = cust61_90.plus(balanceDue);
        } else {
          cust90Plus = cust90Plus.plus(balanceDue);
        }
      }

      if (custTotal.greaterThan(0)) {
        grandTotal = grandTotal.plus(custTotal);
        grandCurrent = grandCurrent.plus(custCurrent);
        grand0_30 = grand0_30.plus(cust0_30);
        grand31_60 = grand31_60.plus(cust31_60);
        grand61_90 = grand61_90.plus(cust61_90);
        grand90Plus = grand90Plus.plus(cust90Plus);

        customerRows.push({
          contactId: customer.id,
          customerName: customer.name,
          phone: customer.phone,
          totalOutstanding: custTotal.toFixed(2),
          current: custCurrent.toFixed(2),
          days0_30: cust0_30.toFixed(2),
          days31_60: cust31_60.toFixed(2),
          days61_90: cust61_90.toFixed(2),
          days90Plus: cust90Plus.toFixed(2)
        });
      }
    }

    return {
      asOfDate: asOfDate.toISOString(),
      customers: customerRows,
      totals: {
        totalOutstanding: grandTotal.toFixed(2),
        current: grandCurrent.toFixed(2),
        days0_30: grand0_30.toFixed(2),
        days31_60: grand31_60.toFixed(2),
        days61_90: grand61_90.toFixed(2),
        days90Plus: grand90Plus.toFixed(2)
      }
    };
  }

  /**
   * Accounts Payable (AP) Ageing Breakdown
   */
  static async getAPAgeing(companyId: string, asOfDateStr?: string) {
    const asOfDate = asOfDateStr ? new Date(asOfDateStr) : new Date();

    const vendors = await prisma.contact.findMany({
      where: { companyId, type: "VENDOR" },
      orderBy: { name: "asc" }
    });

    const bills = await prisma.bill.findMany({
      where: {
        companyId,
        status: { in: ["POSTED", "PARTIALLY_PAID"] }
      }
    });

    let grandTotal = new Decimal(0);
    let grandCurrent = new Decimal(0);
    let grand0_30 = new Decimal(0);
    let grand31_60 = new Decimal(0);
    let grand61_90 = new Decimal(0);
    let grand90Plus = new Decimal(0);

    const vendorRows: any[] = [];

    for (const vendor of vendors as any[]) {
      const vendBills = (bills as any[]).filter((b: any) => b.contactId === vendor.id);

      let vendTotal = new Decimal(0);
      let vendCurrent = new Decimal(0);
      let vend0_30 = new Decimal(0);
      let vend31_60 = new Decimal(0);
      let vend61_90 = new Decimal(0);
      let vend90Plus = new Decimal(0);

      for (const b of vendBills) {
        const balanceDue = toDecimal(b.total).minus(toDecimal(b.paidAmount));
        if (balanceDue.isZero() || balanceDue.isNegative()) continue;

        const effectiveDate = b.dueDate ? new Date(b.dueDate) : new Date(b.date);
        const diffMs = asOfDate.getTime() - effectiveDate.getTime();
        const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        vendTotal = vendTotal.plus(balanceDue);

        if (daysOverdue <= 0) {
          vendCurrent = vendCurrent.plus(balanceDue);
        } else if (daysOverdue <= 30) {
          vend0_30 = vend0_30.plus(balanceDue);
        } else if (daysOverdue <= 60) {
          vend31_60 = vend31_60.plus(balanceDue);
        } else if (daysOverdue <= 90) {
          vend61_90 = vend61_90.plus(balanceDue);
        } else {
          vend90Plus = vend90Plus.plus(balanceDue);
        }
      }

      if (vendTotal.greaterThan(0)) {
        grandTotal = grandTotal.plus(vendTotal);
        grandCurrent = grandCurrent.plus(vendCurrent);
        grand0_30 = grand0_30.plus(vend0_30);
        grand31_60 = grand31_60.plus(vend31_60);
        grand61_90 = grand61_90.plus(vend61_90);
        grand90Plus = grand90Plus.plus(vend90Plus);

        vendorRows.push({
          contactId: vendor.id,
          vendorName: vendor.name,
          phone: vendor.phone,
          totalOutstanding: vendTotal.toFixed(2),
          current: vendCurrent.toFixed(2),
          days0_30: vend0_30.toFixed(2),
          days31_60: vend31_60.toFixed(2),
          days61_90: vend61_90.toFixed(2),
          days90Plus: vend90Plus.toFixed(2)
        });
      }
    }

    return {
      asOfDate: asOfDate.toISOString(),
      vendors: vendorRows,
      totals: {
        totalOutstanding: grandTotal.toFixed(2),
        current: grandCurrent.toFixed(2),
        days0_30: grand0_30.toFixed(2),
        days31_60: grand31_60.toFixed(2),
        days61_90: grand61_90.toFixed(2),
        days90Plus: grand90Plus.toFixed(2)
      }
    };
  }
}

