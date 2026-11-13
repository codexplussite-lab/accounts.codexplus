import { prisma } from "../../config/prisma.js";
import { AppError } from "../../middleware/errorHandler.js";
import { assertAuditLogImmutable } from "../../lib/audit.js";
import { AuditQueryInput } from "./schema.js";

export class AuditService {
  /**
   * Retrieves paginated audit logs scoped to company with multiple filter criteria.
   */
  static async listLogs(companyId: string, query: AuditQueryInput) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.model) {
      where.model = query.model;
    }

    if (query.action) {
      where.action = query.action.toUpperCase();
    }

    if (query.startDate || query.endDate) {
      where.timestamp = {};
      if (query.startDate) {
        where.timestamp.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        if (query.endDate.length === 10) {
          end.setHours(23, 59, 59, 999);
        }
        where.timestamp.lte = end;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip,
        take: limit
      }),
      prisma.auditLog.count({ where })
    ]);

    // Enrich with user email/name if available
    const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))] as string[];
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true }
        })
      : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    const enrichedLogs = logs.map((log) => ({
      id: log.id,
      companyId: log.companyId,
      userId: log.userId,
      user: log.userId ? userMap.get(log.userId) || null : null,
      model: log.model,
      objectId: log.objectId,
      action: log.action,
      oldData: log.oldData,
      newData: log.newData,
      ipAddress: log.ipAddress,
      timestamp: log.timestamp
    }));

    return {
      data: enrichedLogs,
      meta: {
        page,
        limit,
        total
      }
    };
  }

  /**
   * Retrieves a single audit log with comprehensive diff information.
   */
  static async getLogById(companyId: string, id: string) {
    const log = await prisma.auditLog.findFirst({
      where: { id, companyId }
    });

    if (!log) {
      throw new AppError("Audit log record not found.", 404, "AUDIT_LOG_NOT_FOUND");
    }

    let user = null;
    if (log.userId) {
      user = await prisma.user.findUnique({
        where: { id: log.userId },
        select: { id: true, name: true, email: true }
      });
    }

    return {
      ...log,
      user
    };
  }

  /**
   * Prohibits update of audit logs (Immutability guarantee).
   */
  static updateLog(): never {
    assertAuditLogImmutable();
  }

  /**
   * Prohibits deletion of audit logs (Immutability guarantee).
   */
  static deleteLog(): never {
    assertAuditLogImmutable();
  }
}
