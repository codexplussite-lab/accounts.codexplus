import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { AppError } from "./errorHandler.js";

export async function companyScope(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError("Authentication required before company scoping.", 401, "UNAUTHORIZED");
    }

    const rawCompanyId = req.headers["x-company-id"];

    if (!rawCompanyId || typeof rawCompanyId !== "string" || !rawCompanyId.trim()) {
      throw new AppError("X-Company-Id header is required to access company resources.", 400, "COMPANY_ID_REQUIRED");
    }

    const targetCompanyId = rawCompanyId.trim();

    // Verify membership directly in database
    const membership = await prisma.membership.findUnique({
      where: {
        userId_companyId: {
          userId: req.user.id,
          companyId: targetCompanyId
        }
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            currency: true,
            lockedUntil: true
          }
        }
      }
    });

    if (!membership) {
      throw new AppError(
        "Access denied: You do not have verified membership in this company.",
        403,
        "FORBIDDEN_COMPANY_ACCESS"
      );
    }

    // Bind verified company scope and role to request
    req.companyId = membership.companyId;
    req.role = membership.role;

    next();
  } catch (error) {
    next(error);
  }
}
