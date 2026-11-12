import { z } from "zod";

export const paymentTypeEnum = z.enum(["RECEIVED", "MADE"]);

export const createPaymentSchema = z.object({
  type: paymentTypeEnum,
  contactId: z.string().min(1, "Contact is required"),
  invoiceId: z.string().optional().nullable(),
  billId: z.string().optional().nullable(),
  bankAccountId: z.string().optional().nullable(), // Optional: can fall back to default cash/bank account
  accountId: z.string().optional().nullable(), // Chart of accounts Cash/Bank account
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Payment amount must be a positive monetary value"),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  method: z.string().optional().nullable(), // Cash, Bank Transfer, Cheque, Online
  reference: z.string().optional().nullable()
});

export const paymentQuerySchema = z.object({
  type: paymentTypeEnum.optional(),
  contactId: z.string().optional(),
  invoiceId: z.string().optional(),
  billId: z.string().optional(),
  page: z.string().transform((v) => Math.max(1, parseInt(v, 10) || 1)).default("1"),
  limit: z.string().transform((v) => Math.min(100, Math.max(1, parseInt(v, 10) || 20))).default("20")
});
