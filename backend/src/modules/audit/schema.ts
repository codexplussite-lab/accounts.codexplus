import { z } from "zod";

export const AuditQuerySchema = z.object({
  userId: z.string().optional(),
  model: z.string().optional(),
  action: z.string().optional(),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20)
});

export type AuditQueryInput = z.infer<typeof AuditQuerySchema>;
