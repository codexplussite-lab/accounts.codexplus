import { z } from "zod";
import { RecurringFrequency } from "@prisma/client";

export const CreateRecurringInvoiceSchema = z.object({
  contactId: z.string().min(1, "Customer contact ID is required"),
  frequency: z.nativeEnum(RecurringFrequency).default(RecurringFrequency.MONTHLY),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional().nullable(),
  autoPost: z.boolean().default(false),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string().optional().nullable(),
      description: z.string().optional(),
      quantity: z.string().or(z.number()),
      unitPrice: z.string().or(z.number()),
      discount: z.string().or(z.number()).default("0"),
      taxRateId: z.string().optional().nullable()
    })
  ).min(1, "At least one item is required")
});

export type CreateRecurringInvoiceInput = z.infer<typeof CreateRecurringInvoiceSchema>;

