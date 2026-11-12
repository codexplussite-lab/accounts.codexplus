import { z } from "zod";

export const contactTypeEnum = z.enum(["CUSTOMER", "VENDOR", "BOTH"]);

export const createContactSchema = z.object({
  name: z.string().min(2, "Contact name must be at least 2 characters"),
  type: contactTypeEnum,
  phone: z.string().optional().nullable(),
  email: z.string().email("Invalid email address").optional().nullable(),
  ntn: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  openingBalance: z.string().regex(/^-?\d+(\.\d{1,2})?$/, "Opening balance must be a valid monetary string").default("0.00"),
  creditLimit: z.string().regex(/^\d+(\.\d{1,2})?$/, "Credit limit must be a valid monetary string").optional().nullable(),
  isActive: z.boolean().default(true)
});

export const updateContactSchema = createContactSchema.partial();

export const contactQuerySchema = z.object({
  search: z.string().optional(),
  type: contactTypeEnum.optional(),
  isActive: z.string().transform((v) => v === "true").optional(),
  page: z.string().transform((v) => Math.max(1, parseInt(v, 10) || 1)).default("1"),
  limit: z.string().transform((v) => Math.min(100, Math.max(1, parseInt(v, 10) || 20))).default("20")
});
