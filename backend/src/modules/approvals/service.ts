import { ApprovalStatus, DocStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createAuditLog } from "../../lib/audit.js";
import { SalesService } from "../sales/service.js";

export class ApprovalService {
  /**
   * Submits a draft invoice for approval.
   */
  static async submitInvoice(companyId: string, invoiceId: string, userId?: string, ipAddress?: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId }
    });

    if (!invoice) {
      throw new AppError("Invoice not found.", 404, "INVOICE_NOT_FOUND");
    }

    if (invoice.status !== DocStatus.DRAFT) {
      throw new AppError("Only DRAFT invoices can be submitted for approval.", 422, "INVALID_STATUS");
    }

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { approvalStatus: ApprovalStatus.PENDING_APPROVAL }
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "Invoice",
      objectId: invoice.id,
      action: "UPDATE",
      oldData: { approvalStatus: invoice.approvalStatus },
      newData: { approvalStatus: ApprovalStatus.PENDING_APPROVAL },
      ipAddress
    });

    return updated;
  }

  /**
   * Approves and posts an invoice. (Strictly OWNER required).
   */
  static async approveInvoice(companyId: string, invoiceId: string, userId: string, ipAddress?: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId }
    });

    if (!invoice) {
      throw new AppError("Invoice not found.", 404, "INVOICE_NOT_FOUND");
    }

    if (invoice.approvalStatus !== ApprovalStatus.PENDING_APPROVAL) {
      throw new AppError("Invoice is not pending approval.", 422, "NOT_PENDING_APPROVAL");
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { approvalStatus: ApprovalStatus.APPROVED }
    });

    // Auto-post the invoice
    const posted = await SalesService.postInvoice(companyId, userId, invoice.id);

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "Invoice",
      objectId: invoice.id,
      action: "POST",
      newData: { approvalStatus: ApprovalStatus.APPROVED, postedStatus: posted.status },
      ipAddress
    });

    return posted;
  }

  /**
   * Rejects an invoice with mandatory reason.
   */
  static async rejectInvoice(
    companyId: string,
    invoiceId: string,
    reason: string,
    userId: string,
    ipAddress?: string
  ) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId }
    });

    if (!invoice) {
      throw new AppError("Invoice not found.", 404, "INVOICE_NOT_FOUND");
    }

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        approvalStatus: ApprovalStatus.REJECTED,
        notes: `${invoice.notes || ""}\n[REJECTION REASON]: ${reason}`.trim()
      }
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "Invoice",
      objectId: invoice.id,
      action: "UPDATE",
      newData: { approvalStatus: ApprovalStatus.REJECTED, reason },
      ipAddress
    });

    return updated;
  }
}
