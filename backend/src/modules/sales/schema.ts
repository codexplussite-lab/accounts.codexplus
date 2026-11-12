import { z } from "zod";

export const docStatusEnum = z.enum(["DRAFT", "POSTED", "PARTIALLY_PAID", "PAID", "VOID"]);

export const invoiceItemInputSchema = z.object({
  productId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  quantity: z.string().regex(/^\d+(\.\d{1,3})?$/, "Quantity must be a positive number with up to 3 decimals"),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Unit price must be a valid price"),
  discount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Discount must be a valid amount").default("0.00"),
  taxRateId: z.string().optional().nullable()
});

export const createInvoiceSchema = z.object({
  contactId: z.string().min(1, "Customer is required"),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(invoiceItemInputSchema).min(1, "At least one item is required")
});

export const updateInvoiceSchema = z.object({
  contactId: z.string().min(1).optional(),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(invoiceItemInputSchema).min(1).optional()
});

export const createCreditNoteSchema = z.object({
  contactId: z.string().min(1, "Customer is required"),
  invoiceId: z.string().optional().nullable(),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  notes: z.string().optional().nullable(),
  items: z.array(invoiceItemInputSchema).min(1, "At least one item is required")
});

export const invoiceQuerySchema = z.object({
  contactId: z.string().optional(),
  status: docStatusEnum.optional(),
  search: z.string().optional(),
  page: z.string().transform((v) => Math.max(1, parseInt(v, 10) || 1)).default("1"),
  limit: z.string().transform((v) => Math.min(100, Math.max(1, parseInt(v, 10) || 20))).default("20")
});
