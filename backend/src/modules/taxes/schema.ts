import { z } from "zod";

export const createTaxRateSchema = z.object({
  name: z.string().min(2, "Tax rate name must be at least 2 characters"),
  percentage: z.string().regex(/^\d+(\.\d{1,2})?$/, "Percentage must be a valid number (e.g. '18.00')"),
  isActive: z.boolean().default(true)
});

export const updateTaxRateSchema = createTaxRateSchema.partial();
