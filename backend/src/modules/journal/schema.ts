import { z } from "zod";
import { EntryStatus } from "@prisma/client";

export const journalLineSchema = z.object({
  accountId: z.string().min(1, "Account ID is required"),
  contactId: z.string().min(1).nullable().optional(),
  debit: z.union([z.string(), z.number()]).default("0"),
  credit: z.union([z.string(), z.number()]).default("0"),
  memo: z.string().optional()
});

export const createJournalDraftSchema = z.object({
  date: z.string().min(1, "Date is required"),
  narration: z.string().optional(),
  lines: z.array(journalLineSchema).min(1, "Draft must have at least one line")
});

export const postJournalDirectSchema = z.object({
  date: z.string().min(1, "Date is required"),
  narration: z.string().optional(),
  lines: z.array(journalLineSchema).min(2, "Journal entry must contain at least 2 lines")
});

export const reverseJournalSchema = z.object({
  reason: z.string().min(3, "Reversal reason must be provided")
});

export const listJournalQuerySchema = z.object({
  page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 20)),
  status: z.nativeEnum(EntryStatus).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional()
});

export type CreateJournalDraftInput = z.infer<typeof createJournalDraftSchema>;
export type PostJournalDirectInput = z.infer<typeof postJournalDirectSchema>;
export type ReverseJournalInput = z.infer<typeof reverseJournalSchema>;
