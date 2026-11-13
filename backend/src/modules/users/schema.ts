import { z } from "zod";
import { Role } from "@prisma/client";

export const InviteUserSchema = z.object({
  email: z.string().email("Valid email address is required"),
  name: z.string().min(1, "Name is required").max(100),
  role: z.nativeEnum(Role),
  initialPassword: z.string().min(8, "Initial password must be at least 8 characters").optional()
});

export const UpdateRoleSchema = z.object({
  role: z.nativeEnum(Role)
});

export type InviteUserInput = z.infer<typeof InviteUserSchema>;
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;
