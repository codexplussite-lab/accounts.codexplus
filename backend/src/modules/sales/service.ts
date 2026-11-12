import { Decimal } from "decimal.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createAuditLog } from "../../lib/audit.js";
import { getNextSequence } from "../../lib/sequence.js";
import { assertPeriodUnlocked } from "../../lib/periodLock.js";
import { postJournal } from "../../lib/posting.js";
import { generateDocumentPDF } from "../../lib/pdf.js";

export class SalesService {
  /**
   * Recalculate line totals and document totals strictly on the backend.
   */
  static async calculateTotals(companyId: string, items: any[]) {
    let subtotal = new Decimal(0);
    let taxTotal = new Decimal(0);

    const calculatedItems = await Promise.all(
      items.map(async (item: any) => {
        const qty = new Decimal(item.quantity || "1");
        const price = new Decimal(item.unitPrice || "0");
        const discount = new Decimal(item.discount || "0");

        const gross = qty.times(price);
        const taxable = Decimal.max(0, gross.minus(discount));

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
          description: item.description || null,
          quantity: qty,
          unitPrice: price,
          discount,
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

  static async listInvoices(companyId: string, query: any) {
    const { contactId, status, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (contactId) where.contactId = contactId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { number: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } }
      ];
    }

    const [totalCount, invoices] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: "desc" },
        include: {
          items: true
        }
      })
    ]);

    // Attach customer names
    const contactIds = [...new Set(invoices.map((i: any) => i.contactId))];
    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds }, companyId }
    });
    const contactMap = new Map(contacts.map((c: any) => [c.id, c]));

    const data = invoices.map((inv: any) => {
      const contact = contactMap.get(inv.contactId);
      const tot = new Decimal(inv.total.toString());
      const paid = new Decimal(inv.paidAmount.toString());
      const balance = tot.minus(paid);

      return {
        ...inv,
        customerName: contact?.name || "Unknown Customer",
        subtotal: new Decimal(inv.subtotal.toString()).toFixed(2),
        taxTotal: new Decimal(inv.taxTotal.toString()).toFixed(2),
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

  static async getInvoiceById(companyId: string, id: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id, companyId },
      include: {
        items: true
      }
    });

    if (!invoice) {
      throw new AppError("Invoice not found", 404, "NOT_FOUND");
    }

    const contact = await prisma.contact.findFirst({
      where: { id: invoice.contactId, companyId }
    });

    // Find linked payments
    const payments = await prisma.payment.findMany({
      where: { invoiceId: invoice.id, companyId },
      orderBy: { date: "asc" }
    });

    const tot = new Decimal(invoice.total.toString());
    const paid = new Decimal(invoice.paidAmount.toString());
    const balance = tot.minus(paid);

    return {
      ...invoice,
      contact,
      customerName: contact?.name || "Unknown Customer",
      subtotal: new Decimal(invoice.subtotal.toString()).toFixed(2),
      taxTotal: new Decimal(invoice.taxTotal.toString()).toFixed(2),
      total: tot.toFixed(2),
      paidAmount: paid.toFixed(2),
      balanceDue: balance.toFixed(2),
      items: invoice.items.map((it: any) => ({
        ...it,
        quantity: new Decimal(it.quantity.toString()).toFixed(3),
        unitPrice: new Decimal(it.unitPrice.toString()).toFixed(2),
        discount: new Decimal(it.discount.toString()).toFixed(2),
        taxAmount: new Decimal(it.taxAmount.toString()).toFixed(2),
        lineTotal: new Decimal(it.lineTotal.toString()).toFixed(2)
      })),
      payments: payments.map((p: any) => ({
        ...p,
        amount: new Decimal(p.amount.toString()).toFixed(2)
      }))
    };
  }

  static async createInvoice(companyId: string, userId: string, input: any) {
    const contact = await prisma.contact.findFirst({
      where: { id: input.contactId, companyId }
    });
    if (!contact) {
      throw new AppError("Selected customer does not exist", 404, "CONTACT_NOT_FOUND");
    }

    const { subtotal, taxTotal, total, calculatedItems } = await SalesService.calculateTotals(companyId, input.items);

    const invoiceDate = new Date(input.date);
    await assertPeriodUnlocked(prisma, companyId, invoiceDate);

    // Initial draft number
    const draftNumber = `DRAFT-${Date.now()}`;

    const invoice = await prisma.invoice.create({
      data: {
        companyId,
        number: draftNumber,
        contactId: input.contactId,
        date: invoiceDate,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        status: "DRAFT",
        subtotal,
        taxTotal,
        total,
        paidAmount: new Decimal("0.00"),
        notes: input.notes || null,
        items: {
          create: calculatedItems
        }
      },
      include: {
        items: true
      }
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "Invoice",
      objectId: invoice.id,
      action: "CREATE",
      newData: invoice
    });

    return SalesService.getInvoiceById(companyId, invoice.id);
  }

  static async updateInvoice(companyId: string, userId: string, id: string, input: any) {
    const existing = await prisma.invoice.findFirst({
      where: { id, companyId },
      include: { items: true }
    });

    if (!existing) {
      throw new AppError("Invoice not found", 404, "NOT_FOUND");
    }

    // Immutable rule: Posted/paid records can NEVER be edited
    if (existing.status !== "DRAFT") {
      throw new AppError("Posted financial records cannot be edited. Use credit notes or reversals.", 403, "IMMUTABLE_RECORD");
    }

    let subtotal = existing.subtotal;
    let taxTotal = existing.taxTotal;
    let total = existing.total;
    let calculatedItems = null;

    if (input.items && input.items.length > 0) {
      const calc = await SalesService.calculateTotals(companyId, input.items);
      subtotal = calc.subtotal;
      taxTotal = calc.taxTotal;
      total = calc.total;
      calculatedItems = calc.calculatedItems;
    }

    const invoiceDate = input.date ? new Date(input.date) : existing.date;
    await assertPeriodUnlocked(prisma, companyId, invoiceDate);

    const updated = await prisma.$transaction(async (tx: any) => {
      if (calculatedItems) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      }

      return tx.invoice.update({
        where: { id },
        data: {
          contactId: input.contactId || existing.contactId,
          date: invoiceDate,
          dueDate: input.dueDate !== undefined ? (input.dueDate ? new Date(input.dueDate) : null) : existing.dueDate,
          notes: input.notes !== undefined ? input.notes : existing.notes,
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
      model: "Invoice",
      objectId: id,
      action: "UPDATE",
      oldData: existing,
      newData: updated
    });

    return SalesService.getInvoiceById(companyId, id);
  }

  static async deleteInvoice(companyId: string, userId: string, id: string) {
    const existing = await prisma.invoice.findFirst({
      where: { id, companyId }
    });

    if (!existing) {
      throw new AppError("Invoice not found", 404, "NOT_FOUND");
    }

    // Immutable rule: Only DRAFT can be deleted
    if (existing.status !== "DRAFT") {
      throw new AppError("Posted financial records cannot be deleted. Use void or credit notes.", 403, "IMMUTABLE_RECORD");
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.delete({ where: { id } });
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "Invoice",
      objectId: id,
      action: "DELETE",
      oldData: existing
    });

    return { success: true };
  }

  /**
   * Post an invoice to the General Ledger and Stock movements.
   * Atomic double-entry recipe:
   * Dr Accounts Receivable [total]
   * Cr Sales [subtotal]
   * Cr Sales Tax Payable [taxTotal]
   * If stock items:
   * Dr Cost of Goods Sold [qty * costPrice]
   * Cr Inventory [qty * costPrice]
   * + StockMovement(SALE, -qty)
   */
  static async postInvoice(companyId: string, userId: string, id: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id, companyId },
      include: { items: true }
    });

    if (!invoice) {
      throw new AppError("Invoice not found", 404, "NOT_FOUND");
    }

    if (invoice.status !== "DRAFT") {
      throw new AppError(`Invoice is already ${invoice.status}`, 422, "ALREADY_POSTED");
    }

    await assertPeriodUnlocked(prisma, companyId, invoice.date);

    const contact = await prisma.contact.findFirst({
      where: { id: invoice.contactId, companyId }
    });
    if (!contact) {
      throw new AppError("Invoice contact not found", 404, "CONTACT_NOT_FOUND");
    }

    // Fetch default warehouse and system accounts
    const [warehouse, accounts, company] = await Promise.all([
      prisma.warehouse.findFirst({ where: { companyId, isDefault: true } }),
      prisma.account.findMany({
        where: {
          companyId,
          systemKey: { in: ["AR", "SALES", "SALES_TAX_PAYABLE", "COGS", "INVENTORY"] }
        }
      }),
      prisma.company.findUnique({ where: { id: companyId } })
    ]);

    const arAcc = accounts.find((a: any) => a.systemKey === "AR");
    const salesAcc = accounts.find((a: any) => a.systemKey === "SALES");
    const taxAcc = accounts.find((a: any) => a.systemKey === "SALES_TAX_PAYABLE");
    const cogsAcc = accounts.find((a: any) => a.systemKey === "COGS");
    const invAcc = accounts.find((a: any) => a.systemKey === "INVENTORY");

    if (!arAcc || !salesAcc) {
      throw new AppError("System accounts for AR or Sales missing. Verify Chart of Accounts.", 422, "ACCOUNTS_MISSING");
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Generate concurrency-safe sequential invoice number
      const invoiceNumber = await getNextSequence(tx, companyId, "INV");

      // 2. Prepare Double-Entry Journal Lines
      const journalLines: any[] = [
        {
          accountId: arAcc.id,
          contactId: invoice.contactId,
          debit: invoice.total.toString(),
          credit: "0.00",
          memo: `Invoice ${invoiceNumber}`
        },
        {
          accountId: salesAcc.id,
          debit: "0.00",
          credit: invoice.subtotal.toString(),
          memo: `Sales revenue for ${invoiceNumber}`
        }
      ];

      const taxTot = new Decimal(invoice.taxTotal.toString());
      if (taxTot.greaterThan(0)) {
        if (!taxAcc) {
          throw new AppError("Sales Tax Payable account missing in Chart of Accounts", 422, "TAX_ACCOUNT_MISSING");
        }
        journalLines.push({
          accountId: taxAcc.id,
          debit: "0.00",
          credit: taxTot.toFixed(2),
          memo: `Sales tax for ${invoiceNumber}`
        });
      }

      // 3. Process inventory items and stock movements
      for (const item of invoice.items) {
        if (item.productId) {
          const product = await tx.product.findFirst({
            where: { id: item.productId, companyId }
          });

          if (product && product.trackStock) {
            const itemQty = new Decimal(item.quantity.toString());

            // Check stock availability if negative stock not allowed
            if (company && !company.allowNegativeStock) {
              const currentMovements = await tx.stockMovement.findMany({
                where: { productId: product.id, companyId }
              });
              const currentStock = currentMovements.reduce(
                (sum: Decimal, m: any) => sum.plus(new Decimal(m.quantity.toString())),
                new Decimal(0)
              );

              if (currentStock.lessThan(itemQty)) {
                throw new AppError(
                  `Insufficient stock for '${product.name}'. Available: ${currentStock.toFixed(3)}, Required: ${itemQty.toFixed(3)}`,
                  422,
                  "INSUFFICIENT_STOCK"
                );
              }
            }

            // COGS & Inventory journal line
            const unitCost = new Decimal(product.costPrice.toString());
            const cogsAmount = itemQty.times(unitCost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

            if (cogsAmount.greaterThan(0) && cogsAcc && invAcc) {
              journalLines.push({
                accountId: cogsAcc.id,
                debit: cogsAmount.toFixed(2),
                credit: "0.00",
                memo: `COGS: ${product.name} (${invoiceNumber})`
              });
              journalLines.push({
                accountId: invAcc.id,
                debit: "0.00",
                credit: cogsAmount.toFixed(2),
                memo: `Inventory reduction: ${product.name} (${invoiceNumber})`
              });
            }

            // Create StockMovement record
            await tx.stockMovement.create({
              data: {
                companyId,
                productId: product.id,
                warehouseId: warehouse ? warehouse.id : "default-warehouse",
                quantity: itemQty.negated(),
                unitCost,
                type: "SALE",
                date: invoice.date,
                sourceType: "INVOICE",
                sourceId: invoice.id,
                note: `Sale via ${invoiceNumber}`
              }
            });
          }
        }
      }

      // 4. Post Balanced Journal Entry
      const entry = await postJournal(tx, {
        companyId,
        date: invoice.date,
        narration: `Invoice ${invoiceNumber} to ${contact.name}`,
        sourceType: "INVOICE",
        sourceId: invoice.id,
        createdById: userId,
        lines: journalLines
      });

      // 5. Update Invoice status & number
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          number: invoiceNumber,
          status: "POSTED"
        }
      });

      // 6. Audit Log
      await createAuditLog(tx, {
        companyId,
        userId,
        model: "Invoice",
        objectId: invoice.id,
        action: "POST",
        oldData: invoice,
        newData: updatedInvoice
      });

      return { updatedInvoice, entry };
    });

    return SalesService.getInvoiceById(companyId, id);
  }

  /**
   * Reversal-based voiding of a posted invoice.
   * Posted financial records cannot be deleted; voiding reverses journal entries & stock.
   */
  static async voidInvoice(companyId: string, userId: string, id: string, reason?: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id, companyId },
      include: { items: true }
    });

    if (!invoice) {
      throw new AppError("Invoice not found", 404, "NOT_FOUND");
    }

    if (invoice.status === "VOID") {
      throw new AppError("Invoice is already void", 422, "ALREADY_VOID");
    }

    if (invoice.status === "DRAFT") {
      // Drafts can be marked void directly
      const updated = await prisma.invoice.update({
        where: { id },
        data: { status: "VOID" }
      });
      return updated;
    }

    // If payments exist, forbid voiding until payments are removed
    const paid = new Decimal(invoice.paidAmount.toString());
    if (paid.greaterThan(0)) {
      throw new AppError("Cannot void an invoice with recorded payments. Reverse payments first.", 422, "PAYMENTS_EXIST");
    }

    await assertPeriodUnlocked(prisma, companyId, new Date());

    const result = await prisma.$transaction(async (tx: any) => {
      // Find original journal entry
      const originalEntry = await tx.journalEntry.findFirst({
        where: {
          companyId,
          sourceType: "INVOICE",
          sourceId: invoice.id,
          status: "POSTED"
        },
        include: { lines: true }
      });

      if (originalEntry) {
        // Reversal lines: invert debits and credits
        const reversalLines = originalEntry.lines.map((l: any) => ({
          accountId: l.accountId,
          contactId: l.contactId,
          debit: l.credit.toString(),
          credit: l.debit.toString(),
          memo: `Reversal of ${originalEntry.number}: ${reason || "Voided invoice"}`
        }));

        await postJournal(tx, {
          companyId,
          date: new Date(),
          narration: `Void Reversal for Invoice ${invoice.number}`,
          sourceType: "REVERSAL",
          sourceId: invoice.id,
          createdById: userId,
          lines: reversalLines
        });

        await tx.journalEntry.update({
          where: { id: originalEntry.id },
          data: { status: "REVERSED" }
        });
      }

      // Reverse stock movements
      const movements = await tx.stockMovement.findMany({
        where: {
          companyId,
          sourceType: "INVOICE",
          sourceId: invoice.id
        }
      });

      for (const m of movements) {
        const qty = new Decimal(m.quantity.toString());
        await tx.stockMovement.create({
          data: {
            companyId,
            productId: m.productId,
            warehouseId: m.warehouseId,
            quantity: qty.negated(), // +qty back to stock
            unitCost: m.unitCost,
            type: "RETURN",
            date: new Date(),
            sourceType: "INVOICE_VOID",
            sourceId: invoice.id,
            note: `Stock return on voiding ${invoice.number}`
          }
        });
      }

      const updated = await tx.invoice.update({
        where: { id },
        data: { status: "VOID" }
      });

      await createAuditLog(tx, {
        companyId,
        userId,
        model: "Invoice",
        objectId: id,
        action: "VOID",
        oldData: invoice,
        newData: updated
      });

      return updated;
    });

    return SalesService.getInvoiceById(companyId, id);
  }

  /**
   * Credit Note creation and posting (Sales Returns)
   */
  static async createCreditNote(companyId: string, userId: string, input: any) {
    const contact = await prisma.contact.findFirst({
      where: { id: input.contactId, companyId }
    });
    if (!contact) {
      throw new AppError("Customer not found", 404, "CONTACT_NOT_FOUND");
    }

    const { subtotal, taxTotal, total, calculatedItems } = await SalesService.calculateTotals(companyId, input.items);
    await assertPeriodUnlocked(prisma, companyId, new Date(input.date));

    const [warehouse, accounts] = await Promise.all([
      prisma.warehouse.findFirst({ where: { companyId, isDefault: true } }),
      prisma.account.findMany({
        where: {
          companyId,
          systemKey: { in: ["AR", "SALES", "SALES_TAX_PAYABLE", "COGS", "INVENTORY"] }
        }
      })
    ]);

    const arAcc = accounts.find((a: any) => a.systemKey === "AR");
    const salesAcc = accounts.find((a: any) => a.systemKey === "SALES");
    const taxAcc = accounts.find((a: any) => a.systemKey === "SALES_TAX_PAYABLE");
    const cogsAcc = accounts.find((a: any) => a.systemKey === "COGS");
    const invAcc = accounts.find((a: any) => a.systemKey === "INVENTORY");

    if (!arAcc || !salesAcc) {
      throw new AppError("System accounts for AR or Sales missing in Chart of Accounts", 422, "ACCOUNTS_MISSING");
    }

    const creditNote = await prisma.$transaction(async (tx: any) => {
      const cnNumber = await getNextSequence(tx, companyId, "CN");

      const cn = await tx.creditNote.create({
        data: {
          companyId,
          number: cnNumber,
          invoiceId: input.invoiceId || null,
          contactId: input.contactId,
          date: new Date(input.date),
          status: "POSTED",
          subtotal,
          taxTotal,
          total,
          notes: input.notes || null,
          items: {
            create: calculatedItems
          }
        },
        include: { items: true }
      });

      // Journal lines:
      // Dr Sales [subtotal]
      // Dr Sales Tax [taxTotal]
      // Cr AR [total]
      const journalLines: any[] = [
        {
          accountId: salesAcc.id,
          debit: subtotal.toFixed(2),
          credit: "0.00",
          memo: `Credit Note ${cnNumber} sales return`
        },
        {
          accountId: arAcc.id,
          contactId: input.contactId,
          debit: "0.00",
          credit: total.toFixed(2),
          memo: `Credit Note ${cnNumber}`
        }
      ];

      if (taxTotal.greaterThan(0) && taxAcc) {
        journalLines.push({
          accountId: taxAcc.id,
          debit: taxTotal.toFixed(2),
          credit: "0.00",
          memo: `Sales tax reduction on ${cnNumber}`
        });
      }

      // Return stock for inventory products
      for (const item of cn.items) {
        if (item.productId) {
          const product = await tx.product.findFirst({
            where: { id: item.productId, companyId }
          });
          if (product && product.trackStock) {
            const itemQty = new Decimal(item.quantity.toString());
            const unitCost = new Decimal(product.costPrice.toString());
            const cogsAmount = itemQty.times(unitCost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

            if (cogsAmount.greaterThan(0) && invAcc && cogsAcc) {
              journalLines.push({
                accountId: invAcc.id,
                debit: cogsAmount.toFixed(2),
                credit: "0.00",
                memo: `Inventory restock: ${product.name} (${cnNumber})`
              });
              journalLines.push({
                accountId: cogsAcc.id,
                debit: "0.00",
                credit: cogsAmount.toFixed(2),
                memo: `COGS reversal: ${product.name} (${cnNumber})`
              });
            }

            await tx.stockMovement.create({
              data: {
                companyId,
                productId: product.id,
                warehouseId: warehouse ? warehouse.id : "default-warehouse",
                quantity: itemQty, // positive = stock returned
                unitCost,
                type: "RETURN",
                date: cn.date,
                sourceType: "CREDIT_NOTE",
                sourceId: cn.id,
                note: `Return via Credit Note ${cnNumber}`
              }
            });
          }
        }
      }

      await postJournal(tx, {
        companyId,
        date: cn.date,
        narration: `Credit Note ${cnNumber} for ${contact.name}`,
        sourceType: "CREDIT_NOTE",
        sourceId: cn.id,
        createdById: userId,
        lines: journalLines
      });

      // If linked to an invoice, reduce remaining invoice balance
      if (input.invoiceId) {
        const linkedInv = await tx.invoice.findFirst({
          where: { id: input.invoiceId, companyId }
        });
        if (linkedInv) {
          const newPaid = new Decimal(linkedInv.paidAmount.toString()).plus(total);
          const invTot = new Decimal(linkedInv.total.toString());
          const newStatus = newPaid.greaterThanOrEqualTo(invTot) ? "PAID" : "PARTIALLY_PAID";
          await tx.invoice.update({
            where: { id: input.invoiceId },
            data: {
              paidAmount: newPaid,
              status: newStatus
            }
          });
        }
      }

      await createAuditLog(tx, {
        companyId,
        userId,
        model: "CreditNote",
        objectId: cn.id,
        action: "CREATE",
        newData: cn
      });

      return cn;
    });

    return creditNote;
  }

  /**
   * Stream invoice PDF buffer
   */
  static async generateInvoicePDF(companyId: string, id: string): Promise<Buffer> {
    const inv = await SalesService.getInvoiceById(companyId, id);
    const company = await prisma.company.findUnique({ where: { id: companyId } });

    return generateDocumentPDF({
      title: "TAX INVOICE",
      documentNumber: inv.number,
      date: new Date(inv.date).toLocaleDateString(),
      dueDate: inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : undefined,
      status: inv.status,
      company: {
        name: company?.name || "Accounting ERP",
        ntn: company?.ntn,
        address: company?.address,
        currency: company?.currency || "PKR"
      },
      contact: {
        name: inv.contact?.name || "Customer",
        type: "CUSTOMER",
        ntn: inv.contact?.ntn,
        address: inv.contact?.address,
        phone: inv.contact?.phone,
        email: inv.contact?.email
      },
      items: inv.items.map((it: any) => ({
        description: it.description || "Product Item",
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discount: it.discount,
        taxAmount: it.taxAmount,
        lineTotal: it.lineTotal
      })),
      subtotal: inv.subtotal,
      taxTotal: inv.taxTotal,
      total: inv.total,
      paidAmount: inv.paidAmount,
      balanceDue: inv.balanceDue,
      notes: inv.notes
    });
  }
}
