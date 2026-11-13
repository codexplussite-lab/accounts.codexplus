import { z } from "zod";

export const CreateBankAccountSchema = z.object({
  name: z.string().min(1, "Bank account name is required").max(100),
  accountId: z.string().min(1, "Valid account ID is required"),
  accountNo: z.string().max(50).optional()
});

export const ImportStatementSchema = z.object({
  bankAccountId: z.string().min(1, "Bank account ID is required"),
  fileName: z.string().min(1, "File name is required"),
  csvContent: z.string().min(1, "CSV content cannot be empty"),
  openingBalance: z.string().regex(/^-?\d+(\.\d{1,2})?$/).optional(),
  closingBalance: z.string().regex(/^-?\d+(\.\d{1,2})?$/).optional()
});

export const ManualMatchSchema = z.object({
  statementLineId: z.string().min(1, "Statement line ID is required"),
  journalLineId: z.string().min(1, "Journal line ID is required")
});

export type CreateBankAccountInput = z.infer<typeof CreateBankAccountSchema>;
export type ImportStatementInput = z.infer<typeof ImportStatementSchema>;
export type ManualMatchInput = z.infer<typeof ManualMatchSchema>;
