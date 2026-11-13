import { Decimal } from "decimal.js";
import { RecurringFrequency } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createAuditLog } from "../../lib/audit.js";
import { SalesService } from "../sales/service.js";
import { CreateRecurringInvoiceInput } from "./schema.js";

export class RecurringService {
  /**
   * Calculates next date according to frequency.
   */
  static getNextDate(currentDate: Date, frequency: RecurringFrequency): Date {
    const next = new Date(currentDate);
    switch (frequency) {
      case "WEEKLY":
        next.setDate(next.getDate() + 7);
        break;
      case "MONTHLY":
        next.setMonth(next.getMonth() + 1);
        break;
      case "QUARTERLY":
        next.setMonth(next.getMonth() + 3);
        break;
      case "YEARLY":
        next.setFullYear(next.getFullYear() + 1);
        break;
    }
    return next;
  }

  /**
   * Creates a recurring invoice template.
   */
  static async createTemplate(
    companyId: string,
    input: CreateRecurringInvoiceInput,
    userId?: string,
    ipAddress?: string
  ) {
    const contact = await prisma.contact.findFirst({
      where: { id: input.contactId, companyId }
    });

    if (!contact) {
      throw new AppError("Customer contact not found.", 404, "CONTACT_NOT_FOUND");
    }

    const { subtotal, taxTotal, total } = await SalesService.calculateTotals(companyId, input.items);
    const startDate = new Date(input.startDate);
    const endDate = input.endDate ? new Date(input.endDate) : null;

    const template = await prisma.recurringInvoice.create({
      data: {
        companyId,
        contactId: input.contactId,
        frequency: input.frequency,
        startDate,
        endDate,
        nextRunDate: startDate,
        autoPost: input.autoPost,
        subtotal,
        taxTotal,
        total,
        notes: input.notes || null,
        items: input.items as any,
        isActive: true
      }
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "RecurringInvoice",
      objectId: template.id,
      action: "CREATE",
      newData: template,
      ipAddress
    });

    return template;
  }

  /**
   * Lists recurring invoice templates for company.
   */
  static async listTemplates(companyId: string) {
    const templates = await prisma.recurringInvoice.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" }
    });

    const contactIds = Array.from(new Set(templates.map((t) => t.contactId)));
    const contacts = contactIds.length > 0
      ? await prisma.contact.findMany({
          where: { id: { in: contactIds }, companyId },
          select: { id: true, name: true, email: true }
        })
      : [];

    const contactMap = new Map(contacts.map((c) => [c.id, c]));

    return templates.map((t) => ({
      ...t,
      contact: contactMap.get(t.contactId) || null,
      totalOccurrences: 0
    }));
  }

  /**
   * Updates recurring template active/paused status.
   */
  static async updateStatus(
    companyId: string,
    templateId: string,
    isActive: boolean,
    userId?: string,
    ipAddress?: string
  ) {
    const template = await prisma.recurringInvoice.findFirst({
      where: { id: templateId, companyId }
    });

    if (!template) {
      throw new AppError("Recurring invoice template not found.", 404, "TEMPLATE_NOT_FOUND");
    }

    const updated = await prisma.recurringInvoice.update({
      where: { id: templateId },
      data: { isActive }
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "RecurringInvoice",
      objectId: templateId,
      action: "UPDATE",
      oldData: { isActive: template.isActive },
      newData: { isActive },
      ipAddress
    });

    return updated;
  }

  /**
   * Executes due recurring invoice generation.
   */
  static async generateInvoiceFromTemplate(
    companyId: string,
    templateId: string,
    userId: string,
    ipAddress?: string
  ) {
    const template = await prisma.recurringInvoice.findFirst({
      where: { id: templateId, companyId, isActive: true }
    });

    if (!template) {
      throw new AppError("Recurring invoice template not found or inactive.", 404, "TEMPLATE_NOT_FOUND");
    }

    const runDate = new Date(template.nextRunDate);

    // Create the invoice
    const invoice = await SalesService.createInvoice(companyId, userId, {
      contactId: template.contactId,
      date: runDate.toISOString().split("T")[0],
      notes: `Generated from recurring template: ${template.id}. ${template.notes || ""}`,
      items: template.items as any
    });

    // Optionally auto-post if configured
    let finalInvoice = invoice;
    if (template.autoPost) {
      finalInvoice = await SalesService.postInvoice(companyId, userId, invoice.id);
    }

    // Calculate next run date
    const nextDate = this.getNextDate(runDate, template.frequency);
    let shouldDeactivate = false;
    if (template.endDate && nextDate.getTime() > new Date(template.endDate).getTime()) {
      shouldDeactivate = true;
    }

    await prisma.recurringInvoice.update({
      where: { id: template.id },
      data: {
        nextRunDate: nextDate,
        isActive: shouldDeactivate ? false : true
      }
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "RecurringInvoice",
      objectId: template.id,
      action: "POST",
      newData: {
        generatedInvoiceId: finalInvoice.id,
        invoiceNumber: finalInvoice.number,
        nextRunDate: nextDate.toISOString()
      },
      ipAddress
    });

    return {
      templateId: template.id,
      generatedInvoice: finalInvoice,
      nextRunDate: nextDate
    };
  }

  /**
   * Scans and processes all due recurring invoices for the company.
   */
  static async processDue(companyId: string, userId: string, ipAddress?: string) {
    const now = new Date();
    const dueTemplates = await prisma.recurringInvoice.findMany({
      where: {
        companyId,
        isActive: true,
        nextRunDate: { lte: now }
      }
    });

    const results = [];
    for (const t of dueTemplates) {
      try {
        const res = await this.generateInvoiceFromTemplate(companyId, t.id, userId, ipAddress);
        results.push(res);
      } catch (err: any) {
        console.error(`Failed recurring template ${t.id}:`, err);
      }
    }

    return {
      processedCount: results.length,
      results
    };
  }
}
