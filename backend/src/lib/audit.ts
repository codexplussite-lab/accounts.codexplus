import { Prisma } from "@prisma/client";
import { AppError } from "../middleware/errorHandler.js";

export interface AuditLogParams {
  companyId: string;
  userId?: string | null;
  model: string;
  objectId: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "POST" | "VOID" | "REVERSE" | "LOGIN" | "REGISTER";
  oldData?: unknown;
  newData?: unknown;
  ipAddress?: string;
}

/**
 * Creates an append-only, immutable audit record.
 */
export async function createAuditLog(
  tx: Prisma.TransactionClient,
  params: AuditLogParams
): Promise<void> {
  await tx.auditLog.create({
    data: {
      companyId: params.companyId,
      userId: params.userId || null,
      model: params.model,
      objectId: params.objectId,
      action: params.action,
      oldData: params.oldData ? (params.oldData as Prisma.InputJsonValue) : Prisma.JsonNull,
      newData: params.newData ? (params.newData as Prisma.InputJsonValue) : Prisma.JsonNull,
      ipAddress: params.ipAddress || null
    }
  });
}

/**
 * Audit records are strictly immutable. Any modification or deletion is prohibited.
 */
export function assertAuditLogImmutable(): never {
  throw new AppError(
    "AuditLog records are immutable. UPDATE and DELETE operations are strictly forbidden.",
    403,
    "AUDIT_LOG_IMMUTABLE"
  );
}

/**
 * PostgreSQL DDL for database-level immutability enforcement:
 *
 * CREATE OR REPLACE RULE audit_log_no_update AS
 *   ON UPDATE TO "AuditLog" DO INSTEAD NOTHING;
 *
 * CREATE OR REPLACE RULE audit_log_no_delete AS
 *   ON DELETE TO "AuditLog" DO INSTEAD NOTHING;
 */
export const AUDIT_IMMUTABILITY_SQL = `
CREATE OR REPLACE RULE audit_log_no_update AS ON UPDATE TO "AuditLog" DO INSTEAD NOTHING;
CREATE OR REPLACE RULE audit_log_no_delete AS ON DELETE TO "AuditLog" DO INSTEAD NOTHING;
`;

