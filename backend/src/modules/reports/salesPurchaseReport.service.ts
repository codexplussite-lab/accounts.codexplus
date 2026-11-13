import { prisma } from "../../config/prisma.js";
import { Decimal, toDecimal } from "../../lib/money.js";

export class SalesPurchaseReportService {
  /**
   * Sales Report: Customer-wise, Product-wise, Monthly breakdown
   */
  static async getSalesReport(
    companyId: string,
    startDateStr?: string,
    endDateStr?: string,
    customerId?: string,
    productId?: string
  ) {
    const startDate = startDateStr ? new Date(startDateStr) : null;
    const endDate = endDateStr ? new Date(endDateStr) : null;

    const whereClause: any = {
      companyId,
      status: { notIn: ["DRAFT", "VOID"] }
    };

    if (customerId) whereClause.contactId = customerId;
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = startDate;
      if (endDate) whereClause.date.lte = endDate;
    }

    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      include: {
        items: true
      },
      orderBy: { date: "asc" }
    });

    const contacts = await prisma.contact.findMany({
      where: { companyId }
    });
    const contactMap = new Map<string, string>();
    (contacts as any[]).forEach((c: any) => contactMap.set(c.id, c.name));

    const products = await prisma.product.findMany({
      where: { companyId }
    });
    const productMap = new Map<string, { name: string; sku: string }>();
    (products as any[]).forEach((p: any) => productMap.set(p.id, { name: p.name, sku: p.sku }));

    let grandSubtotal = new Decimal(0);
    let grandTax = new Decimal(0);
    let grandTotal = new Decimal(0);
    let grandPaid = new Decimal(0);

    // Customer aggregation
    const custMap = new Map<string, { count: number; subtotal: Decimal; tax: Decimal; total: Decimal; paid: Decimal }>();
    // Product aggregation
    const prodMap = new Map<string, { quantity: Decimal; revenue: Decimal }>();
    // Monthly aggregation
    const monthMap = new Map<string, { count: number; total: Decimal; tax: Decimal }>();

    for (const inv of invoices as any[]) {
      const sub = toDecimal(inv.subtotal);
      const tax = toDecimal(inv.taxTotal);
      const tot = toDecimal(inv.total);
      const paid = toDecimal(inv.paidAmount);

      grandSubtotal = grandSubtotal.plus(sub);
      grandTax = grandTax.plus(tax);
      grandTotal = grandTotal.plus(tot);
      grandPaid = grandPaid.plus(paid);

      // 1. Customer
      const custEntry = custMap.get(inv.contactId) || {
        count: 0,
        subtotal: new Decimal(0),
        tax: new Decimal(0),
        total: new Decimal(0),
        paid: new Decimal(0)
      };
      custEntry.count++;
      custEntry.subtotal = custEntry.subtotal.plus(sub);
      custEntry.tax = custEntry.tax.plus(tax);
      custEntry.total = custEntry.total.plus(tot);
      custEntry.paid = custEntry.paid.plus(paid);
      custMap.set(inv.contactId, custEntry);

      // 2. Month (YYYY-MM)
      const d = new Date(inv.date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthEntry = monthMap.get(monthKey) || { count: 0, total: new Decimal(0), tax: new Decimal(0) };
      monthEntry.count++;
      monthEntry.total = monthEntry.total.plus(tot);
      monthEntry.tax = monthEntry.tax.plus(tax);
      monthMap.set(monthKey, monthEntry);

      // 3. Products from items
      if (inv.items) {
        for (const item of inv.items) {
          if (!item.productId) continue;
          if (productId && item.productId !== productId) continue;

          const pEntry = prodMap.get(item.productId) || { quantity: new Decimal(0), revenue: new Decimal(0) };
          pEntry.quantity = pEntry.quantity.plus(toDecimal(item.quantity));
          pEntry.revenue = pEntry.revenue.plus(toDecimal(item.lineTotal));
          prodMap.set(item.productId, pEntry);
        }
      }
    }

    const customerSummary = Array.from(custMap.entries()).map(([cid, data]) => ({
      contactId: cid,
      customerName: contactMap.get(cid) || "Unknown Customer",
      invoiceCount: data.count,
      subtotal: data.subtotal.toFixed(2),
      taxTotal: data.tax.toFixed(2),
      total: data.total.toFixed(2),
      paidAmount: data.paid.toFixed(2),
      balanceDue: data.total.minus(data.paid).toFixed(2)
    }));

    const productSummary = Array.from(prodMap.entries()).map(([pid, data]) => {
      const prodInfo = productMap.get(pid);
      return {
        productId: pid,
        sku: prodInfo?.sku || "N/A",
        name: prodInfo?.name || "Unknown Product",
        quantitySold: data.quantity.toFixed(3),
        totalRevenue: data.revenue.toFixed(2)
      };
    });

    const monthlySummary = Array.from(monthMap.entries()).map(([month, data]) => ({
      month,
      invoiceCount: data.count,
      totalSales: data.total.toFixed(2),
      taxTotal: data.tax.toFixed(2)
    }));

    return {
      period: {
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null
      },
      summary: {
        totalInvoices: invoices.length,
        subtotal: grandSubtotal.toFixed(2),
        taxTotal: grandTax.toFixed(2),
        totalSales: grandTotal.toFixed(2),
        totalCollected: grandPaid.toFixed(2),
        outstandingReceivables: grandTotal.minus(grandPaid).toFixed(2)
      },
      byCustomer: customerSummary,
      byProduct: productSummary,
      monthly: monthlySummary
    };
  }

  /**
   * Purchase Report: Vendor-wise, Product-wise, Monthly breakdown
   */
  static async getPurchaseReport(
    companyId: string,
    startDateStr?: string,
    endDateStr?: string,
    vendorId?: string,
    productId?: string
  ) {
    const startDate = startDateStr ? new Date(startDateStr) : null;
    const endDate = endDateStr ? new Date(endDateStr) : null;

    const whereClause: any = {
      companyId,
      status: { notIn: ["DRAFT", "VOID"] }
    };

    if (vendorId) whereClause.contactId = vendorId;
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = startDate;
      if (endDate) whereClause.date.lte = endDate;
    }

    const bills = await prisma.bill.findMany({
      where: whereClause,
      include: {
        items: true
      },
      orderBy: { date: "asc" }
    });

    const contacts = await prisma.contact.findMany({
      where: { companyId }
    });
    const contactMap = new Map<string, string>();
    (contacts as any[]).forEach((c: any) => contactMap.set(c.id, c.name));

    const products = await prisma.product.findMany({
      where: { companyId }
    });
    const productMap = new Map<string, { name: string; sku: string }>();
    (products as any[]).forEach((p: any) => productMap.set(p.id, { name: p.name, sku: p.sku }));

    let grandSubtotal = new Decimal(0);
    let grandTax = new Decimal(0);
    let grandTotal = new Decimal(0);
    let grandPaid = new Decimal(0);

    const vendMap = new Map<string, { count: number; subtotal: Decimal; tax: Decimal; total: Decimal; paid: Decimal }>();
    const prodMap = new Map<string, { quantity: Decimal; spend: Decimal }>();
    const monthMap = new Map<string, { count: number; total: Decimal; tax: Decimal }>();

    for (const bill of bills as any[]) {
      const sub = toDecimal(bill.subtotal);
      const tax = toDecimal(bill.taxTotal);
      const tot = toDecimal(bill.total);
      const paid = toDecimal(bill.paidAmount);

      grandSubtotal = grandSubtotal.plus(sub);
      grandTax = grandTax.plus(tax);
      grandTotal = grandTotal.plus(tot);
      grandPaid = grandPaid.plus(paid);

      // 1. Vendor
      const vEntry = vendMap.get(bill.contactId) || {
        count: 0,
        subtotal: new Decimal(0),
        tax: new Decimal(0),
        total: new Decimal(0),
        paid: new Decimal(0)
      };
      vEntry.count++;
      vEntry.subtotal = vEntry.subtotal.plus(sub);
      vEntry.tax = vEntry.tax.plus(tax);
      vEntry.total = vEntry.total.plus(tot);
      vEntry.paid = vEntry.paid.plus(paid);
      vendMap.set(bill.contactId, vEntry);

      // 2. Month (YYYY-MM)
      const d = new Date(bill.date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthEntry = monthMap.get(monthKey) || { count: 0, total: new Decimal(0), tax: new Decimal(0) };
      monthEntry.count++;
      monthEntry.total = monthEntry.total.plus(tot);
      monthEntry.tax = monthEntry.tax.plus(tax);
      monthMap.set(monthKey, monthEntry);

      // 3. Products
      if (bill.items) {
        for (const item of bill.items) {
          if (!item.productId) continue;
          if (productId && item.productId !== productId) continue;

          const pEntry = prodMap.get(item.productId) || { quantity: new Decimal(0), spend: new Decimal(0) };
          pEntry.quantity = pEntry.quantity.plus(toDecimal(item.quantity));
          pEntry.spend = pEntry.spend.plus(toDecimal(item.lineTotal));
          prodMap.set(item.productId, pEntry);
        }
      }
    }

    const vendorSummary = Array.from(vendMap.entries()).map(([vid, data]) => ({
      contactId: vid,
      vendorName: contactMap.get(vid) || "Unknown Vendor",
      billCount: data.count,
      subtotal: data.subtotal.toFixed(2),
      taxTotal: data.tax.toFixed(2),
      total: data.total.toFixed(2),
      paidAmount: data.paid.toFixed(2),
      balanceDue: data.total.minus(data.paid).toFixed(2)
    }));

    const productSummary = Array.from(prodMap.entries()).map(([pid, data]) => {
      const prodInfo = productMap.get(pid);
      return {
        productId: pid,
        sku: prodInfo?.sku || "N/A",
        name: prodInfo?.name || "Unknown Product",
        quantityPurchased: data.quantity.toFixed(3),
        totalSpend: data.spend.toFixed(2)
      };
    });

    const monthlySummary = Array.from(monthMap.entries()).map(([month, data]) => ({
      month,
      billCount: data.count,
      totalPurchases: data.total.toFixed(2),
      taxTotal: data.tax.toFixed(2)
    }));

    return {
      period: {
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null
      },
      summary: {
        totalBills: bills.length,
        subtotal: grandSubtotal.toFixed(2),
        taxTotal: grandTax.toFixed(2),
        totalPurchases: grandTotal.toFixed(2),
        totalPaid: grandPaid.toFixed(2),
        outstandingPayables: grandTotal.minus(grandPaid).toFixed(2)
      },
      byVendor: vendorSummary,
      byProduct: productSummary,
      monthly: monthlySummary
    };
  }
}

