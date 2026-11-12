import { z } from "zod";
import { AccountType } from "@prisma/client";

export const createAccountSchema = z.object({
  code: z.string().min(1, "Account code is required"),
  name: z.string().min(2, "Account name must be at least 2 characters"),
  type: z.nativeEnum(AccountType, { errorMap: () => ({ message: "Invalid account type" }) }),
  parentId: z.string().uuid().nullable().optional()
});

export const updateAccountSchema = z.object({
  name: z.string().min(2).optional(),
  parentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional()
});

export const listAccountsQuerySchema = z.object({
  type: z.nativeEnum(AccountType).optional(),
  search: z.string().optional(),
  isActive: z
    .string()
    .transform((val) => val === "true")
    .optional()
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

