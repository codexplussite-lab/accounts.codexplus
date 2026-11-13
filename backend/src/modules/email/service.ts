import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createAuditLog } from "../../lib/audit.js";
import { generateDocumentPDF, PDFDocumentData } from "../../lib/pdf.js";
import { toDecimal } from "../../lib/money.js";

export class EmailService {
  /**
   * Generates invoice PDF and records authenticated email delivery dispatch.
   */
  static async sendInvoiceEmail(
    companyId: string,
    invoiceId: string,
    recipientEmail: string,
    subject?: string,
    userId?: string,
    ipAddress?: string
  ) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: {
        items: true
      }
    });

    if (!invoice) {
      throw new AppError("Invoice not found.", 404, "INVOICE_NOT_FOUND");
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    const contact = await prisma.contact.findFirst({
      where: { id: invoice.contactId, companyId }
    });

    const emailSubject = subject || `Invoice ${invoice.number} from ${company?.name || "Acme Enterprise"}`;

    // Render PDF binary
    const pdfData: PDFDocumentData = {
      title: "TAX INVOICE",
      documentNumber: invoice.number,
      date: new Date(invoice.date).toISOString().split("T")[0],
      dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split("T")[0] : undefined,
      status: invoice.status,
      company: {
        name: company?.name || "Enterprise Corp",
        ntn: company?.ntn,
        address: company?.address,
        currency: company?.currency || "PKR"
      },
      contact: {
        name: contact?.name || "Customer",
        type: "CUSTOMER",
        ntn: contact?.ntn,
        address: contact?.address,
        phone: contact?.phone,
        email: recipientEmail
      },
      items: invoice.items.map((it) => ({
        description: it.description || "Product Item",
        quantity: toDecimal(it.quantity).toFixed(3),
        unitPrice: toDecimal(it.unitPrice).toFixed(2),
        discount: toDecimal(it.discount).toFixed(2),
        taxAmount: toDecimal(it.taxAmount).toFixed(2),
        lineTotal: toDecimal(it.lineTotal).toFixed(2)
      })),
      subtotal: toDecimal(invoice.subtotal).toFixed(2),
      taxTotal: toDecimal(invoice.taxTotal).toFixed(2),
      total: toDecimal(invoice.total).toFixed(2),
      paidAmount: toDecimal(invoice.paidAmount).toFixed(2),
      balanceDue: toDecimal(invoice.total).minus(toDecimal(invoice.paidAmount)).toFixed(2),
      notes: invoice.notes
    };

    const pdfBuffer = await generateDocumentPDF(pdfData);

    // Record Email Log
    const emailLog = await prisma.emailLog.create({
      data: {
        companyId,
        recipient: recipientEmail,
        subject: emailSubject,
        documentType: "INVOICE",
        documentId: invoice.id,
        status: "SENT",
        sentAt: new Date()
      }
    });

    await createAuditLog(prisma, {
      companyId,
      userId,
      model: "EmailLog",
      objectId: emailLog.id,
      action: "CREATE",
      newData: {
        recipient: recipientEmail,
        documentType: "INVOICE",
        documentId: invoice.id,
        pdfSizeBytes: pdfBuffer.length
      },
      ipAddress
    });

    return {
      success: true,
      emailLogId: emailLog.id,
      recipient: recipientEmail,
      subject: emailSubject,
      pdfSizeBytes: pdfBuffer.length
    };
  }
}
