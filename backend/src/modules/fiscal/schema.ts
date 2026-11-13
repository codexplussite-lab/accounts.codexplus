import { z } from "zod";

export const SetPeriodLockSchema = z.object({
  lockedUntil: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .nullable()
});

export const CreateFiscalYearSchema = z
  .object({
    name: z.string().min(1, "Fiscal year name is required").max(100),
    startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
  })
  .refine(
    (data) => new Date(data.startDate).getTime() < new Date(data.endDate).getTime(),
    {
      message: "Start date must be strictly before end date.",
      path: ["endDate"]
    }
  );

export const ReopenFiscalYearSchema = z.object({
  reason: z
    .string()
    .min(5, "Reopening justification must be at least 5 characters long.")
    .max(500)
});

export type SetPeriodLockInput = z.infer<typeof SetPeriodLockSchema>;
export type CreateFiscalYearInput = z.infer<typeof CreateFiscalYearSchema>;
export type ReopenFiscalYearInput = z.infer<typeof ReopenFiscalYearSchema>;
