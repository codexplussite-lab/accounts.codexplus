import { Decimal } from "decimal.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createAuditLog } from "../../lib/audit.js";
import { getNextSequence } from "../../lib/sequence.js";
import { assertPeriodUnlocked } from "../../lib/periodLock.js";
import { postJournal } from "../../lib/posting.js";
import { generateDocumentPDF } from "../../lib/pdf.js";

export class PurchaseService {
  static async calculateTotals(companyId: string, items: any[]) {
    let subtotal = new Decimal(0);
    let taxTotal = new Decimal(0);

    const calculatedItems = await Promise.all(
      items.map(async (item: any) => {
        const qty = new Decimal(item.quantity || "1");
        const cost = new Decimal(item.unitCost || "0");
        const taxable = qty.times(cost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

        let taxAmount = new Decimal(0);
        if (item.taxRateId) {
          const taxRate = await prisma.taxRate.findFirst({
            where: { id: item.taxRateId, companyId }
          });
          if (taxRate && taxRate.isActive) {
            const pct = new Decimal(taxRate.percentage.toString()).dividedBy(100);
            taxAmount = taxable.times(pct).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
          }
        }

        const lineTotal = taxable.plus(taxAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

        subtotal = subtotal.plus(taxable);
        taxTotal = taxTotal.plus(taxAmount);

        return {
          productId: item.productId || null,
          accountId: item.accountId || null,
          quantity: qty,
          unitCost: cost,
          taxRateId: item.taxRateId || null,
          taxAmount,
          lineTotal
        };
      })
    );

    const total = subtotal.plus(taxTotal).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    return {
      subtotal: subtotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      taxTotal: taxTotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      total,
      calculatedItems
    };
  }

  static async listBills(companyId: string, query: any) {
    const { contactId, status, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (contactId) where.contactId = contactId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { number: { contains: search } },
        { vendorBillNo: { contains: search } }
      ];
    }

    const [totalCount, bills] = await Promise.all([
      prisma.bill.count({ where }),
      prisma.bill.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: "desc" },
        include: { items: true }
      })
    ]);

    const contactIds = [...new Set(bills.map((b: any) => b.contactId))];
    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds }, companyId }
    });
    const contactMap = new Map(contacts.map((c: any) => [c.id, c]));

    const data = bills.map((b: any) => {
      const contact = contactMap.get(b.contactId);
      const tot = new Decimal(b.total.toString());
      const paid = new Decimal(b.paidAmount.toString());
      const balance = tot.minus(paid);

      return {
        ...b,
        vendorName: contact?.name || "Unknown Vendor",
        subtotal: new Decimal(b.subtotal.toString()).toFixed(2),
        taxTotal: new Decimal(b.taxTotal.toString()).toFixed(2),
        total: tot.toFixed(2),
        paidAmount: paid.toFixed(2),
        balanceDue: balance.toFixed(2)
      };
    });

    return {
      data,
      meta: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  }

  static async getBillById(companyId: string, id: string) {
    const bill = await prisma.bill.findFirst({
      where: { id, companyId },
      include: { items: true }
    });

    if (!bill) {
      throw new AppError("Purchase bill not found", 404, "NOT_FOUND");
    }

    const contact = await prisma.contact.findFirst({
      where: { id: bill.contactId, companyId }
    });

    const payments = await prisma.payment.findMany({
      where: { billId: bill.id, companyId },
      orderBy: { date: "asc" }
    });

    const tot = new Decimal(bill.total.toString());
    const paid = new Decimal(bill.paidAmount.toString());
    const balance = tot.minus(paid);

    return {
      ...bill,
      contact,
      vendorName: contact?.name || "Unknown Vendor",
      subtotal: new Decimal(bill.subtotal.toString()).toFixed(2),
      taxTotal: new Decimal(bill.taxTotal.toString()).toFixed(2),
      total: tot.toFixed(2),
      paidAmount: paid.toFixed(2),
      balanceDue: balance.toFixed(2),
      items: bill.items.map((it: any) => ({
        ...it,
        quantity: new Decimal(it.quantity.toString()).toFixed(3),
        unitCost: new Decimal(it.unitCost.toString()).toFixed(2),
        taxAmount: new Decimal(it.taxAmount.toString()).toFixed(2),
        lineTotal: new Decimal(it.lineTotal.toString()).toFixed(2)
      })),
      payments: payments.map((p: any) => ({
        ...p,
        amount: new Decimal(p.amount.toString()).toFixed(2)
      }))
    };
  }

  static async createBill(companyId: string, userId: string, input: any) {
    const contact = await prisma.contact.findFirst({
      where: { id: input.contactId, companyId }
    });
    if (!contact) {
      throw new AppError("Selected vendor does not exist", 404, "CONTACT_NOT_FOUND");
    }

    const { subtotal, taxTotal, total, calculatedItems } = await PurchaseService.calculateTotals(companyId, input.items);
    const billDate = new Date(input.date);
    await assertPeriodUnlocked(prisma, companyId, billDate);

    const draftNumber = `DRAFT-BILL-${Date.now()}`;

    const bill = await prisma.bill.create({
      data: {
        companyId,
        number: draftNumber,
        vendorBillNo: input.vendorBillNo || null,
        contactId: input.contactId,
        date: billDate,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        status: "DRAFT",
        subtotal,
        taxTotal,
        total,
        paidAmount: new Decimal("0.00"),
        items: {
          create: calculatedItems
        }
      },
      include: { items: true }
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "Bill",
      objectId: bill.id,
      action: "CREATE",
      newData: bill
    });

    return PurchaseService.getBillById(companyId, bill.id);
  }

  static async updateBill(companyId: string, userId: string, id: string, input: any) {
    const existing = await prisma.bill.findFirst({
      where: { id, companyId },
      include: { items: true }
    });

    if (!existing) {
      throw new AppError("Bill not found", 404, "NOT_FOUND");
    }

    // Immutable rule: Posted/paid records cannot be edited
    if (existing.status !== "DRAFT") {
      throw new AppError("Posted financial records cannot be edited.", 403, "IMMUTABLE_RECORD");
    }

    let subtotal = existing.subtotal;
    let taxTotal = existing.taxTotal;
    let total = existing.total;
    let calculatedItems = null;

    if (input.items && input.items.length > 0) {
      const calc = await PurchaseService.calculateTotals(companyId, input.items);
      subtotal = calc.subtotal;
      taxTotal = calc.taxTotal;
      total = calc.total;
      calculatedItems = calc.calculatedItems;
    }

    const billDate = input.date ? new Date(input.date) : existing.date;
    await assertPeriodUnlocked(prisma, companyId, billDate);

    const updated = await prisma.$transaction(async (tx: any) => {
      if (calculatedItems) {
        await tx.billItem.deleteMany({ where: { billId: id } });
      }

      return tx.bill.update({
        where: { id },
        data: {
          contactId: input.contactId || existing.contactId,
          vendorBillNo: input.vendorBillNo !== undefined ? input.vendorBillNo : existing.vendorBillNo,
          date: billDate,
          dueDate: input.dueDate !== undefined ? (input.dueDate ? new Date(input.dueDate) : null) : existing.dueDate,
          subtotal,
          taxTotal,
          total,
          ...(calculatedItems && {
            items: {
              create: calculatedItems
            }
          })
        },
        include: { items: true }
      });
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "Bill",
      objectId: id,
      action: "UPDATE",
      oldData: existing,
      newData: updated
    });

    return PurchaseService.getBillById(companyId, id);
  }

  static async deleteBill(companyId: string, userId: string, id: string) {
    const existing = await prisma.bill.findFirst({
      where: { id, companyId }
    });

    if (!existing) {
      throw new AppError("Bill not found", 404, "NOT_FOUND");
    }

    if (existing.status !== "DRAFT") {
      throw new AppError("Posted financial records cannot be deleted.", 403, "IMMUTABLE_RECORD");
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.billItem.deleteMany({ where: { billId: id } });
      await tx.bill.delete({ where: { id } });
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "Bill",
      objectId: id,
      action: "DELETE",
      oldData: existing
    });

    return { success: true };
  }

  /**
   * Post Purchase Bill:
   * Dr Inventory (for stock items) or Dr Expense Account (for non-stock)
   * Dr Tax Receivable [taxTotal]
   * Cr Accounts Payable [total, contactId]
   * For stock items: + StockMovement(PURCHASE, +qty)
   * Recalculate Weighted Average Cost (WAC)
   */
  static async postBill(companyId: string, userId: string, id: string) {
    const bill = await prisma.bill.findFirst({
      where: { id, companyId },
      include: { items: true }
    });

    if (!bill) {
      throw new AppError("Bill not found", 404, "NOT_FOUND");
    }

    if (bill.status !== "DRAFT") {
      throw new AppError(`Bill is already ${bill.status}`, 422, "ALREADY_POSTED");
    }

    await assertPeriodUnlocked(prisma, companyId, bill.date);

    const contact = await prisma.contact.findFirst({
      where: { id: bill.contactId, companyId }
    });
    if (!contact) {
      throw new AppError("Vendor not found", 404, "CONTACT_NOT_FOUND");
    }

    const [warehouse, accounts] = await Promise.all([
      prisma.warehouse.findFirst({ where: { companyId, isDefault: true } }),
      prisma.account.findMany({
        where: {
          companyId,
          systemKey: { in: ["AP", "INVENTORY", "TAX_RECEIVABLE"] }
        }
      })
    ]);

    const apAcc = accounts.find((a: any) => a.systemKey === "AP");
    const invAcc = accounts.find((a: any) => a.systemKey === "INVENTORY");
    const taxRecAcc = accounts.find((a: any) => a.systemKey === "TAX_RECEIVABLE");

    if (!apAcc || !invAcc) {
      throw new AppError("System accounts for AP or Inventory missing in Chart of Accounts", 422, "ACCOUNTS_MISSING");
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Concurrency-safe sequence number
      const billNumber = await getNextSequence(tx, companyId, "BILL");

      const journalLines: any[] = [];
      let totalInventoryDebit = new Decimal(0);

      // Process items:
      for (const item of bill.items) {
        const itemQty = new Decimal(item.quantity.toString());
        const itemCost = new Decimal(item.unitCost.toString());
        const itemTaxable = itemQty.times(itemCost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

        if (item.productId) {
          const product = await tx.product.findFirst({
            where: { id: item.productId, companyId }
          });

          if (product) {
            totalInventoryDebit = totalInventoryDebit.plus(itemTaxable);

            if (product.trackStock) {
              // 1. StockMovement(PURCHASE)
              await tx.stockMovement.create({
                data: {
                  companyId,
                  productId: product.id,
                  warehouseId: warehouse ? warehouse.id : "default-warehouse",
                  quantity: itemQty, // positive
                  unitCost: itemCost,
                  type: "PURCHASE",
                  date: bill.date,
                  sourceType: "BILL",
                  sourceId: bill.id,
                  note: `Purchase via ${billNumber}`
                }
              });

              // 2. Weighted Average Cost Recalculation:
              const existingMovements = await tx.stockMovement.findMany({
                where: { productId: product.id, companyId, id: { not: undefined } }
              });
              // current stock before this movement:
              const currentStock = existingMovements.reduce((sum: Decimal, m: any) => {
                // exclude current created movement from historical stock calculation
                if (m.sourceType === "BILL" && m.sourceId === bill.id) return sum;
                return sum.plus(new Decimal(m.quantity.toString()));
              }, new Decimal(0));

              const oldCost = new Decimal(product.costPrice.toString());
              let newCost = itemCost;

              if (currentStock.greaterThan(0)) {
                const totalStockAfter = currentStock.plus(itemQty);
                const totalValuation = currentStock.times(oldCost).plus(itemQty.times(itemCost));
                newCost = totalValuation.dividedBy(totalStockAfter).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
              }

              await tx.product.update({
                where: { id: product.id },
                data: { costPrice: newCost }
              });
            }
          }
        } else if (item.accountId) {
          // Direct expense account line
          journalLines.push({
            accountId: item.accountId,
            debit: itemTaxable.toFixed(2),
            credit: "0.00",
            memo: `Bill ${billNumber} expense`
          });
        }
      }

      if (totalInventoryDebit.greaterThan(0)) {
        journalLines.push({
          accountId: invAcc.id,
          debit: totalInventoryDebit.toFixed(2),
          credit: "0.00",
          memo: `Inventory purchase ${billNumber}`
        });
      }

      const taxTot = new Decimal(bill.taxTotal.toString());
      if (taxTot.greaterThan(0)) {
        if (!taxRecAcc) {
          throw new AppError("Tax Receivable account missing in Chart of Accounts", 422, "TAX_ACCOUNT_MISSING");
        }
        journalLines.push({
          accountId: taxRecAcc.id,
          debit: taxTot.toFixed(2),
          credit: "0.00",
          memo: `Input tax on ${billNumber}`
        });
      }

      // Cr Accounts Payable (total)
      journalLines.push({
        accountId: apAcc.id,
        contactId: bill.contactId,
        debit: "0.00",
        credit: bill.total.toString(),
        memo: `Bill ${billNumber}`
      });

      // Post Balanced Journal
      await postJournal(tx, {
        companyId,
        date: bill.date,
        narration: `Purchase Bill ${billNumber} from ${contact.name}`,
        sourceType: "BILL",
        sourceId: bill.id,
        createdById: userId,
        lines: journalLines
      });

      // Update bill
      const updatedBill = await tx.bill.update({
        where: { id: bill.id },
        data: {
          number: billNumber,
          status: "POSTED"
        }
      });

      await createAuditLog(tx, {
        companyId,
        userId,
        model: "Bill",
        objectId: bill.id,
        action: "POST",
        oldData: bill,
        newData: updatedBill
      });

      return updatedBill;
    });

    return PurchaseService.getBillById(companyId, id);
  }

  static async voidBill(companyId: string, userId: string, id: string, reason?: string) {
    const bill = await prisma.bill.findFirst({
      where: { id, companyId },
      include: { items: true }
    });

    if (!bill) {
      throw new AppError("Bill not found", 404, "NOT_FOUND");
    }

    if (bill.status === "VOID") {
      throw new AppError("Bill is already void", 422, "ALREADY_VOID");
    }

    if (bill.status === "DRAFT") {
      return prisma.bill.update({
        where: { id },
        data: { status: "VOID" }
      });
    }

    const paid = new Decimal(bill.paidAmount.toString());
    if (paid.greaterThan(0)) {
      throw new AppError("Cannot void a bill with recorded payments. Reverse payments first.", 422, "PAYMENTS_EXIST");
    }

    await assertPeriodUnlocked(prisma, companyId, new Date());

    const result = await prisma.$transaction(async (tx: any) => {
      const originalEntry = await tx.journalEntry.findFirst({
        where: {
          companyId,
          sourceType: "BILL",
          sourceId: bill.id,
          status: "POSTED"
        },
        include: { lines: true }
      });

      if (originalEntry) {
        const reversalLines = originalEntry.lines.map((l: any) => ({
          accountId: l.accountId,
          contactId: l.contactId,
          debit: l.credit.toString(),
          credit: l.debit.toString(),
          memo: `Reversal of ${originalEntry.number}: ${reason || "Voided bill"}`
        }));

        await postJournal(tx, {
          companyId,
          date: new Date(),
          narration: `Void Reversal for Bill ${bill.number}`,
          sourceType: "REVERSAL",
          sourceId: bill.id,
          createdById: userId,
          lines: reversalLines
        });

        await tx.journalEntry.update({
          where: { id: originalEntry.id },
          data: { status: "REVERSED" }
        });
      }

      // Reversal stock movements
      const movements = await tx.stockMovement.findMany({
        where: {
          companyId,
          sourceType: "BILL",
          sourceId: bill.id
        }
      });

      for (const m of movements) {
        const qty = new Decimal(m.quantity.toString());
        await tx.stockMovement.create({
          data: {
            companyId,
            productId: m.productId,
            warehouseId: m.warehouseId,
            quantity: qty.negated(),
            unitCost: m.unitCost,
            type: "TRANSFER_OUT",
            date: new Date(),
            sourceType: "BILL_VOID",
            sourceId: bill.id,
            note: `Stock deduction on voiding ${bill.number}`
          }
        });
      }

      const updated = await tx.bill.update({
        where: { id },
        data: { status: "VOID" }
      });

      await createAuditLog(tx, {
        companyId,
        userId,
        model: "Bill",
        objectId: id,
        action: "VOID",
        oldData: bill,
        newData: updated
      });

      return updated;
    });

    return PurchaseService.getBillById(companyId, id);
  }

  static async generateBillPDF(companyId: string, id: string): Promise<Buffer> {
    const bill = await PurchaseService.getBillById(companyId, id);
    const company = await prisma.company.findUnique({ where: { id: companyId } });

    return generateDocumentPDF({
      title: "PURCHASE BILL",
      documentNumber: bill.number,
      date: new Date(bill.date).toLocaleDateString(),
      dueDate: bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : undefined,
      status: bill.status,
      company: {
        name: company?.name || "Accounting ERP",
        ntn: company?.ntn,
        address: company?.address,
        currency: company?.currency || "PKR"
      },
      contact: {
        name: bill.contact?.name || "Vendor",
        type: "VENDOR",
        ntn: bill.contact?.ntn,
        address: bill.contact?.address,
        phone: bill.contact?.phone,
        email: bill.contact?.email
      },
      items: bill.items.map((it: any) => ({
        description: it.productId ? `Product (${it.productId})` : `Expense Line (${it.accountId})`,
        quantity: it.quantity,
        unitPrice: it.unitCost,
        taxAmount: it.taxAmount,
        lineTotal: it.lineTotal
      })),
      subtotal: bill.subtotal,
      taxTotal: bill.taxTotal,
      total: bill.total,
      paidAmount: bill.paidAmount,
      balanceDue: bill.balanceDue,
      notes: bill.vendorBillNo ? `Vendor Bill Ref: ${bill.vendorBillNo}` : null
    });
  }
}
