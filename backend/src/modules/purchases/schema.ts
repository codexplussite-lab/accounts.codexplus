import { z } from "zod";
import { docStatusEnum } from "../sales/schema.js";

export const billItemInputSchema = z.object({
  productId: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(), // For direct expense allocation
  description: z.string().optional().nullable(),
  quantity: z.string().regex(/^\d+(\.\d{1,3})?$/, "Quantity must be a positive number"),
  unitCost: z.string().regex(/^\d+(\.\d{1,2})?$/, "Unit cost must be a valid amount"),
  taxRateId: z.string().optional().nullable()
}).refine((data) => data.productId || data.accountId, {
  message: "Either productId or expense accountId must be provided for each line item"
});

export const createBillSchema = z.object({
  contactId: z.string().min(1, "Vendor is required"),
  vendorBillNo: z.string().optional().nullable(),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
  items: z.array(billItemInputSchema).min(1, "At least one item is required")
});

export const updateBillSchema = z.object({
  contactId: z.string().min(1).optional(),
  vendorBillNo: z.string().optional().nullable(),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional().nullable(),
  items: z.array(billItemInputSchema).min(1).optional()
});

export const billQuerySchema = z.object({
  contactId: z.string().optional(),
  status: docStatusEnum.optional(),
  search: z.string().optional(),
  page: z.string().transform((v) => Math.max(1, parseInt(v, 10) || 1)).default("1"),
  limit: z.string().transform((v) => Math.min(100, Math.max(1, parseInt(v, 10) || 20))).default("20")
});
