import { Prisma } from "@prisma/client";

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

