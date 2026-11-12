import { Decimal } from "decimal.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createAuditLog } from "../../lib/audit.js";
import { getNextSequence } from "../../lib/sequence.js";
import { assertPeriodUnlocked } from "../../lib/periodLock.js";
import { postJournal } from "../../lib/posting.js";

export class PaymentService {
  static async listPayments(companyId: string, query: any) {
    const { type, contactId, invoiceId, billId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (type) where.type = type;
    if (contactId) where.contactId = contactId;
    if (invoiceId) where.invoiceId = invoiceId;
    if (billId) where.billId = billId;

    const [totalCount, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: "desc" }
      })
    ]);

    const contactIds = [...new Set(payments.map((p: any) => p.contactId))];
    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds }, companyId }
    });
    const contactMap = new Map(contacts.map((c: any) => [c.id, c]));

    const data = payments.map((p: any) => ({
      ...p,
      contactName: contactMap.get(p.contactId)?.name || "Unknown",
      amount: new Decimal(p.amount.toString()).toFixed(2)
    }));

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

  static async getPaymentById(companyId: string, id: string) {
    const payment = await prisma.payment.findFirst({
      where: { id, companyId }
    });

    if (!payment) {
      throw new AppError("Payment not found", 404, "NOT_FOUND");
    }

    const contact = await prisma.contact.findFirst({
      where: { id: payment.contactId, companyId }
    });

    return {
      ...payment,
      contact,
      contactName: contact?.name || "Unknown",
      amount: new Decimal(payment.amount.toString()).toFixed(2)
    };
  }

  static async createPayment(companyId: string, userId: string, input: any) {
    const payAmount = new Decimal(input.amount);
    if (payAmount.isNegative() || payAmount.isZero()) {
      throw new AppError("Payment amount must be greater than zero", 422, "INVALID_AMOUNT");
    }

    const payDate = new Date(input.date);
    await assertPeriodUnlocked(prisma, companyId, payDate);

    const contact = await prisma.contact.findFirst({
      where: { id: input.contactId, companyId }
    });
    if (!contact) {
      throw new AppError("Contact not found", 404, "CONTACT_NOT_FOUND");
    }

    // Resolve Cash or Bank Account
    let cashBankAccountId = input.accountId;
    if (!cashBankAccountId) {
      const defaultBankOrCash = await prisma.account.findFirst({
        where: {
          companyId,
          systemKey: { in: ["CASH", "BANK"] },
          isActive: true
        }
      });
      cashBankAccountId = defaultBankOrCash?.id;
    }

    if (!cashBankAccountId) {
      throw new AppError("No Cash or Bank account found to record payment against", 422, "ACCOUNT_MISSING");
    }

    // Resolve AR / AP system accounts
    const systemAccounts = await prisma.account.findMany({
      where: {
        companyId,
        systemKey: { in: ["AR", "AP"] }
      }
    });
    const arAcc = systemAccounts.find((a: any) => a.systemKey === "AR");
    const apAcc = systemAccounts.find((a: any) => a.systemKey === "AP");

    const result = await prisma.$transaction(async (tx: any) => {
      const paymentNumber = await getNextSequence(tx, companyId, "PAY");
      const journalLines: any[] = [];

      let updatedInvoice = null;
      let updatedBill = null;

      if (input.type === "RECEIVED") {
        if (!arAcc) {
          throw new AppError("Accounts Receivable account missing in Chart of Accounts", 422, "AR_MISSING");
        }

        // Dr Cash/Bank
        // Cr Accounts Receivable (contactId)
        journalLines.push({
          accountId: cashBankAccountId,
          debit: payAmount.toFixed(2),
          credit: "0.00",
          memo: `Payment received: ${paymentNumber} (${input.reference || "Receipt"})`
        });
        journalLines.push({
          accountId: arAcc.id,
          contactId: input.contactId,
          debit: "0.00",
          credit: payAmount.toFixed(2),
          memo: `Payment received: ${paymentNumber}`
        });

        if (input.invoiceId) {
          const invoice = await tx.invoice.findFirst({
            where: { id: input.invoiceId, companyId }
          });
          if (!invoice) {
            throw new AppError("Linked invoice not found", 404, "INVOICE_NOT_FOUND");
          }
          if (invoice.status === "DRAFT" || invoice.status === "VOID") {
            throw new AppError("Cannot record payment against draft or void invoice", 422, "INVALID_DOC_STATUS");
          }

          const currentPaid = new Decimal(invoice.paidAmount.toString());
          const invTotal = new Decimal(invoice.total.toString());
          const remaining = invTotal.minus(currentPaid);

          if (payAmount.greaterThan(remaining)) {
            throw new AppError(
              `Payment amount (${payAmount.toFixed(2)}) exceeds remaining invoice balance (${remaining.toFixed(2)})`,
              422,
              "OVERPAYMENT_NOT_ALLOWED"
            );
          }

          const newPaid = currentPaid.plus(payAmount);
          const newStatus = newPaid.greaterThanOrEqualTo(invTotal) ? "PAID" : "PARTIALLY_PAID";

          updatedInvoice = await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              paidAmount: newPaid,
              status: newStatus
            }
          });
        }
      } else {
        // Payment MADE
        if (!apAcc) {
          throw new AppError("Accounts Payable account missing in Chart of Accounts", 422, "AP_MISSING");
        }

        // Dr Accounts Payable (contactId)
        // Cr Cash/Bank
        journalLines.push({
          accountId: apAcc.id,
          contactId: input.contactId,
          debit: payAmount.toFixed(2),
          credit: "0.00",
          memo: `Payment made: ${paymentNumber}`
        });
        journalLines.push({
          accountId: cashBankAccountId,
          debit: "0.00",
          credit: payAmount.toFixed(2),
          memo: `Payment disbursement: ${paymentNumber} (${input.reference || "Payment"})`
        });

        if (input.billId) {
          const bill = await tx.bill.findFirst({
            where: { id: input.billId, companyId }
          });
          if (!bill) {
            throw new AppError("Linked bill not found", 404, "BILL_NOT_FOUND");
          }
          if (bill.status === "DRAFT" || bill.status === "VOID") {
            throw new AppError("Cannot record payment against draft or void bill", 422, "INVALID_DOC_STATUS");
          }

          const currentPaid = new Decimal(bill.paidAmount.toString());
          const billTotal = new Decimal(bill.total.toString());
          const remaining = billTotal.minus(currentPaid);

          if (payAmount.greaterThan(remaining)) {
            throw new AppError(
              `Payment amount (${payAmount.toFixed(2)}) exceeds remaining bill balance (${remaining.toFixed(2)})`,
              422,
              "OVERPAYMENT_NOT_ALLOWED"
            );
          }

          const newPaid = currentPaid.plus(payAmount);
          const newStatus = newPaid.greaterThanOrEqualTo(billTotal) ? "PAID" : "PARTIALLY_PAID";

          updatedBill = await tx.bill.update({
            where: { id: bill.id },
            data: {
              paidAmount: newPaid,
              status: newStatus
            }
          });
        }
      }

      // Post Balanced Journal
      await postJournal(tx, {
        companyId,
        date: payDate,
        narration: `Payment ${paymentNumber} (${input.type}) - ${contact.name}`,
        sourceType: "PAYMENT",
        sourceId: paymentNumber,
        createdById: userId,
        lines: journalLines
      });

      // Create Payment Record
      const payment = await tx.payment.create({
        data: {
          companyId,
          number: paymentNumber,
          type: input.type,
          contactId: input.contactId,
          invoiceId: input.invoiceId || null,
          billId: input.billId || null,
          bankAccountId: input.bankAccountId || cashBankAccountId,
          amount: payAmount,
          date: payDate,
          method: input.method || "Cash",
          reference: input.reference || null
        }
      });

      await createAuditLog(tx, {
        companyId,
        userId,
        model: "Payment",
        objectId: payment.id,
        action: "CREATE",
        newData: payment
      });

      return { payment, updatedInvoice, updatedBill };
    });

    return PaymentService.getPaymentById(companyId, result.payment.id);
  }
}
