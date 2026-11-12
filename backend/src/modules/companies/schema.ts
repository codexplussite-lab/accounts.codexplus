import { z } from "zod";

export const createCompanySchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters"),
  currency: z.string().default("PKR"),
  ntn: z.string().optional(),
  address: z.string().optional()
});

export const updateCompanySchema = z.object({
  name: z.string().min(2).optional(),
  ntn: z.string().optional(),
  address: z.string().optional(),
  currency: z.string().optional(),
  lockedUntil: z.string().datetime().nullable().optional(),
  allowNegativeStock: z.boolean().optional()
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

