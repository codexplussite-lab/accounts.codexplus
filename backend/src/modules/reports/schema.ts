import { z } from "zod";

export const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  asOfDate: z.string().optional(),
  accountId: z.string().optional(),
  contactId: z.string().optional(),
  productId: z.string().optional()
});

export const generalLedgerQuerySchema = z.object({
  accountId: z.string().min(1, "Account ID is required"),
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

export const asOfDateQuerySchema = z.object({
  asOfDate: z.string().optional()
});

export const exportQuerySchema = z.object({
  reportType: z.enum([
    "general-ledger",
    "trial-balance",
    "profit-and-loss",
    "balance-sheet",
    "ar-ageing",
    "ap-ageing",
    "cash-flow",
    "sales",
    "purchases",
    "tax"
  ]),
  format: z.enum(["pdf", "excel"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  asOfDate: z.string().optional(),
  accountId: z.string().optional(),
  contactId: z.string().optional(),
  productId: z.string().optional()
});
